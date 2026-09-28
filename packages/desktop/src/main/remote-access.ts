import { decodeBase64, encodeBase64, relayMessage } from "@openctrlc/remote-relay/protocol"
import type { RemoteAccessPairRequest, RemoteAccessState } from "@openctrlc/app"
import type { ServerReadyData } from "../preload/types"

type InboundHTTP = {
  controller?: ReadableStreamDefaultController<Uint8Array>
  aborted: AbortController
}

export class RemoteAccessService {
  #state: RemoteAccessState = { status: "stopped", pendingRequests: [], authorizedDevices: 0 }
  #listeners = new Set<(state: RemoteAccessState) => void>()
  #socket?: WebSocket
  #sessionID?: string
  #hostToken?: string
  #server?: ServerReadyData
  #requests = new Map<string, InboundHTTP>()
  #localSockets = new Map<string, WebSocket>()
  #notifiedPairRequests = new Set<string>()
  #starting?: Promise<RemoteAccessState>

  constructor(
    private readonly getServer: () => Promise<ServerReadyData>,
    private readonly onError: (error: unknown) => void,
  ) {}

  getState() {
    return this.#state
  }

  subscribe(listener: (state: RemoteAccessState) => void) {
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  start() {
    if (this.#starting) return this.#starting
    if (this.#state.status === "active") return Promise.resolve(this.#state)
    this.#notifiedPairRequests.clear()
    this.#setState({ status: "connecting", pendingRequests: [], authorizedDevices: 0 })
    this.#starting = this.#start().finally(() => {
      this.#starting = undefined
    })
    return this.#starting
  }

  async stop() {
    const socket = this.#socket
    if (socket?.readyState === WebSocket.OPEN) this.#send({ type: "session.stop" })
    this.#socket = undefined
    this.#sessionID = undefined
    this.#hostToken = undefined
    this.#server = undefined
    this.#notifiedPairRequests.clear()
    for (const request of this.#requests.values()) request.aborted.abort()
    for (const local of this.#localSockets.values()) local.close(1000, "Remote access stopped")
    this.#requests.clear()
    this.#localSockets.clear()
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Remote access stopped")
    this.#setState({ status: "stopped", pendingRequests: [], authorizedDevices: 0 })
  }

  rotatePairingLink() {
    if (this.#state.status !== "active") return Promise.reject(new Error("Remote access is not active"))
    this.#send({ type: "pair.rotate" })
    return Promise.resolve()
  }

  approve(pairID: string) {
    this.#send({ type: "pair.approve", pairID })
  }

  deny(pairID: string) {
    this.#send({ type: "pair.deny", pairID })
  }

  async #start() {
    this.#server = await this.getServer()
    const relay = process.env.OPENCTRLC_REMOTE_RELAY_URL ?? "wss://openctrlc-remote.quniv.cn/v1/host"
    return new Promise<RemoteAccessState>((resolve, reject) => {
      const socket = new WebSocket(relay)
      this.#socket = socket
      const timeout = setTimeout(() => {
        socket.close()
        reject(new Error("Relay connection timed out"))
      }, 20_000)
      socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "session.create" })), { once: true })
      socket.addEventListener("message", (event) => {
        const message = relayMessage(event.data)
        if (!message || typeof message.type !== "string") return
        if (message.type === "session.created") {
          if (
            typeof message.sessionID !== "string" ||
            typeof message.hostToken !== "string" ||
            typeof message.url !== "string"
          ) {
            clearTimeout(timeout)
            reject(new Error("The relay returned an invalid session"))
            return
          }
          this.#sessionID = message.sessionID
          this.#hostToken = message.hostToken
          this.#setState({ status: "active", url: message.url, pendingRequests: [], authorizedDevices: 0 })
          clearTimeout(timeout)
          resolve(this.#state)
          return
        }
        this.#handleMessage(message)
        if (message.type === "pair.error" && this.#state.status === "connecting") {
          clearTimeout(timeout)
          reject(new Error(typeof message.message === "string" ? message.message : "Relay rejected the connection"))
        }
      })
      socket.addEventListener("error", () => {
        clearTimeout(timeout)
        const error = new Error("Could not connect to the OpenCtrlC Remote Relay")
        this.#setState({ status: "error", pendingRequests: [], authorizedDevices: 0, error: error.message })
        reject(error)
      })
      socket.addEventListener("close", (event) => {
        clearTimeout(timeout)
        if (this.#socket !== socket) return
        this.#socket = undefined
        this.#sessionID = undefined
        this.#hostToken = undefined
        this.#server = undefined
        this.#notifiedPairRequests.clear()
        for (const request of this.#requests.values()) {
          request.aborted.abort()
          try {
            request.controller?.error(new Error("Remote relay disconnected"))
          } catch {}
        }
        this.#requests.clear()
        for (const local of this.#localSockets.values()) local.close(1001, "Remote relay disconnected")
        this.#localSockets.clear()
        if (this.#state.status !== "stopped") {
          const error = event.reason || "The remote relay connection ended"
          this.#setState({ status: "error", pendingRequests: [], authorizedDevices: 0, error })
          this.onError(new Error(error))
        }
      })
    }).catch((error: unknown) => {
      if (this.#state.status === "connecting") {
        this.#setState({
          status: "error",
          pendingRequests: [],
          authorizedDevices: 0,
          error: error instanceof Error ? error.message : "Could not start remote access",
        })
      }
      throw error
    })
  }

  #handleMessage(message: Record<string, unknown>) {
    if (message.type === "pair.request" && typeof message.pairID === "string") {
      const pendingRequests = [
        ...this.#state.pendingRequests.filter((item) => item.id !== message.pairID),
        {
          id: message.pairID,
          device: typeof message.device === "string" ? message.device : "Browser",
        },
      ]
      this.#setState({ ...this.#state, pendingRequests })
      return
    }
    if (message.type === "pair.approved" || message.type === "pair.denied") {
      const id = typeof message.pairID === "string" ? message.pairID : ""
      const pendingRequests = this.#state.pendingRequests.filter((item) => item.id !== id)
      this.#notifiedPairRequests.delete(id)
      this.#setState({
        ...this.#state,
        pendingRequests,
        authorizedDevices:
          message.type === "pair.approved" ? this.#state.authorizedDevices + 1 : this.#state.authorizedDevices,
      })
      return
    }
    if (message.type === "pair.rotated" && typeof message.url === "string") {
      this.#setState({ ...this.#state, url: message.url })
      return
    }
    if (typeof message.id !== "string") return
    if (message.type === "request.start") {
      this.#startLocalRequest(message)
      return
    }
    if (message.type === "request.chunk") {
      const request = this.#requests.get(message.id)
      if (request?.controller && typeof message.data === "string") {
        try {
          request.controller.enqueue(decodeBase64(message.data))
        } catch {
          request.aborted.abort()
          this.#requests.delete(message.id)
        }
      }
      return
    }
    if (message.type === "request.end") {
      try {
        this.#requests.get(message.id)?.controller?.close()
      } catch {}
      return
    }
    if (message.type === "request.cancel") {
      const request = this.#requests.get(message.id)
      request?.aborted.abort()
      try {
        request?.controller?.error(new Error("Remote request cancelled"))
      } catch {}
      this.#requests.delete(message.id)
      return
    }
    if (message.type === "socket.open") {
      this.#openLocalSocket(message)
      return
    }
    if (message.type === "socket.message") {
      const socket = this.#localSockets.get(message.id)
      if (!socket || typeof message.data !== "string" || socket.readyState !== WebSocket.OPEN) return
      socket.send(message.binary === true ? decodeBase64(message.data) : message.data)
      return
    }
    if (message.type === "socket.close") {
      this.#localSockets
        .get(message.id)
        ?.close(
          typeof message.code === "number" ? message.code : 1000,
          typeof message.reason === "string" ? message.reason : "Remote client disconnected",
        )
      this.#localSockets.delete(message.id)
    }
  }

  #startLocalRequest(message: Record<string, unknown>) {
    if (typeof message.id !== "string" || typeof message.path !== "string" || typeof message.method !== "string") return
    const server = this.#server
    if (!server) return this.#send({ type: "response.error", id: message.id, message: "Local server is unavailable" })
    let target: URL
    try {
      if (!message.path.startsWith("/") || message.path.startsWith("//")) throw new Error("Invalid path")
      target = new URL(message.path, server.url)
      if (target.origin !== new URL(server.url).origin) throw new Error("Invalid path")
    } catch {
      return this.#send({ type: "response.error", id: message.id, message: "Invalid request path" })
    }
    const method = message.method.toUpperCase()
    if (!new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]).has(method)) {
      return this.#send({ type: "response.error", id: message.id, message: "Unsupported request method" })
    }
    const abort = new AbortController()
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.#requests.set(message.id as string, {
          controller,
          aborted: abort,
        })
      },
      cancel: () => abort.abort(),
    })
    let headers: Headers
    try {
      headers = new Headers(
        message.headers && typeof message.headers === "object" ? (message.headers as Record<string, string>) : {},
      )
      headers.set("origin", server.url)
      if (server.username && server.password)
        headers.set("authorization", `Basic ${btoa(`${server.username}:${server.password}`)}`)
    } catch {
      this.#requests.delete(message.id)
      return this.#send({ type: "response.error", id: message.id, message: "Invalid request headers" })
    }
    const init: RequestInit & { duplex?: "half" } = {
      method,
      headers,
      redirect: "manual",
      signal: abort.signal,
    }
    if (!new Set(["GET", "HEAD"]).has(method)) {
      init.body = stream
      init.duplex = "half"
    }
    void fetch(target, init)
      .then(async (response) => {
        const responseHeaders = Object.fromEntries(
          [...response.headers.entries()].filter(
            ([name]) =>
              ![
                "connection",
                "content-length",
                "keep-alive",
                "set-cookie",
                "set-cookie2",
                "server",
                "transfer-encoding",
                "upgrade",
              ].includes(name.toLowerCase()),
          ),
        )
        const location = responseHeaders.location
        if (location) {
          try {
            const target = new URL(location, server.url)
            if (target.origin === new URL(server.url).origin) {
              const origin = this.#state.url ? new URL(this.#state.url).origin : "https://openctrlc-remote.quniv.cn"
              responseHeaders.location = origin + target.pathname + target.search + target.hash
            }
          } catch {
            delete responseHeaders.location
          }
        }
        if (
          !this.#send({
            type: "response.start",
            id: message.id as string,
            status: response.status,
            headers: responseHeaders,
          })
        ) {
          abort.abort()
          return
        }
        if (!response.body) {
          this.#send({ type: "response.end", id: message.id as string })
          this.#requests.delete(message.id as string)
          return
        }
        const reader = response.body.getReader()
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          for (let start = 0; start < chunk.value.length; start += 24 * 1024) {
            this.#send({
              type: "response.chunk",
              id: message.id as string,
              data: encodeBase64(chunk.value.subarray(start, start + 24 * 1024)),
            })
          }
        }
        this.#send({ type: "response.end", id: message.id as string })
        this.#requests.delete(message.id as string)
      })
      .catch(() => {
        this.#send({ type: "response.error", id: message.id as string, message: "Local server request failed" })
        this.#requests.delete(message.id as string)
      })
  }

  #openLocalSocket(message: Record<string, unknown>) {
    if (typeof message.id !== "string" || typeof message.path !== "string" || !this.#server) return
    let target: URL
    try {
      if (!message.path.startsWith("/") || message.path.startsWith("//")) throw new Error("Invalid path")
      target = new URL(message.path, this.#server.url)
      if (target.origin !== new URL(this.#server.url).origin) throw new Error("Invalid path")
    } catch {
      return this.#send({ type: "socket.close", id: message.id, code: 1008, reason: "Invalid socket path" })
    }
    target.protocol = target.protocol === "https:" ? "wss:" : "ws:"
    if (this.#server.username && this.#server.password) {
      target.searchParams.set("auth_token", btoa(`${this.#server.username}:${this.#server.password}`))
    }
    let socket: WebSocket
    try {
      const protocols = Array.isArray(message.protocols)
        ? message.protocols.filter((item): item is string => typeof item === "string")
        : []
      socket = new WebSocket(target, protocols)
    } catch {
      return this.#send({
        type: "socket.close",
        id: message.id,
        code: 1011,
        reason: "Could not connect to local server",
      })
    }
    socket.binaryType = "arraybuffer"
    this.#localSockets.set(message.id, socket)
    socket.addEventListener("open", () => {
      this.#send({ type: "socket.opened", id: message.id as string, protocol: socket.protocol })
    })
    socket.addEventListener("message", async (event) => {
      const value: unknown = event.data
      const binary = typeof value !== "string"
      const bytes =
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : value instanceof Blob
            ? new Uint8Array(await value.arrayBuffer())
            : value instanceof Uint8Array
              ? value
              : undefined
      this.#send({
        type: "socket.message",
        id: message.id as string,
        data: typeof value === "string" ? value : bytes ? encodeBase64(bytes) : "",
        binary,
      })
    })
    socket.addEventListener("close", (event) => {
      this.#send({ type: "socket.close", id: message.id as string, code: event.code, reason: event.reason })
      this.#localSockets.delete(message.id as string)
    })
    socket.addEventListener("error", () => {
      this.#send({ type: "socket.close", id: message.id as string, code: 1011, reason: "Local WebSocket failed" })
      this.#localSockets.delete(message.id as string)
    })
  }

  #send(message: Record<string, unknown>) {
    const socket = this.#socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ ...message, sessionID: this.#sessionID, hostToken: this.#hostToken }))
    return true
  }

  acknowledgePairRequests(pairIDs: string[]) {
    for (const pairID of pairIDs) {
      if (this.#notifiedPairRequests.has(pairID)) continue
      if (!this.#state.pendingRequests.some((request) => request.id === pairID)) continue
      if (this.#send({ type: "pair.received", pairID })) this.#notifiedPairRequests.add(pairID)
    }
  }

  #setState(state: RemoteAccessState) {
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }
}
