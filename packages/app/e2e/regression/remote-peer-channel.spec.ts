import { expect, test } from "@playwright/test"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { PeerSignal } from "@openctrlc/remote-relay/protocol"

test("Chromium WebRTC channel exchanges control and fragmented binary data", async ({ page }) => {
  test.setTimeout(60_000)
  const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3000}`
  const origin = new URL(baseURL).origin
  const moduleURL = (file: string) => `/@fs${resolve(packageRoot, file)}`

  await page.route(`${origin}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>WebRTC transport harness</title>" }),
  )
  await page.goto(origin)

  const result = await page.evaluate(async ({ peerModule, protocolModule }) => {
    type PeerChannelOptions = {
      offer: boolean
      signal: (signal: PeerSignal) => void
      message: (data: string | Uint8Array) => void
      ready: () => void
      closed: () => void
    }
    type PeerChannelInstance = {
      send(data: string | Uint8Array): Promise<boolean>
      receiveSignal(signal: unknown): void
      close(): void
    }
    type PeerChannelConstructor = new (options: PeerChannelOptions) => PeerChannelInstance
    type ProtocolModule = {
      BinaryFrameKind: { ResponseChunk: number }
      decodeBinaryFrame(bytes: Uint8Array): { kind: number; id: string; payload: Uint8Array } | undefined
      encodeBinaryFrame(kind: number, id: string, payload: Uint8Array): Uint8Array
    }
    const [{ PeerChannel }, protocol] = await Promise.all([
      import(peerModule) as Promise<{ PeerChannel: PeerChannelConstructor }>,
      import(protocolModule) as Promise<ProtocolModule>,
    ])
    const payload = new Uint8Array(512 * 1024 + 13)
    for (let index = 0; index < payload.length; index += 1) payload[index] = (index * 31 + 7) % 251
    let left: PeerChannelInstance | undefined
    let right: PeerChannelInstance | undefined
    let leftReady = false
    let rightReady = false
    let leftReceivedCredit = false
    let rightReceivedRequest = false
    let rightReceivedResponse: Uint8Array | undefined
    let sentProbes = false
    let finished = false
    let rejectCompletion!: (error: Error) => void
    let resolveCompletion!: () => void
    const completion = new Promise<void>((resolve, reject) => {
      resolveCompletion = resolve
      rejectCompletion = reject
    })
    const fail = (error: Error) => {
      if (finished) return
      finished = true
      rejectCompletion(error)
    }
    const complete = () => {
      if (finished || !leftReceivedCredit || !rightReceivedRequest || !rightReceivedResponse) return
      finished = true
      resolveCompletion()
    }
    const sendProbes = async () => {
      if (!leftReady || !rightReady || sentProbes || !left || !right) return
      sentProbes = true
      if (!await left.send(JSON.stringify({ type: "request.start", id: "abcdefghijkl" })))
        return fail(new Error("Browser-side DataChannel send failed"))
      if (!await left.send(protocol.encodeBinaryFrame(protocol.BinaryFrameKind.ResponseChunk, "abcdefghijkl", payload)))
        return fail(new Error("Fragmented binary DataChannel send failed"))
      if (!await right.send(JSON.stringify({ type: "response.credit", id: "abcdefghijkl", bytes: 256 * 1024 })))
        fail(new Error("Desktop-side DataChannel send failed"))
    }
    const leftClosed = () => fail(new Error("Browser-side DataChannel closed before all frames arrived"))
    const rightClosed = () => fail(new Error("Desktop-side DataChannel closed before all frames arrived"))
    left = new PeerChannel({
      offer: false,
      signal: (signal) => right?.receiveSignal(signal),
      message: (data) => {
        if (typeof data !== "string") return
        const message = JSON.parse(data) as Record<string, unknown>
        if (message.type !== "response.credit" || message.bytes !== 256 * 1024) return fail(new Error("Response credit frame was corrupted"))
        leftReceivedCredit = true
        complete()
      },
      ready: () => { leftReady = true; void sendProbes() },
      closed: leftClosed,
    })
    right = new PeerChannel({
      offer: true,
      signal: (signal) => left?.receiveSignal(signal),
      message: (data) => {
        if (typeof data === "string") {
          const message = JSON.parse(data) as Record<string, unknown>
          if (message.type !== "request.start" || message.id !== "abcdefghijkl") return fail(new Error("Request control frame was corrupted"))
          rightReceivedRequest = true
          complete()
          return
        }
        const frame = protocol.decodeBinaryFrame(data)
        if (!frame || frame.kind !== protocol.BinaryFrameKind.ResponseChunk || frame.id !== "abcdefghijkl")
          return fail(new Error("Fragmented response frame could not be decoded"))
        rightReceivedResponse = frame.payload
        complete()
      },
      ready: () => { rightReady = true; void sendProbes() },
      closed: rightClosed,
    })

    try {
      await completion
    } finally {
      left?.close()
      right?.close()
    }
    const received = rightReceivedResponse
    return {
      secureContext: isSecureContext,
      leftReady,
      rightReady,
      requestReceived: rightReceivedRequest,
      creditReceived: leftReceivedCredit,
      responseBytes: received?.byteLength ?? 0,
      responseMatches: received?.every((value, index) => value === payload[index]) ?? false,
    }
  }, {
    peerModule: moduleURL("remote-relay/src/peer.ts"),
    protocolModule: moduleURL("remote-relay/src/protocol.ts"),
  })

  expect(result).toEqual({
    secureContext: true,
    leftReady: true,
    rightReady: true,
    requestReceived: true,
    creditReceived: true,
    responseBytes: 512 * 1024 + 13,
    responseMatches: true,
  })
})

test("direct terminal socket preserves send order and closes cleanly on page shutdown", async ({ page }) => {
  test.setTimeout(60_000)
  const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3000}`
  const origin = new URL(baseURL).origin
  const moduleURL = (file: string) => `/@fs${resolve(packageRoot, file)}`

  await page.route(`${origin}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>WebRTC lifecycle harness</title>" }),
  )
  await page.route(`${origin}/_remote/capabilities`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ peerProtocol: 1, iceConfigured: true }) }),
  )
  await page.goto(origin)

  const result = await page.evaluate(async ({ peerModule, clientModule, protocolModule }) => {
    type PeerSignal =
      | { type: "offer" | "answer"; sdp: string }
      | { type: "candidate"; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
    type PeerChannelOptions = {
      offer: boolean
      signal: (signal: PeerSignal) => void
      message: (data: string | Uint8Array) => void
      ready: () => void
      closed: () => void
    }
    type PeerChannelInstance = {
      send(data: string | Uint8Array): Promise<boolean>
      receiveSignal(signal: unknown): void
      close(): void
    }
    type PeerChannelConstructor = new (options: PeerChannelOptions) => PeerChannelInstance
    type RemotePeerClientInstance = {
      status: string
      subscribe(callback: (status: string) => void): () => void
      webSocket(url: string | URL, protocols?: string | string[]): WebSocket
      close(): void
    }
    type RemotePeerClientConstructor = new (sessionID: string) => RemotePeerClientInstance
    type ProtocolModule = {
      BinaryFrameFlag: { PayloadBinary: number }
      BinaryFrameKind: { SocketMessage: number }
      decodeBinaryFrame(value: Uint8Array): { kind: number; flags: number; id: string; payload: Uint8Array } | undefined
    }
    const NativeWebSocket = window.WebSocket
    let host: PeerChannelInstance | undefined
    let signaling: SignalingSocket | undefined
    let hostClosed = false
    const hostMessages: string[] = []
    const socketMessages: string[] = []
    let directSocketID = ""

    class SignalingSocket extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
      readyState = SignalingSocket.CONNECTING

      constructor() {
        super()
        signaling = this
        queueMicrotask(() => {
          this.readyState = SignalingSocket.OPEN
          this.dispatchEvent(new Event("open"))
          this.receive({ type: "peer.ready", peerID: "abcdefghijklmnop" })
        })
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data !== "string") return
        const message = JSON.parse(data) as Record<string, unknown>
        if (message.type === "peer.signal") host?.receiveSignal(message.signal)
      }

      receive(message: Record<string, unknown>) {
        this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }))
      }

      close(code = 1000, reason = "") {
        if (this.readyState >= SignalingSocket.CLOSING) return
        this.readyState = SignalingSocket.CLOSED
        this.dispatchEvent(new CloseEvent("close", { code, reason }))
      }
    }

    Object.defineProperty(window, "WebSocket", { configurable: true, value: SignalingSocket })
    const [{ PeerChannel }, { RemotePeerClient }, protocol] = await Promise.all([
      import(peerModule) as Promise<{ PeerChannel: PeerChannelConstructor }>,
      import(clientModule) as Promise<{ RemotePeerClient: RemotePeerClientConstructor }>,
      import(protocolModule) as Promise<ProtocolModule>,
    ])
    const client = new RemotePeerClient("abcdefghijklmnop")
    try {
      host = new PeerChannel({
        offer: true,
        signal: (signal) => signaling?.receive({ type: "peer.signal", signal }),
        message: (data) => {
          if (typeof data === "string") {
            const message = JSON.parse(data) as Record<string, unknown>
            if (typeof message.type === "string") hostMessages.push(message.type)
            if (message.type === "socket.open" && typeof message.id === "string") {
              directSocketID = message.id
              const response = message.path === "/busy"
                ? { type: "socket.close", id: message.id, code: 1013, reason: "Too many direct requests" }
                : { type: "socket.opened", id: message.id, protocol: "" }
              void host?.send(JSON.stringify(response))
            }
            if (message.type === "socket.message" && message.id === directSocketID && typeof message.data === "string")
              socketMessages.push(message.data)
            return
          }
          const frame = protocol.decodeBinaryFrame(data)
          if (frame?.kind === protocol.BinaryFrameKind.SocketMessage && frame.flags === protocol.BinaryFrameFlag.PayloadBinary && frame.id === directSocketID)
            socketMessages.push(new TextDecoder().decode(frame.payload))
        },
        ready: () => undefined,
        closed: () => { hostClosed = true },
      })
      const direct = await new Promise<string>((resolve, reject) => {
        let unsubscribe: () => void = () => undefined
        unsubscribe = client.subscribe((status) => {
          if (status === "direct") {
            unsubscribe()
            resolve(status)
            return
          }
          if (status === "unavailable" || status === "relay") {
            unsubscribe()
            reject(new Error(`Direct peer failed before becoming ready: ${status}`))
          }
        })
      })
      const socket = client.webSocket(`ws://${location.host}/pty`)
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true })
        socket.addEventListener("error", () => reject(new Error(
          `Direct terminal socket failed to open; hostMessages=${hostMessages.join(",")}; hostClosed=${hostClosed}`,
        )), { once: true })
      })
      const first = "blob-first"
      const second = "text-second"
      socket.send(new Blob([first]))
      const bufferedAfterBlob = socket.bufferedAmount
      socket.send(second)
      const bufferedAfterBoth = socket.bufferedAmount
      await new Promise<void>((resolve, reject) => {
        let interval: number
        const timeout = window.setTimeout(() => {
          window.clearInterval(interval)
          reject(new Error("Terminal messages did not reach the host"))
        }, 5_000)
        interval = window.setInterval(() => {
          if (socketMessages.length !== 2) return
          window.clearInterval(interval)
          window.clearTimeout(timeout)
          resolve()
        }, 10)
      })
      const closed = new Promise<number>((resolve) =>
        socket.addEventListener("close", (event) => resolve((event as CloseEvent).code), { once: true }),
      )
      client.close()
      const closeCode = await closed
      return { direct, closeCode, readyState: socket.readyState, socketMessages, bufferedAfterBlob, bufferedAfterBoth }
    } finally {
      client.close()
      host?.close()
      Object.defineProperty(window, "WebSocket", { configurable: true, value: NativeWebSocket })
    }
  }, {
    peerModule: moduleURL("remote-relay/src/peer.ts"),
    clientModule: moduleURL("app/src/utils/remote-peer.ts"),
    protocolModule: moduleURL("remote-relay/src/protocol.ts"),
  })

  expect(result.direct).toBe("direct")
  expect(result.closeCode).toBe(1012)
  expect(result.readyState).toBe(WebSocket.CLOSED)
  expect(result.socketMessages).toEqual(["blob-first", "text-second"])
  expect(result.bufferedAfterBlob).toBeGreaterThanOrEqual("blob-first".length)
  expect(result.bufferedAfterBoth).toBeGreaterThanOrEqual("blob-first".length + "text-second".length)
})

test("a rejected direct WebSocket falls back to Relay with the session query", async ({ page }) => {
  test.setTimeout(60_000)
  const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3000}`
  const origin = new URL(baseURL).origin
  const moduleURL = (file: string) => `/@fs${resolve(packageRoot, file)}`

  await page.route(`${origin}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Relay WebSocket fallback harness</title>" }),
  )
  await page.route(`${origin}/_remote/capabilities`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ peerProtocol: 1, iceConfigured: true }) }),
  )
  await page.goto(origin)

  const result = await page.evaluate(async ({ peerModule, clientModule }) => {
    type PeerSignal =
      | { type: "offer" | "answer"; sdp: string }
      | { type: "candidate"; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
    type PeerChannelOptions = {
      offer: boolean
      signal: (signal: PeerSignal) => void
      message: (data: string | Uint8Array) => void
      ready: () => void
      closed: () => void
    }
    type PeerChannelInstance = {
      send(data: string | Uint8Array): Promise<boolean>
      receiveSignal(signal: unknown): void
      close(): void
    }
    type PeerChannelConstructor = new (options: PeerChannelOptions) => PeerChannelInstance
    type RemotePeerClientInstance = {
      subscribe(callback: (status: string) => void): () => void
      webSocket(url: string | URL, protocols?: string | string[]): WebSocket
      close(): void
    }
    type RemotePeerClientConstructor = new (sessionID: string) => RemotePeerClientInstance
    const NativeWebSocket = window.WebSocket
    let host: PeerChannelInstance | undefined
    let signaling: SignalingSocket | undefined
    let relay: RelaySocket | undefined
    let requestedDirectSocket = false
    let directPath = ""

    class SignalingSocket extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
      readyState = SignalingSocket.CONNECTING

      constructor() {
        super()
        signaling = this
        queueMicrotask(() => {
          this.readyState = SignalingSocket.OPEN
          this.dispatchEvent(new Event("open"))
          this.receive({ type: "peer.ready", peerID: "abcdefghijklmnop" })
        })
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data !== "string") return
        const message = JSON.parse(data) as Record<string, unknown>
        if (message.type === "peer.signal") host?.receiveSignal(message.signal)
      }

      receive(message: Record<string, unknown>) {
        this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }))
      }

      close(code = 1000, reason = "") {
        if (this.readyState >= SignalingSocket.CLOSING) return
        this.readyState = SignalingSocket.CLOSED
        this.dispatchEvent(new CloseEvent("close", { code, reason }))
      }
    }

    class RelaySocket extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
      readyState = RelaySocket.CONNECTING
      binaryType: BinaryType = "blob"
      protocol = ""
      readonly url: string

      constructor(url: string | URL) {
        super()
        this.url = String(url)
        relay = this
        queueMicrotask(() => {
          this.readyState = RelaySocket.OPEN
          this.dispatchEvent(new Event("open"))
        })
      }

      send() {}

      close(code = 1000, reason = "") {
        if (this.readyState >= RelaySocket.CLOSING) return
        this.readyState = RelaySocket.CLOSED
        this.dispatchEvent(new CloseEvent("close", { code, reason }))
      }
    }

    const socketFactory = function (url: string | URL) {
      if (new URL(String(url), location.href).pathname === "/_remote/peer") return new SignalingSocket()
      return new RelaySocket(url)
    }
    Object.assign(socketFactory, {
      CONNECTING: WebSocket.CONNECTING,
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      CLOSED: WebSocket.CLOSED,
    })
    Object.defineProperty(window, "WebSocket", { configurable: true, value: socketFactory })
    const [{ PeerChannel }, { RemotePeerClient }] = await Promise.all([
      import(peerModule) as Promise<{ PeerChannel: PeerChannelConstructor }>,
      import(clientModule) as Promise<{ RemotePeerClient: RemotePeerClientConstructor }>,
    ])
    const sessionID = "abcdefghijklmnop"
    const client = new RemotePeerClient(sessionID)
    try {
      host = new PeerChannel({
        offer: true,
        signal: (signal) => signaling?.receive({ type: "peer.signal", signal }),
        message: (data) => {
          if (typeof data !== "string") return
          const message = JSON.parse(data) as Record<string, unknown>
          if (message.type !== "socket.open" || typeof message.id !== "string") return
          requestedDirectSocket = true
          directPath = typeof message.path === "string" ? message.path : ""
          void (async () => {
            const close = JSON.stringify({
              type: "socket.close",
              id: message.id,
              code: 1013,
              reason: "Direct socket unavailable",
            })
            await host?.send(close)
            // WebSocket implementations can emit error followed by close.
            // A late duplicate must not tear down an already-open Relay socket.
            await host?.send(close)
          })()
        },
        ready: () => undefined,
        closed: () => undefined,
      })
      await new Promise<void>((resolve, reject) => {
        let unsubscribe: () => void = () => undefined
        unsubscribe = client.subscribe((status) => {
          if (status === "direct") {
            unsubscribe()
            resolve()
            return
          }
          if (status === "unavailable") {
            unsubscribe()
            reject(new Error(`Direct peer failed before becoming ready: ${status}`))
          }
        })
      })
      const socket = client.webSocket(`ws://${location.host}/pty`)
      await new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true })
        socket.addEventListener("error", () => reject(new Error("Relay fallback failed to open")), { once: true })
      })
      socket.binaryType = "arraybuffer"
      await new Promise((resolve) => setTimeout(resolve, 0))
      const target = new URL(relay?.url ?? "", location.href)
      const output = {
        directAttempted: requestedDirectSocket,
        directPath,
        relayPath: target.pathname,
        relaySession: target.searchParams.get("_oc_remote_session"),
        binaryTypeApplied: relay?.binaryType,
        relaySocketRemainsOpen: socket.readyState === WebSocket.OPEN,
      }
      socket.close()
      client.close()
      return output
    } finally {
      client.close()
      host?.close()
      Object.defineProperty(window, "WebSocket", { configurable: true, value: NativeWebSocket })
    }
  }, {
    peerModule: moduleURL("remote-relay/src/peer.ts"),
    clientModule: moduleURL("app/src/utils/remote-peer.ts"),
  })

  expect(result).toEqual({
    directAttempted: true,
    directPath: "/pty",
    relayPath: "/pty",
    relaySession: "abcdefghijklmnop",
    binaryTypeApplied: "arraybuffer",
    relaySocketRemainsOpen: true,
  })
})

test("a rejected direct upload stops reading and sending its request body", async ({ page }) => {
  test.setTimeout(60_000)
  const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3000}`
  const origin = new URL(baseURL).origin
  const moduleURL = (file: string) => `/@fs${resolve(packageRoot, file)}`

  await page.route(`${origin}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>WebRTC upload harness</title>" }),
  )
  await page.route(`${origin}/_remote/capabilities`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ peerProtocol: 1, iceConfigured: true }) }),
  )
  await page.goto(origin)

  const result = await page.evaluate(async ({ peerModule, clientModule }) => {
    type PeerSignal =
      | { type: "offer" | "answer"; sdp: string }
      | { type: "candidate"; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
    type PeerChannelOptions = {
      offer: boolean
      signal: (signal: PeerSignal) => void
      message: (data: string | Uint8Array) => void
      ready: () => void
      closed: () => void
    }
    type PeerChannelInstance = {
      send(data: string | Uint8Array): Promise<boolean>
      receiveSignal(signal: unknown): void
      close(): void
    }
    type PeerChannelConstructor = new (options: PeerChannelOptions) => PeerChannelInstance
    type RemotePeerClientInstance = {
      fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response | undefined>
      subscribe(callback: (status: string) => void): () => void
      close(): void
    }
    type RemotePeerClientConstructor = new (sessionID: string) => RemotePeerClientInstance
    const NativeWebSocket = window.WebSocket
    let host: PeerChannelInstance | undefined
    let signaling: SignalingSocket | undefined
    let uploadID: string | undefined
    let uploadedBytes = 0
    let resolveCancelled!: () => void
    const cancelled = new Promise<void>((resolve) => { resolveCancelled = resolve })

    class SignalingSocket extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
      readyState = SignalingSocket.CONNECTING

      constructor() {
        super()
        signaling = this
        queueMicrotask(() => {
          this.readyState = SignalingSocket.OPEN
          this.dispatchEvent(new Event("open"))
          this.receive({ type: "peer.ready", peerID: "abcdefghijklmnop" })
        })
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data !== "string") return
        const message = JSON.parse(data) as Record<string, unknown>
        if (message.type === "peer.signal") host?.receiveSignal(message.signal)
      }

      receive(message: Record<string, unknown>) {
        this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }))
      }

      close(code = 1000, reason = "") {
        if (this.readyState >= SignalingSocket.CLOSING) return
        this.readyState = SignalingSocket.CLOSED
        this.dispatchEvent(new CloseEvent("close", { code, reason }))
      }
    }

    Object.defineProperty(window, "WebSocket", { configurable: true, value: SignalingSocket })
    const [{ PeerChannel }, { RemotePeerClient }] = await Promise.all([
      import(peerModule) as Promise<{ PeerChannel: PeerChannelConstructor }>,
      import(clientModule) as Promise<{ RemotePeerClient: RemotePeerClientConstructor }>,
    ])
    const client = new RemotePeerClient("abcdefghijklmnop")
    try {
      host = new PeerChannel({
        offer: true,
        signal: (signal) => signaling?.receive({ type: "peer.signal", signal }),
        message: (data) => {
          if (data instanceof Uint8Array) {
            if (data[0] !== 0xc1 || data[1] !== 1) return
            const id = new TextDecoder().decode(data.subarray(3, 15)).replace(/\0+$/, "")
            if (id === uploadID) uploadedBytes += data.byteLength - 15
            return
          }
          const message = JSON.parse(data) as Record<string, unknown>
          if (message.type === "request.start" && message.path === "/upload-abort" && typeof message.id === "string") {
            uploadID = message.id
            void host?.send(JSON.stringify({ type: "response.error", id: uploadID, message: "Upload rejected" }))
          }
          if (message.type === "request.cancel" && message.id === uploadID) resolveCancelled()
        },
        ready: () => undefined,
        closed: () => undefined,
      })
      await new Promise<void>((resolve, reject) => {
        let unsubscribe: () => void = () => undefined
        unsubscribe = client.subscribe((status) => {
          if (status === "direct") {
            unsubscribe()
            resolve()
            return
          }
          if (status === "unavailable") {
            unsubscribe()
            reject(new Error(`Direct peer failed before becoming ready: ${status}`))
          }
        })
      })
      const upload = client.fetch(new Request(`${location.origin}/upload-abort`, {
        method: "POST",
        body: new Blob([new Uint8Array(8 * 1024 * 1024)]),
      })).then(() => false, () => true)
      const failed = await upload
      await cancelled
      return { failed, uploadedBytes, uploadID: !!uploadID }
    } finally {
      client.close()
      host?.close()
      Object.defineProperty(window, "WebSocket", { configurable: true, value: NativeWebSocket })
    }
  }, {
    peerModule: moduleURL("remote-relay/src/peer.ts"),
    clientModule: moduleURL("app/src/utils/remote-peer.ts"),
  })

  expect(result.failed).toBe(true)
  expect(result.uploadedBytes).toBeLessThan(8 * 1024 * 1024)
  expect(result.uploadID).toBe(true)
})

test("legacy relay skips peer signaling and keeps the relay WebSocket path", async ({ page }) => {
  const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3000}`
  const origin = new URL(baseURL).origin

  await page.route(`${origin}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Legacy Relay harness</title>" }),
  )
  await page.route(`${origin}/_remote/capabilities`, (route) => route.fulfill({ status: 404, body: "Not found" }))
  await page.goto(origin)

  const result = await page.evaluate(async ({ clientModule }) => {
    type RemotePeerClientInstance = {
      subscribe(callback: (status: string) => void): () => void
      webSocket(url: string | URL, protocols?: string | string[]): WebSocket
      close(): void
    }
    type RemotePeerClientConstructor = new (sessionID: string) => RemotePeerClientInstance
    const NativeWebSocket = window.WebSocket
    const urls: string[] = []

    class TestSocket extends EventTarget {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
      readyState = TestSocket.CONNECTING
      binaryType: BinaryType = "blob"
      bufferedAmount = 0
      extensions = ""
      protocol = ""
      url: string
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      onclose: ((event: CloseEvent) => void) | null = null

      constructor(url: string | URL) {
        super()
        this.url = String(url)
        urls.push(this.url)
      }

      send() {}
      close() { this.readyState = TestSocket.CLOSED }
    }

    Object.defineProperty(window, "WebSocket", { configurable: true, value: TestSocket })
    const { RemotePeerClient } = await import(clientModule) as { RemotePeerClient: RemotePeerClientConstructor }
    const client = new RemotePeerClient("abcdefghijklmnop")
    try {
      const unavailable = await new Promise<string>((resolve) => {
        let unsubscribe: () => void = () => undefined
        unsubscribe = client.subscribe((status) => {
          if (status !== "unavailable") return
          unsubscribe()
          resolve(status)
        })
      })
      const socket = client.webSocket(`${location.origin.replace(/^http/, "ws")}/pty`)
      const relayURL = new URL((socket as unknown as TestSocket).url)
      socket.close()
      return {
        unavailable,
        relayPath: relayURL.pathname,
        relaySession: relayURL.searchParams.get("_oc_remote_session"),
        socketCount: urls.length,
      }
    } finally {
      client.close()
      Object.defineProperty(window, "WebSocket", { configurable: true, value: NativeWebSocket })
    }
  }, { clientModule: `/@fs${resolve(packageRoot, "app/src/utils/remote-peer.ts")}` })

  expect(result).toEqual({
    unavailable: "unavailable",
    relayPath: "/pty",
    relaySession: "abcdefghijklmnop",
    socketCount: 1,
  })
})
