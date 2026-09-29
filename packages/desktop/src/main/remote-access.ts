import { decodeBase64, encodeBase64, randomToken, relayMessage } from "@openctrlc/remote-relay/protocol"
import type { RemoteAccessPairRequest, RemoteAccessState, RemoteWorkspaceSnapshot } from "@openctrlc/app"
import type { ServerReadyData } from "../preload/types"

type InboundHTTP = {
  controller?: ReadableStreamDefaultController<Uint8Array>
  aborted: AbortController
}

const heartbeatInterval = 30_000
const heartbeatTimeout = 90_000
const reconnectGrace = 3 * 60_000
const reconnectDelays = [1_000, 2_000, 4_000, 8_000, 10_000]

class RemoteSessionUnavailable extends Error {}

export class RemoteAccessService {
  #state: RemoteAccessState = { status: "stopped", pendingRequests: [], authorizedDevices: 0 }
  #listeners = new Set<(state: RemoteAccessState) => void>()
  #socket?: WebSocket
  #heartbeat?: ReturnType<typeof setInterval>
  #pendingPings = new Map<string, number>()
  #heartbeatSuspended = false
  #pendingRevocations = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
  >()
  #sessionID?: string
  #hostToken?: string
  #server?: ServerReadyData
  #requests = new Map<string, InboundHTTP>()
  #localSockets = new Map<string, WebSocket>()
  #notifiedPairRequests = new Set<string>()
  #starting?: Promise<RemoteAccessState>
  #reconnectTimer?: ReturnType<typeof setTimeout>
  #reconnectUntil?: number
  #reconnectAttempt = 0
  #generation = 0
  #workspace?: RemoteWorkspaceSnapshot
  #workspaceJSON?: string

  constructor(
    private readonly getServer: () => Promise<ServerReadyData>,
    private readonly onError: (error: unknown) => void,
  ) {}

  getState() {
    return this.#state
  }

  updateWorkspace(snapshot: RemoteWorkspaceSnapshot) {
    if (!snapshot || !Array.isArray(snapshot.projects) || !Array.isArray(snapshot.sessionIDs)) return
    const workspace: RemoteWorkspaceSnapshot = {
      projects: snapshot.projects
        .slice(0, 128)
        .filter((project) => project && typeof project.worktree === "string" && project.worktree.length <= 4096)
        .map((project) => ({ worktree: project.worktree, expanded: project.expanded === true })),
      ...(typeof snapshot.lastProject === "string" && snapshot.lastProject.length <= 4096
        ? { lastProject: snapshot.lastProject }
        : {}),
      sessionIDs: [
        ...new Set(snapshot.sessionIDs.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 200)),
      ].slice(0, 128),
      ...(typeof snapshot.activeSessionID === "string" && snapshot.activeSessionID.length <= 200
        ? { activeSessionID: snapshot.activeSessionID }
        : {}),
    }
    if (workspace.activeSessionID && !workspace.sessionIDs.includes(workspace.activeSessionID)) {
      workspace.sessionIDs = [...workspace.sessionIDs.slice(0, 127), workspace.activeSessionID]
    }
    const serialized = JSON.stringify(workspace)
    if (serialized.length > 64 * 1024 || serialized === this.#workspaceJSON) return
    this.#workspace = workspace
    this.#workspaceJSON = serialized
    if (this.#state.status === "active") this.#send({ type: "workspace.update", workspace })
  }

  subscribe(listener: (state: RemoteAccessState) => void) {
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  start() {
    if (this.#starting) return this.#starting
    if (this.#state.status === "active" || this.#state.status === "reconnecting") return Promise.resolve(this.#state)
    const generation = ++this.#generation
    this.#clearReconnect()
    this.#notifiedPairRequests.clear()
    this.#setState({ status: "connecting", pendingRequests: [], authorizedDevices: 0 })
    this.#starting = this.#start(generation).finally(() => {
      this.#starting = undefined
    })
    return this.#starting
  }

  async stop() {
    const socket = this.#socket
    const sessionID = this.#sessionID
    const hostToken = this.#hostToken
    let stopRequest: Promise<void> | undefined
    ++this.#generation
    this.#clearReconnect()
    if (this.#heartbeat) clearInterval(this.#heartbeat)
    this.#heartbeat = undefined
    this.#pendingPings.clear()
    this.#rejectPendingRevocations(new Error("Mobile access stopped"))
    if (socket?.readyState === WebSocket.OPEN && sessionID && hostToken) {
      socket.send(JSON.stringify({ type: "session.stop", sessionID, hostToken }))
    } else if (sessionID && hostToken) {
      stopRequest = this.#sendStopOnNewSocket(sessionID, hostToken)
    }
    this.#setState({ status: "stopped", pendingRequests: [], authorizedDevices: 0 })
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
    await stopRequest
  }

  #sendStopOnNewSocket(sessionID: string, hostToken: string) {
    const relay = process.env.OPENCTRLC_REMOTE_RELAY_URL ?? "wss://openctrlc-remote.quniv.cn/v1/host"
    return new Promise<void>((resolve) => {
      let timeout: ReturnType<typeof setTimeout> | undefined
      let settled = false
      const finish = (socket?: WebSocket) => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Mobile access stopped")
        resolve()
      }
      let socket: WebSocket
      try {
        socket = new WebSocket(relay)
      } catch {
        finish()
        return
      }
      timeout = setTimeout(() => finish(socket), 2_500)
      socket.addEventListener(
        "open",
        () => {
          try {
            socket.send(JSON.stringify({ type: "session.stop", sessionID, hostToken }))
          } catch {
            finish(socket)
          }
        },
        { once: true },
      )
      socket.addEventListener("message", (event) => {
        const message = relayMessage(event.data)
        if (message?.type === "session.stopped") finish(socket)
      })
      socket.addEventListener("close", () => finish(), { once: true })
      socket.addEventListener("error", () => finish(socket), { once: true })
    })
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

  revokeViewer(viewerID: string) {
    if (!/^[A-Za-z0-9_-]{8,24}$/.test(viewerID)) return Promise.reject(new Error("Invalid browser authorization"))
    if (this.#pendingRevocations.has(viewerID)) return Promise.reject(new Error("Revocation is already pending"))
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingRevocations.delete(viewerID)
        reject(new Error("The relay did not confirm the browser revocation"))
      }, 8_000)
      this.#pendingRevocations.set(viewerID, { resolve, reject, timeout })
      if (this.#send({ type: "viewer.revoke", viewerID })) return
      clearTimeout(timeout)
      this.#pendingRevocations.delete(viewerID)
      reject(new Error("The relay is not connected"))
    })
  }

  suspendHeartbeat() {
    this.#heartbeatSuspended = true
    if (this.#heartbeat) clearInterval(this.#heartbeat)
    this.#heartbeat = undefined
    this.#pendingPings.clear()
  }

  resumeHeartbeat() {
    this.#heartbeatSuspended = false
    if (this.#state.status === "active" && this.#socket) this.#startHeartbeat(this.#socket)
  }

  async #start(generation: number) {
    try {
      this.#server = await this.getServer()
      if (generation !== this.#generation || this.#state.status === "stopped") return this.#state
      const relay = process.env.OPENCTRLC_REMOTE_RELAY_URL ?? "wss://openctrlc-remote.quniv.cn/v1/host"
      await this.#connect(relay, generation, false)
      return this.#state
    } catch (error) {
      if (this.#state.status === "connecting") {
        this.#setState({
          status: "error",
          pendingRequests: [],
          authorizedDevices: 0,
          error: error instanceof Error ? error.message : "Could not start remote access",
        })
      }
      throw error
    }
  }

  #connect(relay: string, generation: number, resume: boolean) {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(relay)
      this.#socket = socket
      let connected = false
      let settled = false
      let timeout: ReturnType<typeof setTimeout>
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (this.#socket === socket) this.#socket = undefined
        if (socket.readyState < WebSocket.CLOSING) socket.close()
        reject(error)
      }
      timeout = setTimeout(() => fail(new Error("Relay connection timed out")), resume ? 12_000 : 20_000)
      const activate = (url: string) => {
        if (generation !== this.#generation || this.#state.status === "stopped") {
          fail(new Error("Mobile access stopped"))
          return
        }
        connected = true
        settled = true
        clearTimeout(timeout)
        this.#notifiedPairRequests.clear()
        this.#clearReconnect()
        this.#setState({ status: "active", url, pendingRequests: [], authorizedDevices: 0 })
        this.#startHeartbeat(socket)
        if (this.#workspace) this.#send({ type: "workspace.update", workspace: this.#workspace })
        resolve()
      }
      socket.addEventListener(
        "open",
        () => {
          if (generation !== this.#generation || this.#state.status === "stopped") {
            socket.close(1000, "Mobile access stopped")
            return
          }
          try {
            socket.send(
              JSON.stringify(
                resume
                  ? { type: "session.resume", sessionID: this.#sessionID, hostToken: this.#hostToken }
                  : { type: "session.create" },
              ),
            )
          } catch {
            fail(new Error("Could not send the Relay handshake"))
          }
        },
        { once: true },
      )
      socket.addEventListener("message", (event) => {
        if (settled && !connected) return
        const message = relayMessage(event.data)
        if (!message || typeof message.type !== "string") return
        if (!resume && message.type === "session.created") {
          if (
            typeof message.sessionID !== "string" ||
            typeof message.hostToken !== "string" ||
            typeof message.url !== "string"
          ) {
            fail(new Error("The relay returned an invalid session"))
            return
          }
          if (generation !== this.#generation || this.#state.status === "stopped") {
            socket.send(
              JSON.stringify({
                type: "session.stop",
                sessionID: message.sessionID,
                hostToken: message.hostToken,
              }),
            )
            socket.close(1000, "Mobile access stopped")
            return
          }
          this.#sessionID = message.sessionID
          this.#hostToken = message.hostToken
          activate(message.url)
          return
        }
        if (resume && message.type === "session.resumed") {
          if (
            message.sessionID !== this.#sessionID ||
            message.hostToken !== this.#hostToken ||
            typeof message.url !== "string"
          ) {
            fail(new RemoteSessionUnavailable("The relay could not restore the previous session"))
            return
          }
          activate(message.url)
          return
        }
        if (resume && message.type === "session.resume.error") {
          fail(new RemoteSessionUnavailable("The remote session is no longer available"))
          return
        }
        this.#handleMessage(message)
        if (!resume && message.type === "pair.error" && this.#state.status === "connecting") {
          fail(new Error(typeof message.message === "string" ? message.message : "Relay rejected the connection"))
        }
      })
      socket.addEventListener("error", () => {
        if (connected) {
          socket.close()
          return
        }
        fail(new Error("Could not connect to the OpenCtrlC Remote Relay"))
      })
      socket.addEventListener("close", (event) => {
        clearTimeout(timeout)
        if (this.#socket !== socket || generation !== this.#generation) return
        if (!connected) {
          fail(new Error(event.reason || "The relay connection ended before it was ready"))
          return
        }
        this.#handleDisconnect(socket, generation, event.reason || "The remote relay connection ended")
      })
    })
  }

  #handleDisconnect(socket: WebSocket, generation: number, reason: string) {
    if (this.#socket !== socket || generation !== this.#generation) return
    if (this.#heartbeat) clearInterval(this.#heartbeat)
    this.#heartbeat = undefined
    this.#pendingPings.clear()
    this.#socket = undefined
    const error = new Error("Remote relay disconnected")
    this.#rejectPendingRevocations(error)
    for (const request of this.#requests.values()) {
      request.aborted.abort()
      try {
        request.controller?.error(error)
      } catch {}
    }
    this.#requests.clear()
    for (const local of this.#localSockets.values()) local.close(1001, "Remote relay disconnected")
    this.#localSockets.clear()
    if (this.#sessionID && this.#hostToken && this.#server && this.#state.status === "active") {
      this.#reconnectUntil = Date.now() + reconnectGrace
      this.#reconnectAttempt = 0
      this.#notifiedPairRequests.clear()
      this.#setState({ ...this.#state, status: "reconnecting", pendingRequests: [], error: undefined })
      this.#scheduleReconnect(generation)
      return
    }
    this.#setState({ status: "error", pendingRequests: [], authorizedDevices: 0, error: reason })
    this.onError(new Error(reason))
  }

  #scheduleReconnect(generation: number) {
    if (generation !== this.#generation || this.#state.status !== "reconnecting") return
    const until = this.#reconnectUntil
    if (!until || until <= Date.now()) {
      this.#endReconnect(generation)
      return
    }
    const delay = reconnectDelays[Math.min(this.#reconnectAttempt, reconnectDelays.length - 1)]
    this.#reconnectAttempt += 1
    this.#reconnectTimer = setTimeout(
      () => {
        this.#reconnectTimer = undefined
        void this.#resume(generation)
      },
      Math.min(delay, until - Date.now()),
    )
  }

  async #resume(generation: number) {
    if (generation !== this.#generation || this.#state.status !== "reconnecting") return
    if (!this.#reconnectUntil || this.#reconnectUntil <= Date.now()) {
      this.#endReconnect(generation)
      return
    }
    const relay = process.env.OPENCTRLC_REMOTE_RELAY_URL ?? "wss://openctrlc-remote.quniv.cn/v1/host"
    try {
      await this.#connect(relay, generation, true)
    } catch (error) {
      if (generation !== this.#generation || this.#state.status !== "reconnecting") return
      if (error instanceof RemoteSessionUnavailable) {
        this.#endReconnect(generation)
        return
      }
      this.#scheduleReconnect(generation)
    }
  }

  #endReconnect(generation: number) {
    if (generation !== this.#generation || this.#state.status !== "reconnecting") return
    this.#clearReconnect()
    this.#sessionID = undefined
    this.#hostToken = undefined
    this.#server = undefined
    this.#notifiedPairRequests.clear()
    const error = "Could not restore the remote session"
    this.#setState({ status: "error", pendingRequests: [], authorizedDevices: 0, error: "reconnect-failed" })
    this.onError(new Error(error))
  }

  #clearReconnect() {
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer)
    this.#reconnectTimer = undefined
    this.#reconnectUntil = undefined
    this.#reconnectAttempt = 0
  }

  #startHeartbeat(socket: WebSocket) {
    if (this.#heartbeat) clearInterval(this.#heartbeat)
    this.#heartbeat = undefined
    this.#pendingPings.clear()
    if (this.#heartbeatSuspended || socket !== this.#socket || this.#state.status !== "active") return
    const ping = () => {
      if (this.#heartbeatSuspended || socket !== this.#socket || socket.readyState !== WebSocket.OPEN) return
      if ([...this.#pendingPings.values()].some((sentAt) => Date.now() - sentAt >= heartbeatTimeout)) {
        socket.close(4000, "Relay heartbeat timed out")
        return
      }
      const pingID = randomToken(12)
      this.#pendingPings.set(pingID, Date.now())
      if (!this.#send({ type: "session.ping", pingID })) socket.close(4000, "Could not send relay heartbeat")
    }
    ping()
    this.#heartbeat = setInterval(ping, heartbeatInterval)
  }

  #rejectPendingRevocations(error: Error) {
    for (const [viewerID, pending] of this.#pendingRevocations) {
      clearTimeout(pending.timeout)
      pending.reject(error)
      this.#pendingRevocations.delete(viewerID)
    }
  }

  #handleMessage(message: Record<string, unknown>) {
    if (message.type === "session.pong") {
      if (typeof message.pingID === "string") this.#pendingPings.delete(message.pingID)
      else this.#pendingPings.clear()
      return
    }
    if (message.type === "viewer.list" && Array.isArray(message.devices)) {
      const authorizedViewers = message.devices.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const device = item as Record<string, unknown>
        if (typeof device.id !== "string" || !/^[A-Za-z0-9_-]{8,24}$/.test(device.id)) return []
        if (typeof device.device !== "string" || device.device.length > 80) return []
        return [{ id: device.id, device: device.device }]
      })
      this.#setState({ ...this.#state, authorizedDevices: Math.min(3, authorizedViewers.length), authorizedViewers })
      return
    }
    if (
      (message.type === "viewer.revoked" || message.type === "viewer.revoke.error") &&
      typeof message.viewerID === "string"
    ) {
      const pending = this.#pendingRevocations.get(message.viewerID)
      if (!pending) return
      clearTimeout(pending.timeout)
      this.#pendingRevocations.delete(message.viewerID)
      if (message.type === "viewer.revoked") pending.resolve()
      else pending.reject(new Error("The browser authorization is no longer available"))
      return
    }
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
      })
      return
    }
    if (message.type === "viewer.count" && typeof message.count === "number") {
      this.#setState({ ...this.#state, authorizedDevices: Math.min(3, Math.max(0, Math.floor(message.count))) })
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
                "content-encoding",
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
