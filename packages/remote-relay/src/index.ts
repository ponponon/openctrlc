import {
  decodeBase64,
  encodeBase64,
  isViewerLimit,
  randomToken,
  relayMessage,
  type RelayServerMessage,
  type RelayWorkspaceSnapshot,
} from "./protocol"

type SocketData = {
  role: "host" | "viewer"
  sessionID?: string
  pairID?: string
  mode?: "pair" | "proxy"
  id?: string
  path?: string
  protocols?: string[]
  device?: string
  clientIP?: string
  viewerToken?: string
  ready?: boolean
  queue?: Array<{ data: string; binary: boolean; size: number }>
}

type PendingPair = {
  socket: Bun.ServerWebSocket<SocketData>
  viewerToken: string
  device: string
  expiresAt: number
}

type PendingResponse = {
  resolveHeaders: (value: { status: number; headers: Record<string, string> }) => void
  rejectHeaders: (error: Error) => void
  controller?: ReadableStreamDefaultController<Uint8Array>
  closed: boolean
}

type RelaySession = {
  id: string
  hostToken: string
  joinToken: string
  viewerLimit: number
  host?: Bun.ServerWebSocket<SocketData>
  pairingSockets: Set<Bun.ServerWebSocket<SocketData>>
  pairs: Map<string, PendingPair>
  viewers: Map<string, ViewerGrant>
  responses: Map<string, PendingResponse>
  sockets: Map<string, Bun.ServerWebSocket<SocketData>>
  resumeUntil?: number
  resumeTimer?: ReturnType<typeof setTimeout>
  workspace?: RelayWorkspaceSnapshot
}

type ViewerGrant = {
  session: RelaySession
  id: string
  device: string
  expiresAt: number
}

const port = Number(process.env.PORT ?? 4097)
const publicURL = new URL(process.env.OPENCTRLC_REMOTE_PUBLIC_URL ?? "https://openctrlc-remote.quniv.cn")
const maxRequestBytes = 16 * 1024 * 1024
const maxPendingRequests = 64
const maxSockets = 32
const maxSocketQueueBytes = 512 * 1024
const legacyViewerLimit = 3
const viewerLifetime = 30 * 24 * 60 * 60 * 1000
const viewerCookieLifetimeSeconds = Math.floor(viewerLifetime / 1000)
const pairLifetime = 5 * 60 * 1000
const hostReconnectGrace = 3 * 60 * 1000
const sessions = new Map<string, RelaySession>()
const viewerTokens = new Map<string, ViewerGrant>()
const createRates = new Map<string, number[]>()

const server = Bun.serve<SocketData>({
  hostname: process.env.HOST ?? "0.0.0.0",
  port,
  maxRequestBodySize: maxRequestBytes + 1024,
  fetch(request, server) {
    const url = new URL(request.url)
    if (url.pathname === "/healthz") return Response.json({ ok: true, sessions: sessions.size })
    if (url.pathname === "/v1/host" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      if (request.headers.has("origin") && !sameOrigin(request)) return new Response("Origin rejected", { status: 403 })
      if (server.upgrade(request, { data: { role: "host", clientIP: request.headers.get("x-real-ip") ?? "unknown" } }))
        return
      return new Response("WebSocket upgrade required", { status: 426 })
    }
    if (url.pathname === "/v1/viewer" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const sessionID = url.searchParams.get("session")
      if (!sessionID || !sessions.has(sessionID)) return new Response("Session not found", { status: 404 })
      if (!sameOrigin(request)) return new Response("Origin rejected", { status: 403 })
      if (
        server.upgrade(request, {
          data: { role: "viewer", sessionID, mode: "pair", device: deviceLabel(request.headers.get("user-agent")) },
        })
      )
        return
      return new Response("WebSocket upgrade required", { status: 426 })
    }
    if (request.method === "GET" && url.pathname.startsWith("/join/")) {
      const sessionID = url.pathname.slice("/join/".length)
      if (!sessions.has(sessionID)) return htmlResponse(pairPage("expired"))
      return htmlResponse(pairPage("pair"))
    }
    if (request.method === "POST" && url.pathname === "/_remote/claim") return claimViewer(request)
    if (request.method === "GET" && url.pathname === "/") {
      const viewer = sessionFor(request)
      if (!viewer) return htmlResponse(pairPage("home"))
      if (!hasWorkspaceBootstrapCookie(request)) return workspaceBootstrapResponse(viewer.session.workspace, "/")
      return proxyRequest(viewer.session, request, viewer.token)
    }

    const viewer = sessionFor(request)
    if (!viewer) return new Response("Remote session required", { status: 401, headers: noStore })
    const session = viewer.session
    if (request.method === "GET" && request.headers.get("sec-fetch-dest") === "document") {
      if (!hasWorkspaceBootstrapCookie(request)) {
        return workspaceBootstrapResponse(viewer.session.workspace, url.pathname + url.search)
      }
    }
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      if (!sameOrigin(request)) return new Response("Origin rejected", { status: 403, headers: noStore })
      if (session.sockets.size >= maxSockets)
        return new Response("Too many remote connections", { status: 429, headers: noStore })
      const protocols = (request.headers.get("sec-websocket-protocol") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      if (protocols.length)
        return new Response("WebSocket subprotocols are not supported", { status: 400, headers: noStore })
      if (
        server.upgrade(request, {
          data: {
            role: "viewer",
            sessionID: session.id,
            mode: "proxy",
            viewerToken: viewer.token,
            id: randomToken(12),
            path: url.pathname + url.search,
            protocols,
            device: deviceLabel(request.headers.get("user-agent")),
            ready: false,
            queue: [],
          },
        })
      )
        return
      return new Response("WebSocket upgrade required", { status: 426 })
    }
    return proxyRequest(session, request, viewer.token)
  },
  websocket: {
    maxPayloadLength: 2 * 1024 * 1024,
    idleTimeout: 0,
    open(socket) {
      if (socket.data.role === "host") return
      const session = socket.data.sessionID ? sessions.get(socket.data.sessionID) : undefined
      if (!session) return socket.close(4404, "Session not found")
      if (socket.data.mode === "pair") {
        if (session.pairingSockets.size >= session.viewerLimit + 2)
          return socket.close(4429, "Too many pairing attempts")
        session.pairingSockets.add(socket)
        return
      }
      const id = socket.data.id
      if (!id || !socket.data.path) return socket.close(4400, "Invalid tunnel")
      session.sockets.set(id, socket)
      if (!sendHost(session, { type: "socket.open", id, path: socket.data.path, protocols: [] })) {
        socket.close(1011, "Desktop is disconnected")
        session.sockets.delete(id)
      }
    },
    async message(socket, raw) {
      if (socket.data.role === "host") {
        const message = relayMessage(raw)
        if (!message || typeof message.type !== "string") return socket.close(4400, "Invalid message")
        await handleHostMessage(socket, message)
        return
      }
      const session = socket.data.sessionID ? sessions.get(socket.data.sessionID) : undefined
      if (!session) return socket.close(4404, "Session not found")
      if (socket.data.mode === "proxy") {
        const id = socket.data.id
        if (!id) return socket.close(4400, "Invalid tunnel")
        if (!socket.data.viewerToken || !touchViewer(session, socket.data.viewerToken)) {
          session.sockets.delete(id)
          return socket.close(4401, "Browser authorization expired")
        }
        const binary = typeof raw !== "string"
        const data =
          typeof raw === "string"
            ? raw
            : encodeBase64(
                raw instanceof ArrayBuffer
                  ? new Uint8Array(raw)
                  : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength),
              )
        if (!socket.data.ready) {
          const size = typeof raw === "string" ? new TextEncoder().encode(raw).byteLength : raw.byteLength
          const queue = socket.data.queue ?? (socket.data.queue = [])
          if (queue.reduce((total, frame) => total + frame.size, 0) + size > maxSocketQueueBytes) {
            socket.close(1009, "WebSocket buffer limit exceeded")
            return
          }
          queue.push({ data, binary, size })
          return
        }
        if (!sendHost(session, { type: "socket.message", id, data, binary }))
          socket.close(1011, "Desktop is disconnected")
        return
      }
      const message = relayMessage(raw)
      if (!message || message.type !== "pair" || typeof message.joinToken !== "string") {
        return socket.close(4400, "Pairing message required")
      }
      if (message.joinToken !== session.joinToken) return socket.close(4403, "Invalid pairing link")
      pruneExpiredViewers(session)
      if (session.viewers.size + session.pairs.size >= session.viewerLimit) {
        socket.send(JSON.stringify({ type: "pair.error" }))
        return socket.close(4429, "Too many devices")
      }
      const pairID = randomToken(18)
      socket.data.pairID = pairID
      session.pairs.set(pairID, {
        socket,
        viewerToken: randomToken(),
        device: socket.data.device ?? "Browser",
        expiresAt: Date.now() + pairLifetime,
      })
      if (
        !sendHost(session, {
          type: "pair.request",
          pairID,
          device: socket.data.device ?? "Browser",
        })
      ) {
        session.pairs.delete(pairID)
        socket.send(JSON.stringify({ type: "pair.error" }))
        return socket.close(1011, "Desktop is disconnected")
      }
      socket.send(JSON.stringify({ type: "pair.waiting", pairID }))
    },
    close(socket) {
      if (socket.data.role === "host") {
        const session = socket.data.sessionID ? sessions.get(socket.data.sessionID) : undefined
        if (session?.host === socket) suspendHost(session, socket)
        return
      }
      if (!socket.data.sessionID) return
      const session = sessions.get(socket.data.sessionID)
      if (!session) return
      session.pairingSockets.delete(socket)
      if (socket.data.pairID) {
        const pair = session.pairs.get(socket.data.pairID)
        if (pair) {
          session.pairs.delete(socket.data.pairID)
          sendHost(session, { type: "pair.denied", pairID: socket.data.pairID })
        }
      }
      if (socket.data.mode === "proxy" && socket.data.id) {
        session.sockets.delete(socket.data.id)
        sendHost(session, { type: "socket.close", id: socket.data.id, code: 1000, reason: "Viewer disconnected" })
      }
    },
  },
})

console.log(`OpenCtrlC Remote Relay listening on ${server.hostname}:${server.port}`)

async function handleHostMessage(socket: Bun.ServerWebSocket<SocketData>, value: Record<string, unknown>) {
  if (value.type === "session.stop" && !socket.data.sessionID) {
    const session = typeof value.sessionID === "string" ? sessions.get(value.sessionID) : undefined
    if (!session || value.hostToken !== session.hostToken) {
      socket.close(4404, "Session unavailable")
      return
    }
    const previous = session.host
    deleteSession(session)
    if (previous && previous !== socket) previous.close(1000, "Mobile access stopped")
    socket.send(JSON.stringify({ type: "session.stopped" } satisfies RelayServerMessage))
    socket.close(1000, "Session stopped")
    return
  }

  if (value.type === "session.resume") {
    const session = typeof value.sessionID === "string" ? sessions.get(value.sessionID) : undefined
    if (
      !session ||
      value.hostToken !== session.hostToken ||
      (session.resumeUntil && session.resumeUntil <= Date.now())
    ) {
      if (session?.resumeUntil && session.resumeUntil <= Date.now()) deleteSession(session)
      socket.send(JSON.stringify({ type: "session.resume.error", reason: "unavailable" } satisfies RelayServerMessage))
      socket.close(4404, "Session unavailable")
      return
    }
    if (session.host && session.host !== socket) {
      const previous = session.host
      suspendHost(session, previous)
      previous.close(4001, "Relay session resumed on a new connection")
    }
    if (session.resumeTimer) clearTimeout(session.resumeTimer)
    session.resumeTimer = undefined
    session.resumeUntil = undefined
    session.host = socket
    socket.data.sessionID = session.id
    socket.send(
      JSON.stringify({
        type: "session.resumed",
        sessionID: session.id,
        hostToken: session.hostToken,
        url: `${publicURL.origin}/join/${session.id}#${session.joinToken}`,
        viewerLimit: session.viewerLimit,
      } satisfies RelayServerMessage),
    )
    if (!pruneExpiredViewers(session)) sendViewerState(session)
    return
  }

  if (value.type === "session.create") {
    if (socket.data.sessionID) return socket.close(4400, "Session already exists")
    if (value.viewerLimit !== undefined && !isViewerLimit(value.viewerLimit)) {
      return socket.close(4400, "Invalid browser limit")
    }
    const address = socket.data.clientIP ?? "unknown"
    const attempts = (createRates.get(address) ?? []).filter((time) => Date.now() - time < 60 * 60 * 1000)
    if (attempts.length >= 60 || sessions.size >= 2000) {
      socket.send(JSON.stringify({ type: "pair.error" }))
      return socket.close(4429, "Relay limit reached")
    }
    attempts.push(Date.now())
    createRates.set(address, attempts)
    const session: RelaySession = {
      id: randomToken(12),
      hostToken: randomToken(),
      joinToken: randomToken(),
      viewerLimit: isViewerLimit(value.viewerLimit) ? value.viewerLimit : legacyViewerLimit,
      host: socket,
      pairingSockets: new Set(),
      pairs: new Map(),
      viewers: new Map(),
      responses: new Map(),
      sockets: new Map(),
    }
    socket.data.sessionID = session.id
    sessions.set(session.id, session)
    socket.send(
      JSON.stringify({
        type: "session.created",
        sessionID: session.id,
        hostToken: session.hostToken,
        joinToken: session.joinToken,
        url: `${publicURL.origin}/join/${session.id}#${session.joinToken}`,
        viewerLimit: session.viewerLimit,
      } satisfies RelayServerMessage),
    )
    sendViewerState(session)
    return
  }

  const session = typeof value.sessionID === "string" ? sessions.get(value.sessionID) : undefined
  if (!session || session.host !== socket || value.hostToken !== session.hostToken) {
    if (value.type === "request.start")
      socket.send(JSON.stringify({ type: "response.error", id: value.id, message: "Session authorization failed" }))
    return
  }
  if (value.type === "session.ping") {
    socket.send(
      JSON.stringify({
        type: "session.pong",
        ...(typeof value.pingID === "string" ? { pingID: value.pingID } : {}),
      } satisfies RelayServerMessage),
    )
    return
  }
  if (value.type === "session.limit.update") {
    if (!isViewerLimit(value.viewerLimit)) return
    session.viewerLimit = value.viewerLimit
    socket.send(
      JSON.stringify({ type: "session.limit.updated", viewerLimit: session.viewerLimit } satisfies RelayServerMessage),
    )
    return
  }
  if (value.type === "session.stop") {
    deleteSession(session)
    socket.send(JSON.stringify({ type: "session.stopped" } satisfies RelayServerMessage))
    socket.close(1000, "Session stopped")
    return
  }
  if (value.type === "pair.rotate") {
    session.joinToken = randomToken()
    for (const [pairID, pair] of session.pairs) {
      session.pairs.delete(pairID)
      pair.socket.send(JSON.stringify({ type: "pair.denied", pairID } satisfies RelayServerMessage))
      pair.socket.close(4403, "Pairing link rotated")
      socket.send(JSON.stringify({ type: "pair.denied", pairID } satisfies RelayServerMessage))
    }
    socket.send(
      JSON.stringify({
        type: "pair.rotated",
        joinToken: session.joinToken,
        url: `${publicURL.origin}/join/${session.id}#${session.joinToken}`,
      } satisfies RelayServerMessage),
    )
    return
  }
  if ((value.type === "pair.approve" || value.type === "pair.deny") && typeof value.pairID === "string") {
    const pair = session.pairs.get(value.pairID)
    if (!pair || pair.expiresAt <= Date.now()) return
    session.pairs.delete(value.pairID)
    if (value.type === "pair.deny") {
      pair.socket.send(JSON.stringify({ type: "pair.denied", pairID: value.pairID } satisfies RelayServerMessage))
      pair.socket.close(4403, "Request denied")
      socket.send(JSON.stringify({ type: "pair.denied", pairID: value.pairID } satisfies RelayServerMessage))
      return
    }
    if (session.viewers.size >= session.viewerLimit) {
      pair.socket.send(
        JSON.stringify({ type: "pair.error", message: "Browser limit reached" } satisfies RelayServerMessage),
      )
      pair.socket.close(4429, "Browser limit reached")
      socket.send(JSON.stringify({ type: "pair.denied", pairID: value.pairID } satisfies RelayServerMessage))
      return
    }
    const expiresAt = Date.now() + viewerLifetime
    const grant = {
      session,
      id: randomToken(8),
      device: pair.device,
      expiresAt,
    }
    session.viewers.set(pair.viewerToken, grant)
    viewerTokens.set(pair.viewerToken, grant)
    pair.socket.send(JSON.stringify({ type: "pair.approved", pairID: value.pairID, viewerToken: pair.viewerToken }))
    pair.socket.close(1000, "Approved")
    socket.send(JSON.stringify({ type: "pair.approved", pairID: value.pairID } satisfies RelayServerMessage))
    sendViewerState(session)
    return
  }
  if (value.type === "viewer.revoke") {
    if (typeof value.viewerID !== "string" || !/^[A-Za-z0-9_-]{8,24}$/.test(value.viewerID)) return
    const viewer = [...session.viewers.entries()].find(([, grant]) => grant.id === value.viewerID)
    if (!viewer) {
      sendHost(session, { type: "viewer.revoke.error", viewerID: value.viewerID })
      return
    }
    removeViewer(session, viewer[0], "Access revoked by desktop")
    sendViewerState(session)
    sendHost(session, { type: "viewer.revoked", viewerID: value.viewerID })
    return
  }
  if (value.type === "workspace.update") {
    const workspace = validateWorkspaceSnapshot(value.workspace)
    if (workspace) session.workspace = workspace
    return
  }
  if (value.type === "pair.received" && typeof value.pairID === "string") {
    const pair = session.pairs.get(value.pairID)
    if (pair && pair.expiresAt > Date.now()) {
      pair.socket.send(JSON.stringify({ type: "pair.delivered", pairID: value.pairID } satisfies RelayServerMessage))
    }
    return
  }
  if (typeof value.id !== "string") return
  if (value.type === "socket.opened") {
    const viewer = session.sockets.get(value.id)
    if (!viewer) return
    viewer.data.ready = true
    for (const frame of viewer.data.queue ?? []) {
      if (!sendHost(session, { type: "socket.message", id: value.id, data: frame.data, binary: frame.binary })) {
        viewer.close(1011, "Desktop is disconnected")
        session.sockets.delete(value.id)
        return
      }
    }
    viewer.data.queue = []
    return
  }
  if (value.type === "response.start") {
    const response = session.responses.get(value.id)
    if (!response || typeof value.status !== "number" || typeof value.headers !== "object" || !value.headers) return
    response.resolveHeaders({ status: value.status, headers: value.headers as Record<string, string> })
    return
  }
  if (value.type === "response.chunk") {
    const response = session.responses.get(value.id)
    if (!response?.controller || typeof value.data !== "string") return
    response.controller.enqueue(Uint8Array.from(atob(value.data), (character) => character.charCodeAt(0)))
    return
  }
  if (value.type === "response.end") {
    const response = session.responses.get(value.id)
    if (!response || response.closed) return
    response.closed = true
    response.controller?.close()
    session.responses.delete(value.id)
    return
  }
  if (value.type === "response.error") {
    const response = session.responses.get(value.id)
    if (!response || response.closed) return
    response.closed = true
    const error = new Error(typeof value.message === "string" ? value.message : "Remote request failed")
    response.rejectHeaders(error)
    response.controller?.error(error)
    session.responses.delete(value.id)
    return
  }
  if (value.type === "socket.message") {
    const viewer = session.sockets.get(value.id)
    if (!viewer || typeof value.data !== "string") return
    const binary = value.binary === true
    viewer.send(binary ? decodeBase64(value.data) : value.data, binary)
    return
  }
  if (value.type === "socket.close") {
    const viewer = session.sockets.get(value.id)
    if (viewer) viewer.close(closeCode(value.code), closeReason(value.reason))
    session.sockets.delete(value.id)
  }
}

async function proxyRequest(session: RelaySession, request: Request, viewerToken: string) {
  if (!session.host || session.host.readyState !== 1) return new Response("Desktop is disconnected", { status: 503 })
  if (request.headers.get("upgrade")) return new Response("Unsupported upgrade", { status: 400 })
  if (!sameOrigin(request)) return new Response("Origin rejected", { status: 403, headers: noStore })
  if (session.responses.size >= maxPendingRequests)
    return new Response("Too many remote requests", { status: 429, headers: noStore })
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > maxRequestBytes) return new Response("Request body is too large", { status: 413 })
  const id = randomToken(12)
  let resolveHeaders!: PendingResponse["resolveHeaders"]
  let rejectHeaders!: PendingResponse["rejectHeaders"]
  const headersPromise = new Promise<{ status: number; headers: Record<string, string> }>((resolve, reject) => {
    resolveHeaders = resolve
    rejectHeaders = reject
  })
  const pending: PendingResponse = {
    resolveHeaders,
    rejectHeaders,
    closed: false,
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      pending.controller = controller
    },
    cancel() {
      pending.closed = true
      session.responses.delete(id)
      sendHost(session, { type: "request.cancel", id })
    },
  })
  session.responses.set(id, pending)
  const headers = Object.fromEntries(
    [...request.headers.entries()].filter(
      ([name]) =>
        ![
          "cookie",
          "authorization",
          "host",
          "origin",
          "referer",
          "connection",
          "content-length",
          "transfer-encoding",
        ].includes(name.toLowerCase()),
    ),
  )
  const path = new URL(request.url).pathname + new URL(request.url).search
  if (!sendHost(session, { type: "request.start", id, method: request.method, path, headers })) {
    session.responses.delete(id)
    return new Response("Desktop is disconnected", { status: 503 })
  }
  void sendRequestBody(session, request, id)
  request.signal.addEventListener(
    "abort",
    () => {
      pending.closed = true
      session.responses.delete(id)
      sendHost(session, { type: "request.cancel", id })
    },
    { once: true },
  )
  try {
    const result = await headersPromise
    const responseHeaders = sanitizeResponseHeaders(result.headers)
    responseHeaders.set("set-cookie", viewerCookie(viewerToken))
    return new Response([204, 205, 304].includes(result.status) ? null : body, {
      status: result.status,
      headers: responseHeaders,
    })
  } catch {
    return new Response("Desktop request failed", { status: 502 })
  }
}

async function sendRequestBody(session: RelaySession, request: Request, id: string) {
  if (!request.body) {
    sendHost(session, { type: "request.end", id })
    return
  }
  const reader = request.body.getReader()
  let size = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      size += item.value.byteLength
      if (size > maxRequestBytes) {
        sendHost(session, { type: "request.cancel", id })
        const pending = session.responses.get(id)
        if (pending && !pending.closed) {
          pending.closed = true
          const error = new Error("Request body is too large")
          pending.rejectHeaders(error)
          pending.controller?.error(error)
          session.responses.delete(id)
        }
        return
      }
      for (let start = 0; start < item.value.length; start += 24 * 1024) {
        const chunk = item.value.subarray(start, start + 24 * 1024)
        sendHost(session, { type: "request.chunk", id, data: btoa(String.fromCharCode(...chunk)) })
      }
    }
    sendHost(session, { type: "request.end", id })
  } catch {
    sendHost(session, { type: "request.cancel", id })
    const pending = session.responses.get(id)
    if (pending && !pending.closed) {
      pending.closed = true
      const error = new Error("Request body could not be read")
      pending.rejectHeaders(error)
      pending.controller?.error(error)
      session.responses.delete(id)
    }
  }
}

async function claimViewer(request: Request) {
  if (!sameOrigin(request)) return new Response("Origin rejected", { status: 403 })
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return new Response("JSON claim required", { status: 415 })
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096)
    return new Response("Claim is too large", { status: 413 })
  const content = await request.text().catch(() => "")
  if (new TextEncoder().encode(content).byteLength > 4096) return new Response("Claim is too large", { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(content)
  } catch {}
  if (!body || typeof body !== "object" || !("viewerToken" in body) || typeof body.viewerToken !== "string") {
    return new Response("Invalid claim", { status: 400 })
  }
  const grant = viewerTokens.get(body.viewerToken)
  if (!grant || sessions.get(grant.session.id) !== grant.session)
    return new Response("Pairing expired", { status: 403 })
  if (grant.expiresAt <= Date.now()) {
    removeViewer(grant.session, body.viewerToken)
    sendViewerState(grant.session)
    return new Response("Pairing expired", { status: 403 })
  }
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie": viewerCookie(body.viewerToken),
      ...noStore,
    },
  })
}

function validateWorkspaceSnapshot(value: unknown): RelayWorkspaceSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.projects) || input.projects.length > 128) return
  if (!Array.isArray(input.sessionIDs) || input.sessionIDs.length > 128) return
  const projects = input.projects.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const project = item as Record<string, unknown>
    if (typeof project.worktree !== "string" || project.worktree.length > 4096) return []
    return [{ worktree: project.worktree, expanded: project.expanded === true }]
  })
  if (projects.length !== input.projects.length) return
  const sessionIDs = input.sessionIDs.filter(
    (item): item is string => typeof item === "string" && item.length > 0 && item.length <= 200,
  )
  if (sessionIDs.length !== input.sessionIDs.length) return
  if (input.lastProject !== undefined && (typeof input.lastProject !== "string" || input.lastProject.length > 4096))
    return
  if (
    input.activeSessionID !== undefined &&
    (typeof input.activeSessionID !== "string" ||
      input.activeSessionID.length === 0 ||
      input.activeSessionID.length > 200)
  )
    return
  const workspace = {
    projects,
    ...(typeof input.lastProject === "string" ? { lastProject: input.lastProject } : {}),
    sessionIDs,
    ...(typeof input.activeSessionID === "string" ? { activeSessionID: input.activeSessionID } : {}),
  } satisfies RelayWorkspaceSnapshot
  if (JSON.stringify(workspace).length > 64 * 1024) return
  return workspace
}

function hasWorkspaceBootstrapCookie(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .some((item) => item.trim() === "__Host-oc_remote_boot=1")
}

function workspaceBootstrapResponse(workspace: RelayWorkspaceSnapshot | undefined, destination: string) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
  const snapshot = JSON.stringify(workspace ?? null).replaceAll("<", "\\u003c")
  const target = JSON.stringify(destination).replaceAll("<", "\\u003c")
  return new Response(
    `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenCtrlC</title><body><script nonce="${nonce}">try{const workspace=${snapshot};const key="openctrlc.remote-workspace";if(workspace)sessionStorage.setItem(key,JSON.stringify(workspace));else sessionStorage.removeItem(key)}catch{}location.replace(${target})</script></body></html>`,
    {
      headers: {
        ...noStore,
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        "set-cookie": "__Host-oc_remote_boot=1; Path=/; Max-Age=60; Secure; SameSite=Strict",
      },
    },
  )
}

function sessionFor(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("__Host-oc_remote="))
    ?.slice("__Host-oc_remote=".length)
  if (!token) return
  const grant = viewerTokens.get(token)
  if (!grant || !grant.session.viewers.has(token)) return
  if (!touchViewer(grant.session, token)) return
  return { session: grant.session, token }
}

function viewerCookie(token: string) {
  return `__Host-oc_remote=${token}; Path=/; Max-Age=${viewerCookieLifetimeSeconds}; HttpOnly; Secure; SameSite=Strict`
}

function removeViewer(session: RelaySession, token: string, reason = "Browser authorization expired") {
  session.viewers.delete(token)
  if (viewerTokens.get(token)?.session === session) viewerTokens.delete(token)
  for (const [id, socket] of session.sockets) {
    if (socket.data.viewerToken !== token) continue
    session.sockets.delete(id)
    socket.close(4401, reason)
  }
}

function touchViewer(session: RelaySession, token: string) {
  const grant = viewerTokens.get(token)
  if (!grant || grant.session !== session || !session.viewers.has(token)) return false
  if (grant.expiresAt <= Date.now()) {
    removeViewer(session, token)
    sendViewerState(session)
    return false
  }
  grant.expiresAt = Date.now() + viewerLifetime
  return true
}

function pruneExpiredViewers(session: RelaySession, now = Date.now()) {
  let changed = false
  for (const [token, grant] of session.viewers) {
    if (grant.expiresAt > now) continue
    removeViewer(session, token)
    changed = true
  }
  if (changed) sendViewerState(session)
  return changed
}

function sendViewerState(session: RelaySession) {
  sendHost(session, { type: "viewer.count", count: session.viewers.size })
  sendHost(session, {
    type: "viewer.list",
    devices: [...session.viewers.values()].map((grant) => ({ id: grant.id, device: grant.device })),
  })
}

function sendHost(session: RelaySession, message: RelayServerMessage) {
  if (!session.host || session.host.readyState !== 1) return false
  session.host.send(
    JSON.stringify({ ...message, sessionID: session.id, hostToken: session.hostToken } satisfies RelayServerMessage & {
      sessionID: string
      hostToken: string
    }),
  )
  return true
}

function suspendHost(session: RelaySession, socket: Bun.ServerWebSocket<SocketData>) {
  if (session.host !== socket) return
  session.host = undefined
  session.resumeUntil = Date.now() + hostReconnectGrace
  if (session.resumeTimer) clearTimeout(session.resumeTimer)
  session.resumeTimer = setTimeout(() => {
    if (!session.host && session.resumeUntil && session.resumeUntil <= Date.now()) deleteSession(session)
  }, hostReconnectGrace)

  for (const pair of session.pairs.values()) {
    pair.socket.send(JSON.stringify({ type: "pair.error" } satisfies RelayServerMessage))
    pair.socket.close(1012, "Desktop is reconnecting")
  }
  session.pairs.clear()
  for (const pairingSocket of session.pairingSockets) pairingSocket.close(1012, "Desktop is reconnecting")
  session.pairingSockets.clear()

  for (const viewer of session.sockets.values()) viewer.close(1012, "Desktop is reconnecting")
  session.sockets.clear()
  for (const response of session.responses.values()) {
    const error = new Error("Desktop relay connection interrupted")
    response.closed = true
    response.rejectHeaders(error)
    try {
      response.controller?.error(error)
    } catch {}
  }
  session.responses.clear()
}

function deleteSession(session: RelaySession) {
  if (session.resumeTimer) clearTimeout(session.resumeTimer)
  sessions.delete(session.id)
  for (const [token, value] of viewerTokens) if (value.session === session) viewerTokens.delete(token)
  for (const socket of session.pairingSockets) socket.close(4404, "Session ended")
  for (const socket of session.sockets.values()) socket.close(4404, "Session ended")
  for (const response of session.responses.values()) {
    const error = new Error("Remote session ended")
    response.rejectHeaders(error)
    response.controller?.error(error)
  }
}

function sanitizeResponseHeaders(value: Record<string, string>) {
  const headers = new Headers(value)
  for (const name of [
    "connection",
    "content-length",
    "content-encoding",
    "keep-alive",
    "set-cookie",
    "set-cookie2",
    "transfer-encoding",
    "upgrade",
  ])
    headers.delete(name)
  return headers
}

function closeCode(value: unknown) {
  if (typeof value !== "number" || value < 1000 || value > 4999 || [1004, 1005, 1006, 1015].includes(value)) return 1000
  return value
}

function closeReason(value: unknown) {
  if (typeof value !== "string") return ""
  const bytes = new TextEncoder().encode(value)
  return new TextDecoder().decode(bytes.subarray(0, 123))
}

function deviceLabel(value: string | null) {
  const agent = value ?? ""
  const device = /iPhone/i.test(agent)
    ? "iPhone"
    : /iPad/i.test(agent)
      ? "iPad"
      : /Android/i.test(agent)
        ? "Android"
        : /Macintosh|Mac OS/i.test(agent)
          ? "Mac"
          : /Windows/i.test(agent)
            ? "Windows"
            : /Linux/i.test(agent)
              ? "Linux"
              : "Device"
  const browser = /Edg\//i.test(agent)
    ? "Edge"
    : /Firefox\//i.test(agent)
      ? "Firefox"
      : /Chrome\//i.test(agent)
        ? "Chrome"
        : /Safari\//i.test(agent)
          ? "Safari"
          : "Browser"
  return `${device} · ${browser}`
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).origin === publicURL.origin
  } catch {
    return false
  }
}

const noStore = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
}

function htmlResponse(page: ReturnType<typeof pairPage>) {
  return new Response(page.body, {
    headers: { ...noStore, "content-type": "text/html; charset=utf-8", "content-security-policy": page.policy },
  })
}

function pairPage(mode: "pair" | "expired" | "home") {
  const copy = {
    en: {
      title: "OpenCtrlC Remote",
      hint: "Open this link by scanning the QR code in the OpenCtrlC desktop app.",
      connecting: "Connecting securely to the OpenCtrlC Relay…",
      requesting: "Secure connection established. Sending the device request…",
      sent: "Request sent. Waiting for your desktop to receive it…",
      waiting: "The request is on your desktop. Waiting for your approval…",
      connectingSlow: "Still connecting to the relay. Check your network and keep this page open.",
      deliverySlow:
        "The desktop has not confirmed the request yet. If it is visible there, wait for approval; otherwise check OpenCtrlC and keep this page open.",
      approved: "Connected. Opening your workspace…",
      denied: "The desktop declined this request.",
      expired: "This link has expired. Create a new QR code on your desktop.",
      error: "Could not connect. Check the connection and scan again.",
    },
    zh: {
      title: "OpenCtrlC 远程访问",
      hint: "请使用 OpenCtrlC 桌面版扫描二维码打开此链接。",
      connecting: "正在安全连接 OpenCtrlC 中继…",
      requesting: "安全连接已建立，正在发送设备请求…",
      sent: "请求已发送，正在等待桌面端接收…",
      waiting: "桌面端已收到请求，等待你批准…",
      connectingSlow: "仍在连接中继。请检查网络，并保持此页面打开。",
      deliverySlow:
        "桌面端尚未确认收到请求。如果电脑上已显示请求，请等待批准；否则检查 OpenCtrlC 是否在线，并保持此页面打开。",
      approved: "已连接，正在打开工作区…",
      denied: "桌面端拒绝了此次连接。",
      expired: "此链接已过期，请在桌面端重新生成二维码。",
      error: "连接失败，请检查网络后重新扫码。",
    },
    ja: {
      title: "OpenCtrlC リモート",
      hint: "OpenCtrlC デスクトップアプリの QR コードをスキャンして、このリンクを開いてください。",
      connecting: "OpenCtrlC Relay に安全に接続しています…",
      requesting: "安全な接続が確立しました。端末のリクエストを送信しています…",
      sent: "リクエストを送信しました。デスクトップでの受信を待っています…",
      waiting: "リクエストがデスクトップに届きました。承認を待っています…",
      connectingSlow: "Relay への接続中です。ネットワークを確認し、このページを開いたままにしてください。",
      deliverySlow:
        "デスクトップからの確認がありません。画面にリクエストが表示されていれば承認を待ち、表示されていなければ OpenCtrlC の接続を確認してください。",
      approved: "接続しました。ワークスペースを開いています…",
      denied: "デスクトップで接続が拒否されました。",
      expired: "このリンクの有効期限が切れました。デスクトップで新しい QR コードを作成してください。",
      error: "接続できません。ネットワークを確認して再度スキャンしてください。",
    },
    ko: {
      title: "OpenCtrlC 원격 액세스",
      hint: "OpenCtrlC 데스크톱 앱에서 QR 코드를 스캔해 이 링크를 여세요.",
      connecting: "OpenCtrlC Relay에 안전하게 연결하는 중…",
      requesting: "보안 연결이 설정되었습니다. 기기 요청을 보내는 중…",
      sent: "요청을 보냈습니다. 데스크톱에서 수신하기를 기다리는 중…",
      waiting: "요청이 데스크톱에 도착했습니다. 승인을 기다리는 중…",
      connectingSlow: "Relay에 계속 연결 중입니다. 네트워크를 확인하고 이 페이지를 열어 두세요.",
      deliverySlow:
        "데스크톱에서 아직 요청을 확인하지 않았습니다. 화면에 요청이 보이면 승인을 기다리고, 보이지 않으면 OpenCtrlC 연결을 확인하세요.",
      approved: "연결되었습니다. 작업 공간을 여는 중…",
      denied: "데스크톱에서 연결이 거부되었습니다.",
      expired: "링크가 만료되었습니다. 데스크톱에서 새 QR 코드를 만드세요.",
      error: "연결할 수 없습니다. 네트워크를 확인하고 다시 스캔하세요.",
    },
  }
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
  const socketOrigin = `${publicURL.protocol === "https:" ? "wss:" : "ws:"}//${publicURL.host}`
  return {
    policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self' ${socketOrigin}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    body: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>OpenCtrlC Remote</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:#f6f6f4;color:#222;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(92vw,420px);padding:32px 26px;border:1px solid #e6e5e1;border-radius:18px;background:white;text-align:center;box-shadow:0 8px 32px #0000000a}.mark{display:grid;place-items:center;margin:0 auto 18px;width:44px;height:44px;border-radius:13px;background:#f2f2ef;font-size:22px}.title{margin:0 0 10px;font-size:20px}.hint{margin:0;color:#666;line-height:1.55}.status{margin-top:24px;min-height:24px;color:#555}.spinner{display:inline-block;width:15px;height:15px;margin-right:8px;border:2px solid #ddd;border-top-color:#555;border-radius:50%;vertical-align:-3px;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style><main class="card"><div class="mark">↗</div><h1 class="title">OpenCtrlC Remote</h1><p class="hint"></p><div class="status" role="status" aria-live="polite"></div></main><script nonce="${nonce}">const copy=${JSON.stringify(copy)};const mode=${JSON.stringify(mode)};const lang=(navigator.language||"en").toLowerCase();const locale=lang.startsWith("zh")?"zh":lang.startsWith("ja")?"ja":lang.startsWith("ko")?"ko":"en";const t=copy[locale];document.documentElement.lang=locale;document.querySelector(".title").textContent=t.title;document.querySelector(".hint").textContent=mode==="home"?t.hint:"";const status=document.querySelector(".status");const show=(text,loading=false)=>{status.textContent="";if(loading){const s=document.createElement("span");s.className="spinner";status.append(s)}status.append(document.createTextNode(text))};let completed=false;if(mode==="expired"){show(t.expired);history.replaceState(null,"","/")}else if(mode==="pair"){const sessionID=location.pathname.slice("/join/".length);const token=location.hash.slice(1);history.replaceState(null,"",location.pathname);if(!/^[A-Za-z0-9_-]{16}$/.test(sessionID)||!/^[A-Za-z0-9_-]{43}$/.test(token)){completed=true;show(t.expired)}else{show(t.connecting,true);const socket=new WebSocket(${JSON.stringify(socketOrigin)}+"/v1/viewer?session="+encodeURIComponent(sessionID));let deliveryTimeout;const handshakeTimeout=setTimeout(()=>show(t.connectingSlow,true),8000);socket.onopen=()=>{show(t.requesting,true);socket.send(JSON.stringify({type:"pair",joinToken:token}))};socket.onmessage=async(event)=>{let data;try{data=JSON.parse(event.data)}catch{return}if(data.type==="pair.waiting"){clearTimeout(handshakeTimeout);show(t.sent,true);deliveryTimeout=setTimeout(()=>show(t.deliverySlow,true),8000)}if(data.type==="pair.delivered"){clearTimeout(deliveryTimeout);show(t.waiting,true)}if(data.type==="pair.approved"){clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);completed=true;show(t.approved,true);try{if(!/^[A-Za-z0-9_-]{43}$/.test(data.viewerToken))throw new Error();const response=await fetch("/_remote/claim",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({viewerToken:data.viewerToken})});if(!response.ok)throw new Error();location.replace("/")}catch{show(t.error)}}if(data.type==="pair.denied"){clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);completed=true;show(t.denied)}if(data.type==="pair.error"){clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);completed=true;show(t.error)}};socket.onclose=()=>{clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);if(!completed)show(t.error)};socket.onerror=()=>{clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);show(t.error)}}}</script></html>`,
  }
}

setInterval(() => {
  const now = Date.now()
  for (const session of sessions.values()) {
    if (!session.host) {
      if (!session.resumeUntil || session.resumeUntil <= now) deleteSession(session)
      continue
    }
    if (session.host.readyState !== 1) {
      suspendHost(session, session.host)
      continue
    }
    pruneExpiredViewers(session, now)
    for (const [id, pair] of session.pairs) {
      if (pair.expiresAt > now) continue
      session.pairs.delete(id)
      sendHost(session, { type: "pair.denied", pairID: id })
      pair.socket.close(4408, "Pairing request expired")
    }
  }
  for (const [address, times] of createRates) {
    const fresh = times.filter((time) => now - time < 60 * 60 * 1000)
    if (fresh.length === 0) createRates.delete(address)
    else createRates.set(address, fresh)
  }
}, 60_000)

async function closeServer() {
  for (const session of sessions.values()) deleteSession(session)
  server.stop(true)
}

process.once("SIGTERM", closeServer)
process.once("SIGINT", closeServer)
