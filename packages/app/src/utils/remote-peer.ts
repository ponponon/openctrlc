import { PeerChannel, PEER_NEGOTIATION_TIMEOUT_MS } from "@openctrlc/remote-relay/peer"
import {
  BinaryFrameFlag,
  BinaryFrameKind,
  decodeBase64,
  decodeBinaryFrame,
  encodeBinaryFrame,
  isPeerRelayAvailable,
  isPeerIceServers,
  PEER_RESPONSE_BUFFER_BYTES,
  PEER_RESPONSE_CHUNK_BYTES,
  streamID,
} from "@openctrlc/remote-relay/protocol"
import type { RemoteTransportStatus } from "@/context/platform"

export const PEER_CAPACITY_RETRY_DELAY_MS = 60_000

export function remotePeerReconnectDelay(attempt: number, closeCode = 0) {
  const delays = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]
  const minimumDelay = closeCode === 4429 ? PEER_CAPACITY_RETRY_DELAY_MS : 0
  return Math.max(delays[Math.min(Math.max(0, Math.floor(attempt)), delays.length - 1)], minimumDelay)
}

type PendingResponse = {
  start: (response: Response) => void
  fail: (error: Error) => void
  cleanup: () => void
  cancelUpload?: () => Promise<void>
  controller?: ReadableStreamDefaultController<Uint8Array>
  responseCreditBytes: number
}

export function responseCreditBatch(availableBytes: number) {
  const remainingBytes = Number.isFinite(availableBytes) ? Math.max(0, Math.floor(availableBytes)) : 0
  const credits: number[] = []
  let remaining = remainingBytes
  while (remaining > 0) {
    const bytes = Math.min(PEER_RESPONSE_CHUNK_BYTES, remaining)
    credits.push(bytes)
    remaining -= bytes
  }
  return credits
}

export function decodePeerResponseBody(body: ReadableStream<Uint8Array>, headers: Headers) {
  if (headers.get("content-encoding")?.toLowerCase() !== "gzip") return body
  headers.delete("content-encoding")
  headers.delete("content-length")
  // The DOM lib types DecompressionStream's writable side as BufferSource, although this stream emits byte chunks.
  return body.pipeThrough(new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>)
}

export function remoteSocketTarget(input: string | URL, origin: string, sessionID: string) {
  const target = new URL(input, origin)
  const relayTarget = new URL(target)
  const httpOrigin = (url: URL) => {
    const protocol = url.protocol === "ws:" ? "http:" : url.protocol === "wss:" ? "https:" : url.protocol
    return `${protocol}//${url.host}`
  }
  const sameOrigin = httpOrigin(target) === new URL(origin).origin
  if (sameOrigin) relayTarget.searchParams.set("_oc_remote_session", sessionID)
  return { target, relayTarget, sameOrigin }
}

export class RemotePeerClient {
  #socket?: WebSocket
  #peer?: PeerChannel
  #pending = new Map<string, PendingResponse>()
  #keepalive?: ReturnType<typeof setInterval>
  #peerKeepalive?: ReturnType<typeof setInterval>
  #socketOpenTimer?: ReturnType<typeof setTimeout>
  #peerConnectTimer?: ReturnType<typeof setTimeout>
  #reconnectTimer?: ReturnType<typeof setTimeout>
  #reconnectAttempt = 0
  #peerReadyAt?: number
  #closed = false
  #peerUnavailable = false
  #capabilityCheck?: AbortController
  #capabilityState: "unknown" | "checking" | "ready" | "unsupported" = "unknown"
  #lastPeerPong = Date.now()
  #status: RemoteTransportStatus = "connecting"
  #statusListeners = new Set<(status: RemoteTransportStatus) => void>()

  constructor(private readonly sessionID: string) {
    this.#connect()
    window.addEventListener("pagehide", () => this.close())
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted || !this.#closed) return
      this.#closed = false
      this.#reconnectAttempt = 0
      this.#connect()
    })
  }

  get ready() {
    return this.#peer?.ready === true
  }
  get status() {
    return this.#status
  }

  subscribe(callback: (status: RemoteTransportStatus) => void) {
    this.#statusListeners.add(callback)
    callback(this.#status)
    return () => this.#statusListeners.delete(callback)
  }

  #setStatus(status: RemoteTransportStatus) {
    if (this.#status === status) return
    this.#status = status
    for (const callback of this.#statusListeners) callback(status)
  }

  #connect() {
    if (this.#closed) return
    if (this.#capabilityState === "unsupported") {
      this.#peerUnavailable = true
      this.#setStatus("unavailable")
      return
    }
    if (this.#capabilityState === "checking") return
    if (this.#capabilityState === "unknown") {
      this.#capabilityState = "checking"
      const controller = new AbortController()
      this.#capabilityCheck = controller
      const timeout = setTimeout(() => controller.abort(), 5_000)
      void fetch(new URL("/_remote/capabilities", location.origin), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (response.status === 404 || response.status === 501) {
            this.#capabilityState = "unsupported"
            this.#peerUnavailable = true
            this.#setStatus("unavailable")
            return
          }
          if (!response.ok) throw new Error("Could not check remote peer support")
          let capabilities: unknown
          try {
            capabilities = await response.json()
          } catch {
            this.#capabilityState = "unsupported"
            this.#peerUnavailable = true
            this.#setStatus("unavailable")
            return
          }
          if (!isPeerRelayAvailable(capabilities)) {
            this.#capabilityState = "unsupported"
            this.#peerUnavailable = true
            this.#setStatus("unavailable")
            return
          }
          this.#capabilityState = "ready"
          this.#reconnectAttempt = 0
          this.#connect()
        })
        .catch(() => {
          if (this.#closed) return
          this.#capabilityState = "unknown"
          this.#setStatus("relay")
          this.#scheduleReconnect()
        })
        .finally(() => {
          clearTimeout(timeout)
          if (this.#capabilityCheck === controller) this.#capabilityCheck = undefined
        })
      return
    }
    if (this.#peerUnavailable) {
      this.#setStatus("unavailable")
      return
    }
    if (typeof RTCPeerConnection !== "function") {
      this.#peerUnavailable = true
      this.#setStatus("unavailable")
      return
    }
    this.#setStatus("connecting")
    const url = new URL("/_remote/peer", location.origin)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.searchParams.set("_oc_remote_session", this.sessionID)
    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch {
      this.#setStatus("relay")
      this.#scheduleReconnect()
      return
    }
    this.#socket = socket
    this.#socketOpenTimer = setTimeout(() => {
      if (this.#socket === socket && socket.readyState === WebSocket.CONNECTING)
        socket.close(4000, "Signaling connection timed out")
    }, 12_000)
    socket.addEventListener("message", (event) => {
      if (this.#socket !== socket) return
      if (typeof event.data !== "string") return
      let message: Record<string, unknown>
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message.type === "peer.ready" && typeof message.peerID === "string") {
        this.#peer?.close()
        let peer!: PeerChannel
        try {
          peer = new PeerChannel({
            offer: false,
            iceServers: isPeerIceServers(message.iceServers) ? message.iceServers : undefined,
            signal: (signal) => {
              if (this.#socket === socket && socket.readyState === WebSocket.OPEN)
                socket.send(JSON.stringify({ type: "peer.signal", signal }))
            },
            message: (data) => this.#message(data),
            route: (route) => {
              if (this.#peer === peer && !this.#closed) this.#setStatus(route)
            },
            ready: () => {
              if (this.#peer !== peer || this.#closed) return
              this.#peerReadyAt = Date.now()
              this.#lastPeerPong = Date.now()
              if (this.#peerConnectTimer) clearTimeout(this.#peerConnectTimer)
              this.#peerConnectTimer = undefined
              this.#setStatus("checking")
              window.dispatchEvent(new Event("openctrlc:remote-peer-ready"))
            },
            closed: () => {
              if (this.#peer !== peer) return
              if (this.#peerReadyAt && Date.now() - this.#peerReadyAt >= 60_000) this.#reconnectAttempt = 0
              this.#peerReadyAt = undefined
              this.#peer = undefined
              this.#setStatus("relay")
              this.#failPending("Direct connection ended")
              window.dispatchEvent(new Event("openctrlc:remote-peer-down"))
              if (this.#socket === socket && socket.readyState === WebSocket.OPEN)
                socket.close(4000, "Direct connection ended")
            },
          })
        } catch {
          this.#peerUnavailable = true
          this.#setStatus("unavailable")
          socket.close(4405, "WebRTC is unavailable")
          return
        }
        this.#peer = peer
      }
      if (message.type === "peer.signal") this.#peer?.receiveSignal(message.signal)
    })
    socket.addEventListener("open", () => {
      if (this.#socket !== socket || this.#closed) return socket.close()
      if (this.#socketOpenTimer) clearTimeout(this.#socketOpenTimer)
      this.#socketOpenTimer = undefined
      this.#peerConnectTimer = setTimeout(() => {
        if (this.#socket === socket && !this.#peer?.ready) socket.close(4000, "Direct connection timed out")
      }, PEER_NEGOTIATION_TIMEOUT_MS)
      this.#keepalive = setInterval(() => {
        if (this.#socket === socket && socket.readyState === WebSocket.OPEN) socket.send('{"type":"peer.ping"}')
      }, 30_000)
      this.#peerKeepalive = setInterval(() => {
        if (!this.#peer?.ready) return
        if (Date.now() - this.#lastPeerPong > 65_000) {
          if (this.#socket === socket && socket.readyState === WebSocket.OPEN)
            socket.close(4000, "Direct connection timed out")
          return
        }
        void this.#peer.send('{"type":"peer.ping"}')
      }, 30_000)
    })
    socket.addEventListener("error", () => {
      if (this.#socket === socket && socket.readyState < WebSocket.CLOSING) socket.close()
    })
    socket.addEventListener("close", (event) => {
      if (this.#socket !== socket) return
      if (this.#socketOpenTimer) clearTimeout(this.#socketOpenTimer)
      this.#socketOpenTimer = undefined
      if (this.#peerConnectTimer) clearTimeout(this.#peerConnectTimer)
      this.#peerConnectTimer = undefined
      if (this.#keepalive) clearInterval(this.#keepalive)
      this.#keepalive = undefined
      if (this.#peerKeepalive) clearInterval(this.#peerKeepalive)
      this.#peerKeepalive = undefined
      if (this.#peerReadyAt && Date.now() - this.#peerReadyAt >= 60_000) this.#reconnectAttempt = 0
      this.#peerReadyAt = undefined
      const peer = this.#peer
      this.#peer = undefined
      const unavailable = this.#peerUnavailable || event.code === 4401 || event.code === 4404
      this.#setStatus(unavailable ? "unavailable" : "relay")
      peer?.close()
      this.#socket = undefined
      this.#failPending("Remote direct connection ended")
      window.dispatchEvent(new Event("openctrlc:remote-peer-down"))
      if (!unavailable) this.#scheduleReconnect(event.code)
    })
  }

  #scheduleReconnect(closeCode = 0) {
    if (this.#closed || this.#reconnectTimer) return
    const delay = remotePeerReconnectDelay(this.#reconnectAttempt, closeCode)
    this.#reconnectAttempt += 1
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined
      this.#connect()
    }, delay)
  }

  #failPending(message: string) {
    for (const [id, pending] of this.#pending) {
      const error = new Error(message)
      pending.cleanup()
      pending.cancelUpload?.()
      if (pending.controller) pending.controller.error(error)
      else pending.fail(error)
      this.#pending.delete(id)
    }
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit) {
    if (!this.ready) return undefined
    const request = new Request(input, init)
    if (new URL(request.url).origin !== location.origin) return undefined
    const id = streamID()
    let pending!: PendingResponse
    const response = new Promise<Response>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>
      const cleanup = () => {
        clearTimeout(timer)
        request.signal.removeEventListener("abort", abort)
      }
      const abort = () => {
        if (!this.#pending.delete(id)) return
        cleanup()
        pending.cancelUpload?.()
        const reason = request.signal.reason
        const error = reason instanceof Error ? reason : new DOMException("The request was aborted", "AbortError")
        if (pending.controller) pending.controller.error(error)
        else pending.fail(error)
        void this.#send({ type: "request.cancel", id })
      }
      pending = {
        start: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        fail: (error) => {
          cleanup()
          reject(error)
        },
        cleanup,
        responseCreditBytes: 0,
      }
      this.#pending.set(id, pending)
      timer = setTimeout(() => {
        if (!this.#pending.delete(id)) return
        pending.fail(new Error("Direct request timed out"))
        pending.cancelUpload?.()
        void this.#send({ type: "request.cancel", id })
      }, 30_000)
      request.signal.addEventListener("abort", abort, { once: true })
      if (request.signal.aborted) abort()
    })
    if (!this.#pending.has(id)) return await response
    const headers = Object.fromEntries(
      [...request.headers.entries()].filter(
        ([name]) =>
          !["cookie", "authorization", "host", "origin", "referer", "x-openctrlc-remote-session"].includes(
            name.toLowerCase(),
          ),
      ),
    )
    if (typeof DecompressionStream === "function") headers["x-openctrlc-remote-accept-encoding"] = "gzip"
    if (
      !(await this.#send({
        type: "request.start",
        id,
        method: request.method,
        path: new URL(request.url).pathname + new URL(request.url).search,
        headers,
      }))
    ) {
      this.#pending.delete(id)
      pending.cleanup()
      return undefined
    }
    void (async () => {
      try {
        if (request.body) {
          const reader = request.body.getReader()
          let uploadComplete = false
          pending.cancelUpload = () =>
            reader
              .cancel()
              .then(() => undefined)
              .catch(() => undefined)
          try {
            while (true) {
              if (this.#pending.get(id) !== pending || request.signal.aborted) {
                pending.cancelUpload()
                return
              }
              const item = await reader.read()
              if (item.done) {
                uploadComplete = true
                break
              }
              for (let offset = 0; offset < item.value.length; offset += 24 * 1024) {
                if (this.#pending.get(id) !== pending || request.signal.aborted) {
                  pending.cancelUpload()
                  return
                }
                const peer = this.#peer
                const frame = encodeBinaryFrame(
                  BinaryFrameKind.RequestChunk,
                  id,
                  item.value.subarray(offset, offset + 24 * 1024),
                )
                if (!peer?.ready || !(await peer.send(frame))) throw new Error("Direct connection ended")
              }
            }
          } finally {
            if (!uploadComplete) await pending.cancelUpload()
            pending.cancelUpload = undefined
            reader.releaseLock()
          }
        }
        if (this.#pending.get(id) !== pending) return
        if (!(await this.#send({ type: "request.end", id }))) throw new Error("Direct connection ended")
      } catch (error) {
        const value = this.#pending.get(id)
        this.#pending.delete(id)
        value?.cleanup()
        if (value?.controller) value.controller.error(error)
        else value?.fail(error instanceof Error ? error : new Error("Direct request failed"))
        void this.#send({ type: "request.cancel", id })
      }
    })()
    try {
      return await response
    } catch (error) {
      if (!this.#closed && (request.method === "GET" || request.method === "HEAD")) return fetch(request)
      throw error
    }
  }

  webSocket(url: string | URL, protocols?: string | string[]) {
    const { target, relayTarget, sameOrigin } = remoteSocketTarget(url, location.origin, this.sessionID)
    if (!this.ready || !sameOrigin) {
      return new WebSocket(relayTarget, protocols)
    }
    const socket = new RemotePeerWebSocket(this, () => new WebSocket(relayTarget, protocols))
    socket.connect(target.pathname + target.search, typeof protocols === "string" ? [protocols] : (protocols ?? []))
    return socket as unknown as WebSocket
  }

  async socketSend(id: string, data: string | ArrayBuffer | Uint8Array) {
    if (typeof data === "string") return this.#send({ type: "socket.message", id, data, binary: false })
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    return (
      this.#peer?.send(encodeBinaryFrame(BinaryFrameKind.SocketMessage, id, bytes, BinaryFrameFlag.PayloadBinary)) ??
      false
    )
  }

  socketOpen(id: string, path: string, protocols: string[]) {
    return this.#send({ type: "socket.open", id, path, protocols })
  }

  socketClose(id: string, code: number, reason: string) {
    return this.#send({ type: "socket.close", id, code, reason })
  }

  close() {
    if (this.#closed) return
    this.#closed = true
    this.#capabilityCheck?.abort()
    this.#capabilityCheck = undefined
    if (this.#capabilityState === "checking") this.#capabilityState = "unknown"
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer)
    this.#reconnectTimer = undefined
    if (this.#keepalive) clearInterval(this.#keepalive)
    this.#keepalive = undefined
    if (this.#peerKeepalive) clearInterval(this.#peerKeepalive)
    this.#peerKeepalive = undefined
    if (this.#socketOpenTimer) clearTimeout(this.#socketOpenTimer)
    this.#socketOpenTimer = undefined
    if (this.#peerConnectTimer) clearTimeout(this.#peerConnectTimer)
    this.#peerConnectTimer = undefined
    const socket = this.#socket
    const peer = this.#peer
    this.#socket = undefined
    this.#peer = undefined
    this.#setStatus("relay")
    window.dispatchEvent(new Event("openctrlc:remote-peer-down"))
    peer?.close()
    socket?.close()
    this.#failPending("Remote page closed")
  }

  async #send(message: Record<string, unknown>) {
    if (!this.#peer?.ready) return false
    return this.#peer.send(JSON.stringify(message))
  }

  #message(data: string | Uint8Array) {
    if (data instanceof Uint8Array) {
      const frame = decodeBinaryFrame(data)
      if (!frame) return
      if (frame.kind === BinaryFrameKind.SocketMessage) {
        window.dispatchEvent(
          new CustomEvent(`openctrlc:socket:${frame.id}:message`, {
            detail: {
              data:
                frame.flags & BinaryFrameFlag.PayloadBinary
                  ? frame.payload.slice()
                  : new TextDecoder().decode(frame.payload),
            },
          }),
        )
        return
      }
      if (frame.kind === BinaryFrameKind.ResponseChunk)
        this.#enqueueResponseChunk(frame.id, this.#pending.get(frame.id), frame.payload)
      return
    }
    let message: Record<string, unknown>
    try {
      message = JSON.parse(data)
    } catch {
      return
    }
    if (message.type === "peer.pong") {
      this.#lastPeerPong = Date.now()
      return
    }
    if (typeof message.id !== "string") return
    if (message.type === "socket.opened") {
      window.dispatchEvent(new CustomEvent(`openctrlc:socket:${message.id}:open`, { detail: message.protocol }))
      return
    }
    if (message.type === "socket.message") {
      window.dispatchEvent(
        new CustomEvent(`openctrlc:socket:${message.id}:message`, {
          detail: {
            data:
              message.binary === true && typeof message.data === "string" ? decodeBase64(message.data) : message.data,
          },
        }),
      )
      return
    }
    if (message.type === "socket.close") {
      window.dispatchEvent(new CustomEvent(`openctrlc:socket:${message.id}:close`, { detail: message }))
      return
    }
    const pending = this.#pending.get(message.id)
    if (!pending) return
    if (message.type === "response.start" && typeof message.status === "number") {
      const headers = new Headers(message.headers as HeadersInit)
      const encoding = headers.get("content-encoding")?.toLowerCase()
      headers.delete("content-length")
      const noBody = message.status === 204 || message.status === 205 || message.status === 304
      if (noBody) {
        pending.start(new Response(null, { status: message.status, headers }))
        return
      }
      const body = new ReadableStream<Uint8Array>(
        {
          start: (controller) => {
            pending.controller = controller
          },
          pull: (controller) => this.#grantResponseCredit(message.id as string, pending, controller),
          cancel: () => {
            pending.cleanup()
            pending.cancelUpload?.()
            this.#pending.delete(message.id as string)
            void this.#send({ type: "request.cancel", id: message.id })
          },
        },
        { highWaterMark: PEER_RESPONSE_BUFFER_BYTES, size: (chunk) => chunk?.byteLength ?? 0 },
      )
      if (encoding === "gzip" && typeof DecompressionStream === "function") {
        pending.start(new Response(decodePeerResponseBody(body, headers), { status: message.status, headers }))
        return
      }
      pending.start(new Response(body, { status: message.status, headers }))
      return
    }
    if (message.type === "response.chunk" && typeof message.data === "string") {
      this.#enqueueResponseChunk(message.id, pending, decodeBase64(message.data))
      return
    }
    if (message.type === "response.end") {
      pending.cleanup()
      pending.controller?.close()
      this.#pending.delete(message.id)
      return
    }
    if (message.type === "response.error") {
      pending.cleanup()
      pending.cancelUpload?.()
      const error = new Error(typeof message.message === "string" ? message.message : "Remote request failed")
      pending.controller?.error(error)
      if (!pending.controller) pending.fail(error)
      this.#pending.delete(message.id)
      void this.#send({ type: "request.cancel", id: message.id })
      return
    }
  }

  async #grantResponseCredit(
    id: string,
    pending: PendingResponse,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ) {
    while (this.#pending.get(id) === pending) {
      const credits = responseCreditBatch((controller.desiredSize ?? 0) - pending.responseCreditBytes)
      if (credits.length === 0) return
      for (const bytes of credits) {
        if (this.#pending.get(id) !== pending) return
        pending.responseCreditBytes += bytes
        if (await this.#send({ type: "response.credit", id, bytes })) continue
        pending.responseCreditBytes -= bytes
        if (this.#pending.get(id) !== pending) return
        pending.cleanup()
        this.#pending.delete(id)
        controller.error(new Error("Direct response flow stopped"))
        void this.#send({ type: "request.cancel", id })
        return
      }
    }
  }

  #enqueueResponseChunk(id: string, pending: PendingResponse | undefined, bytes: Uint8Array) {
    if (!pending?.controller) return
    if (bytes.byteLength > pending.responseCreditBytes) {
      this.#peer?.close()
      return
    }
    pending.responseCreditBytes -= bytes.byteLength
    try {
      pending.controller.enqueue(bytes)
    } catch {
      pending.cleanup()
      pending.cancelUpload?.()
      this.#pending.delete(id)
      void this.#send({ type: "request.cancel", id })
    }
  }
}

class RemotePeerWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  #binaryType: BinaryType = "blob"
  extensions = ""
  protocol = ""
  readyState = RemotePeerWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  #id = streamID()
  #client: RemotePeerClient
  #createFallback: () => WebSocket
  #fallback?: WebSocket
  #fallbackListeners: Array<[string, EventListener]> = []
  #userClosing = false
  #sendQueue: Promise<void> = Promise.resolve()
  #bufferedAmount = 0
  #sendFailed = false
  #path = ""
  #subs: Array<[string, EventListener]> = []
  #openTimer?: ReturnType<typeof setTimeout>
  #closeTimer?: ReturnType<typeof setTimeout>

  get binaryType() {
    return this.#binaryType
  }
  get bufferedAmount() {
    return this.#bufferedAmount
  }
  set binaryType(value: BinaryType) {
    if (value !== "blob" && value !== "arraybuffer") return
    this.#binaryType = value
    if (this.#fallback) this.#fallback.binaryType = value
  }

  constructor(client: RemotePeerClient, createFallback: () => WebSocket) {
    super()
    this.#client = client
    this.#createFallback = createFallback
  }

  connect(path: string, protocols: string[]) {
    this.#path = path
    this.#listen(`openctrlc:socket:${this.#id}:open`, ((event: CustomEvent<string>) => {
      if (this.#fallback) {
        void this.#client.socketClose(this.#id, 1000, "Connection moved to Relay")
        return
      }
      if (this.readyState !== RemotePeerWebSocket.CONNECTING) {
        void this.#client.socketClose(this.#id, 1000, "Connection cancelled")
        return
      }
      if (this.#openTimer) clearTimeout(this.#openTimer)
      this.#openTimer = undefined
      this.protocol = event.detail
      this.readyState = RemotePeerWebSocket.OPEN
      this.#emit("open", new Event("open"))
    }) as EventListener)
    this.#listen(`openctrlc:socket:${this.#id}:message`, ((event: CustomEvent<{ data: unknown }>) => {
      const data = event.detail.data
      if (data instanceof Uint8Array) {
        this.#emit(
          "message",
          new MessageEvent("message", {
            data: this.binaryType === "arraybuffer" ? data.slice().buffer : new Blob([data.slice().buffer]),
          }),
        )
        return
      }
      this.#emit(
        "message",
        new MessageEvent("message", {
          data,
        }),
      )
    }) as EventListener)
    this.#listen("openctrlc:remote-peer-down", (() => {
      if (this.readyState === RemotePeerWebSocket.CLOSED || this.#fallback) return
      if (this.readyState === RemotePeerWebSocket.CONNECTING && !this.#userClosing)
        return this.#fallbackToRelay("Direct connection ended")
      this.#finish(1012, "Direct connection ended")
    }) as EventListener)
    this.#listen(`openctrlc:socket:${this.#id}:close`, ((event: CustomEvent<{ code: number; reason: string }>) => {
      // A direct socket can close after its Relay fallback is already open.
      // Ignore that stale peer event instead of terminating the working socket.
      if (this.#fallback) return
      if (this.readyState === RemotePeerWebSocket.CONNECTING && !this.#userClosing)
        return this.#fallbackToRelay(event.detail.reason || "Direct WebSocket failed")
      this.#finish(event.detail.code, event.detail.reason)
    }) as EventListener)
    this.#openTimer = setTimeout(() => {
      if (this.readyState !== RemotePeerWebSocket.CONNECTING) return
      this.#fallbackToRelay("Direct socket connection timed out")
    }, 15_000)
    void this.#client.socketOpen(this.#id, this.#path, protocols).then((sent) => {
      if (!sent && this.readyState === RemotePeerWebSocket.CONNECTING)
        this.#fallbackToRelay("Direct socket connection unavailable")
    })
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView) {
    if (this.readyState !== RemotePeerWebSocket.OPEN)
      throw new DOMException("WebSocket is not open", "InvalidStateError")
    const size =
      typeof data === "string"
        ? new TextEncoder().encode(data).byteLength
        : data instanceof Blob
          ? data.size
          : data.byteLength
    this.#bufferedAmount += size
    this.#sendQueue = this.#sendQueue
      .then(async () => {
        if (this.#sendFailed || this.readyState === RemotePeerWebSocket.CLOSED) return
        const payload =
          data instanceof Blob
            ? new Uint8Array(await data.arrayBuffer())
            : typeof data === "string" || data instanceof ArrayBuffer || data instanceof Uint8Array
              ? data
              : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        if (!(await this.#client.socketSend(this.#id, payload))) throw new Error("Direct WebSocket send failed")
      })
      .catch(() => {
        this.#sendFailed = true
        this.#finish(1011, "Direct WebSocket send failed", true)
      })
      .finally(() => {
        this.#bufferedAmount = Math.max(0, this.#bufferedAmount - size)
      })
  }

  close(code = 1000, reason = "") {
    if (this.readyState >= RemotePeerWebSocket.CLOSING) return
    this.#userClosing = true
    this.readyState = RemotePeerWebSocket.CLOSING
    if (this.#openTimer) clearTimeout(this.#openTimer)
    this.#openTimer = undefined
    this.#closeTimer = setTimeout(() => this.#finish(code, reason), 2_000)
    if (this.#fallback) {
      this.#fallback.close(code, reason)
      return
    }
    void this.#sendQueue.then(() => {
      if (this.readyState === RemotePeerWebSocket.CLOSING) return this.#client.socketClose(this.#id, code, reason)
    })
  }

  #fallbackToRelay(reason: string) {
    if (this.readyState !== RemotePeerWebSocket.CONNECTING || this.#userClosing || this.#fallback) return
    if (this.#openTimer) clearTimeout(this.#openTimer)
    this.#openTimer = undefined
    void this.#client.socketClose(this.#id, 1000, "Falling back to Relay")
    try {
      const socket = this.#createFallback()
      this.#fallback = socket
      socket.binaryType = this.binaryType
      const listen = (name: string, callback: EventListener) => {
        socket.addEventListener(name, callback)
        this.#fallbackListeners.push([name, callback])
      }
      listen("open", (() => {
        if (this.readyState !== RemotePeerWebSocket.CONNECTING) return socket.close()
        if (this.#openTimer) clearTimeout(this.#openTimer)
        this.#openTimer = undefined
        this.protocol = socket.protocol
        this.readyState = RemotePeerWebSocket.OPEN
        this.#emit("open", new Event("open"))
      }) as EventListener)
      listen("message", ((event: MessageEvent) => {
        if (this.readyState === RemotePeerWebSocket.OPEN)
          this.#emit("message", new MessageEvent("message", { data: event.data }))
      }) as EventListener)
      listen("error", (() => {
        if (this.readyState !== RemotePeerWebSocket.CLOSED) this.#emit("error", new Event("error"))
      }) as EventListener)
      listen("close", ((event: CloseEvent) => this.#finish(event.code, event.reason)) as EventListener)
      this.#openTimer = setTimeout(() => {
        if (this.readyState !== RemotePeerWebSocket.CONNECTING || this.#fallback !== socket) return
        socket.close()
        this.#finish(1006, `Relay connection timed out after: ${reason}`, true)
      }, 15_000)
    } catch {
      this.#finish(1006, "Could not connect through Relay", true)
    }
  }

  #listen(name: string, callback: EventListener) {
    window.addEventListener(name, callback)
    this.#subs.push([name, callback])
  }
  #emit(name: string, event: Event) {
    this.dispatchEvent(event)
    if (name === "open") this.onopen?.(event)
    if (name === "message") this.onmessage?.(event as MessageEvent)
    if (name === "close") this.onclose?.(event as CloseEvent)
    if (name === "error") this.onerror?.(event)
  }
  #finish(code: number, reason: string, error = false) {
    if (this.readyState === RemotePeerWebSocket.CLOSED) return
    this.readyState = RemotePeerWebSocket.CLOSED
    this.#bufferedAmount = 0
    this.#cleanup()
    for (const [name, listener] of this.#fallbackListeners) this.#fallback?.removeEventListener(name, listener)
    this.#fallbackListeners = []
    if (this.#fallback && this.#fallback.readyState < WebSocket.CLOSING) this.#fallback.close()
    this.#fallback = undefined
    if (error) this.#emit("error", new Event("error"))
    this.#emit("close", new CloseEvent("close", { code, reason }))
  }
  #cleanup() {
    if (this.#openTimer) clearTimeout(this.#openTimer)
    this.#openTimer = undefined
    if (this.#closeTimer) clearTimeout(this.#closeTimer)
    this.#closeTimer = undefined
    for (const [name, callback] of this.#subs) window.removeEventListener(name, callback)
    this.#subs = []
  }
}
