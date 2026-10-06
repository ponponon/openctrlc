import {
  BinaryFrameFlag,
  BinaryFrameKind,
  decodeBase64,
  decodeBinaryFrame,
  encodeBase64,
  encodeBinaryFrame,
  isViewerLimit,
  isPeerSignal,
  randomToken,
  relayMessage,
  streamID,
  type RelayServerMessage,
  type RelayWorkspaceSnapshot,
} from "./protocol"
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { sanitizeResponseHeaders, shouldGzipToViewer } from "./response-encoding"
import { peerRouteCounts, recordPeerRoute, type PeerRouteState } from "./peer-usage"
import { createPeerIceServers, removeTurnIceServers, stunServersConfigured, turnCredentialsConfigured } from "./turn"
import { keepEventStreamAlive, ResponseHeadersTimeoutError, withResponseHeadersTimeout } from "./request-timeout"

type SocketData = {
  role: "host" | "viewer"
  sessionID?: string
  pairID?: string
  mode?: "pair" | "proxy" | "peer"
  signalWindow?: number
  signalCount?: number
  id?: string
  path?: string
  protocols?: string[]
  device?: string
  clientIP?: string
  viewerToken?: string
  ready?: boolean
  queue?: Array<{ data: string; binary: boolean; size: number; payload: Uint8Array }>
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

type SessionTraffic = {
  hostIn: number
  hostOut: number
  viewerIn: number
  viewerOut: number
  p2pDirectBytes: number
  p2pTurnBytes: number
}

type RelaySession = {
  id: string
  hostToken: string
  joinToken: string
  viewerLimit: number
  binaryChunks: boolean
  traffic: SessionTraffic
  host?: Bun.ServerWebSocket<SocketData>
  pairingSockets: Set<Bun.ServerWebSocket<SocketData>>
  pairs: Map<string, PendingPair>
  viewers: Map<string, ViewerGrant>
  responses: Map<string, PendingResponse>
  sockets: Map<string, Bun.ServerWebSocket<SocketData>>
  peers: Map<string, Bun.ServerWebSocket<SocketData>>
  peerRoutes: Map<string, PeerRouteState>
  resumeUntil?: number
  resumeTimer?: ReturnType<typeof setTimeout>
  workspace?: RelayWorkspaceSnapshot
}

type ViewerGrant = {
  session: RelaySession
  id: string
  device: string
  expiresAt: number
  createdAt: number
  lastSeenAt: number
}

const port = Number(process.env.PORT ?? 4097)
const publicURL = new URL(process.env.OPENCTRLC_REMOTE_PUBLIC_URL ?? "https://openctrlc-remote.quniv.cn")
const maxRequestBytes = 16 * 1024 * 1024
// Workspace restore fans out per-project bootstrap calls; keep headroom so a
// freshly approved browser does not get 429 while hydrating the sidebar.
const maxPendingRequests = 256
const maxSockets = 32
const maxSocketQueueBytes = 512 * 1024
const responseHeadersTimeoutMs = 15_000
const maxSessionCreationsPerIPPerHour = 60
const maxSessions = 10_000
const sessionCreationWindow = 60 * 60 * 1000
const legacyViewerLimit = 3
const viewerLifetime = 30 * 24 * 60 * 60 * 1000
const viewerCookieLifetimeSeconds = Math.floor(viewerLifetime / 1000)
const viewerActivityPersistenceInterval = 5 * 60 * 1000
const pairLifetime = 5 * 60 * 1000
// Keep a host-disconnected session resumable long enough to survive desktop restarts.
// Sessions with authorized browsers stay for the full viewer lifetime; empty ones clean up sooner.
const hostReconnectGrace = 60 * 60 * 1000
const hostReconnectGraceWithViewers = viewerLifetime
const sessions = new Map<string, RelaySession>()
const viewerTokens = new Map<string, ViewerGrant>()
const createRates = new Map<string, number[]>()
const dataDir = process.env.OPENCTRLC_REMOTE_DATA_DIR?.trim() || ""
const stateFile = dataDir ? `${dataDir}/remote-sessions.json` : ""
let persistTimer: ReturnType<typeof setTimeout> | undefined
let persistDueAt = 0
let lastPersistAttemptAt = 0
let lastPersistedAt = 0
let persistenceErrors = 0

function schedulePersist(delay = 250) {
  if (!stateFile) return
  const dueAt = Date.now() + delay
  if (persistTimer && persistDueAt <= dueAt) return
  if (persistTimer) clearTimeout(persistTimer)
  persistDueAt = dueAt
  persistTimer = setTimeout(
    () => {
      persistTimer = undefined
      persistDueAt = 0
      persistState()
    },
    Math.max(0, dueAt - Date.now()),
  )
}

function persistState() {
  if (!stateFile) return
  lastPersistAttemptAt = Date.now()
  const savedAt = Date.now()
  const payload = {
    version: 1,
    savedAt,
    sessions: [...sessions.values()].map((session) => ({
      id: session.id,
      hostToken: session.hostToken,
      joinToken: session.joinToken,
      viewerLimit: session.viewerLimit,
      binaryChunks: session.binaryChunks,
      workspace: session.workspace,
      viewers: [...session.viewers.entries()].map(([token, grant]) => ({
        token,
        id: grant.id,
        device: grant.device,
        expiresAt: grant.expiresAt,
        createdAt: grant.createdAt,
        lastSeenAt: grant.lastSeenAt,
      })),
    })),
  }
  try {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    const tmp = `${stateFile}.tmp`
    writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 })
    chmodSync(tmp, 0o600)
    renameSync(tmp, stateFile)
    lastPersistedAt = savedAt
  } catch (error) {
    persistenceErrors += 1
    console.error("failed to persist relay sessions", error)
  }
}

function restoreState() {
  if (!stateFile) return
  let raw: string
  try {
    chmodSync(stateFile, 0o600)
    raw = readFileSync(stateFile, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    persistenceErrors += 1
    console.error("failed to read relay sessions", error)
    return
  }
  try {
    const parsed = JSON.parse(raw) as {
      version?: number
      savedAt?: number
      sessions?: Array<{
        id?: string
        hostToken?: string
        joinToken?: string
        viewerLimit?: number
        binaryChunks?: boolean
        workspace?: RelayWorkspaceSnapshot
        viewers?: Array<{
          token?: string
          id?: string
          device?: string
          expiresAt?: number
          createdAt?: number
          lastSeenAt?: number
        }>
      }>
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      throw new Error("unsupported relay session snapshot")
    }
    lastPersistAttemptAt = Date.now()
    lastPersistedAt = typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0
    const now = Date.now()
    for (const item of parsed.sessions ?? []) {
      if (!item.id || !item.hostToken || !item.joinToken) continue
      const session: RelaySession = {
        id: item.id,
        hostToken: item.hostToken,
        joinToken: item.joinToken,
        viewerLimit: isViewerLimit(item.viewerLimit) ? item.viewerLimit : legacyViewerLimit,
        binaryChunks: item.binaryChunks === true,
        traffic: { hostIn: 0, hostOut: 0, viewerIn: 0, viewerOut: 0, p2pDirectBytes: 0, p2pTurnBytes: 0 },
        pairingSockets: new Set(),
        pairs: new Map(),
        viewers: new Map(),
        responses: new Map(),
        sockets: new Map(),
        peers: new Map(),
        peerRoutes: new Map(),
        workspace: item.workspace,
      }
      for (const viewer of item.viewers ?? []) {
        if (!viewer.token || !viewer.id || !viewer.expiresAt || viewer.expiresAt <= now) continue
        const grant: ViewerGrant = {
          session,
          id: viewer.id,
          device: viewer.device ?? "Browser",
          expiresAt: viewer.expiresAt,
          createdAt: viewer.createdAt ?? now,
          lastSeenAt: viewer.lastSeenAt ?? now,
        }
        session.viewers.set(viewer.token, grant)
        viewerTokens.set(viewer.token, grant)
      }
      const grace = session.viewers.size > 0 ? hostReconnectGraceWithViewers : hostReconnectGrace
      session.resumeUntil = now + grace
      sessions.set(session.id, session)
    }
    console.log(`restored ${sessions.size} relay sessions from ${stateFile}`)
  } catch (error) {
    persistenceErrors += 1
    console.error("failed to restore relay sessions", error)
  }
}

const server = Bun.serve<SocketData>({
  hostname: process.env.HOST ?? "0.0.0.0",
  port,
  maxRequestBodySize: maxRequestBytes + 1024,
  // Proxied app responses and SSE streams can pause longer than Bun's 10s default.
  idleTimeout: 120,
  async fetch(request, server) {
    const url = new URL(request.url)
    if (url.pathname === "/healthz") return Response.json(healthSnapshot())
    if (request.method === "GET" && url.pathname === "/_remote/capabilities") {
      return Response.json(
        { peerProtocol: 1, iceConfigured: stunServersConfigured() || turnCredentialsConfigured() },
        { headers: noStore },
      )
    }
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
      // Already-approved browsers should reuse their cookie instead of minting a new grant.
      const existing = sessionFor(request)
      if (existing?.session.id === sessionID) {
        return htmlResponse(pairPage("already"))
      }
      return htmlResponse(pairPage("pair"))
    }
    if (request.method === "POST" && url.pathname === "/_remote/claim") return claimViewer(request)
    if (request.method === "GET" && url.pathname === "/") {
      const viewer = sessionFor(request)
      if (!viewer) return htmlResponse(pairPage("home"))
      if (!viewer.session.host || viewer.session.host.readyState !== 1) return htmlResponse(pairPage("disconnected"))
      if (!hasWorkspaceBootstrapCookie(request, viewer.session.id))
        return workspaceBootstrapResponse(viewer.session.workspace, "/", viewer.session.id)
      const response = await proxyRequest(viewer.session, request, viewer.token, (seconds) => server.timeout(request, seconds))
      if (response.status === 503 && /desktop(?: is)? disconnected/i.test(await response.clone().text()))
        return htmlResponse(pairPage("disconnected"))
      return response
    }

    const viewer = sessionFor(request)
    if (!viewer) return new Response("Remote session required", { status: 401, headers: noStore })
    const session = viewer.session
    if (url.pathname === "/_remote/peer") {
      if (!sameOrigin(request)) return new Response("Origin rejected", { status: 403, headers: noStore })
      if (session.host?.readyState !== 1) return new Response("Desktop disconnected", { status: 503, headers: noStore })
      if (session.peers.size >= maxSockets) return new Response("Too many peers", { status: 429, headers: noStore })
      if (
        server.upgrade(request, {
          data: { role: "viewer", mode: "peer", sessionID: session.id, viewerToken: viewer.token, id: randomToken(12) },
        })
      )
        return
      return new Response("WebSocket upgrade required", { status: 426, headers: noStore })
    }
    if (request.method === "GET" && request.headers.get("sec-fetch-dest") === "document") {
      if (!hasWorkspaceBootstrapCookie(request, viewer.session.id)) {
        return workspaceBootstrapResponse(viewer.session.workspace, url.pathname + url.search, viewer.session.id)
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
      const target = new URL(request.url)
      target.searchParams.delete("_oc_remote_session")
      if (
        server.upgrade(request, {
          data: {
            role: "viewer",
            sessionID: session.id,
            mode: "proxy",
            viewerToken: viewer.token,
            id: streamID(),
            path: target.pathname + target.search,
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
    return proxyRequest(session, request, viewer.token, (seconds) => server.timeout(request, seconds))
  },
  websocket: {
    maxPayloadLength: 2 * 1024 * 1024,
    idleTimeout: 0,
    async open(socket) {
      if (socket.data.role === "host") return
      const session = socket.data.sessionID ? sessions.get(socket.data.sessionID) : undefined
      if (!session) return socket.close(4404, "Session not found")
      if (socket.data.mode === "pair") {
        if (session.pairingSockets.size >= session.viewerLimit + 2)
          return socket.close(4429, "Too many pairing attempts")
        session.pairingSockets.add(socket)
        return
      }
      if (socket.data.mode === "peer" && socket.data.id) {
        const peerID = socket.data.id
        session.peers.set(peerID, socket)
        const iceServers = await createPeerIceServers(session.id)
        if (session.peers.get(peerID) !== socket || socket.readyState !== 1) return
        if (!socket.data.viewerToken || !touchViewer(session, socket.data.viewerToken))
          return socket.close(4401, "Authorization expired")
        socket.send(JSON.stringify({ type: "peer.ready", peerID, iceServers } satisfies RelayServerMessage))
        if (!sendHost(session, { type: "peer.open", peerID, iceServers })) {
          session.peers.delete(peerID)
          session.peerRoutes.delete(peerID)
          socket.close(1012, "Desktop disconnected")
        }
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
        if (typeof raw !== "string") {
          const bytes =
            raw instanceof ArrayBuffer
              ? new Uint8Array(raw)
              : new Uint8Array(
                  (raw as ArrayBufferView).buffer,
                  (raw as ArrayBufferView).byteOffset,
                  (raw as ArrayBufferView).byteLength,
                )
          const session = socket.data.sessionID ? sessions.get(socket.data.sessionID) : undefined
          if (!session) return socket.close(4404, "Session not found")
          session.traffic.hostIn += bytes.byteLength
          handleHostBinary(session, bytes)
          return
        }
        const session = socket.data.sessionID ? sessions.get(socket.data.sessionID) : undefined
        if (session) session.traffic.hostIn += new TextEncoder().encode(raw).byteLength
        const message = relayMessage(raw)
        if (!message || typeof message.type !== "string") return socket.close(4400, "Invalid message")
        await handleHostMessage(socket, message)
        return
      }
      const session = socket.data.sessionID ? sessions.get(socket.data.sessionID) : undefined
      if (!session) return socket.close(4404, "Session not found")
      if (socket.data.mode === "peer") {
        if (!socket.data.viewerToken || !touchViewer(session, socket.data.viewerToken))
          return socket.close(4401, "Authorization expired")
        const message = relayMessage(raw)
        if (message?.type === "peer.ping") {
          socket.send(JSON.stringify({ type: "peer.pong" }))
          return
        }
        if (message?.type !== "peer.signal" || !isPeerSignal(message.signal))
          return socket.close(4400, "Invalid peer signal")
        if (Date.now() - (socket.data.signalWindow ?? 0) >= 60_000) {
          socket.data.signalWindow = Date.now()
          socket.data.signalCount = 0
        }
        socket.data.signalCount = (socket.data.signalCount ?? 0) + 1
        if (socket.data.signalCount > 180) return socket.close(4429, "Too many peer signals")
        if (!sendHost(session, { type: "peer.signal", peerID: socket.data.id!, signal: message.signal }))
          socket.close(1012, "Desktop disconnected")
        return
      }
      if (socket.data.mode === "proxy") {
        const id = socket.data.id
        if (!id) return socket.close(4400, "Invalid tunnel")
        if (!socket.data.viewerToken || !touchViewer(session, socket.data.viewerToken)) {
          session.sockets.delete(id)
          return socket.close(4401, "Browser authorization expired")
        }
        const binary = typeof raw !== "string"
        const payload =
          typeof raw === "string"
            ? new TextEncoder().encode(raw)
            : raw instanceof ArrayBuffer
              ? new Uint8Array(raw)
              : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
        session.traffic.viewerIn += payload.byteLength
        const data = typeof raw === "string" ? raw : encodeBase64(payload)
        if (!socket.data.ready) {
          const queue = socket.data.queue ?? (socket.data.queue = [])
          if (queue.reduce((total, frame) => total + frame.size, 0) + payload.byteLength > maxSocketQueueBytes) {
            socket.close(1009, "WebSocket buffer limit exceeded")
            return
          }
          queue.push({ data, binary, size: payload.byteLength, payload })
          return
        }
        if (session.binaryChunks) {
          if (
            !sendHostBinary(
              session,
              BinaryFrameKind.SocketMessage,
              id,
              payload,
              binary ? BinaryFrameFlag.PayloadBinary : 0,
            )
          )
            socket.close(1011, "Desktop is disconnected")
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
        if (!session || session.host !== socket) return
        suspendHost(session, socket)
        return
      }
      if (!socket.data.sessionID) return
      const session = sessions.get(socket.data.sessionID)
      if (!session) return
      if (socket.data.mode === "peer" && socket.data.id) {
        session.peers.delete(socket.data.id)
        session.peerRoutes.delete(socket.data.id)
        sendHost(session, { type: "peer.close", peerID: socket.data.id })
        return
      }
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

restoreState()
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
    session.binaryChunks = value.binaryChunks === true
    socket.data.sessionID = session.id
    socket.send(
      JSON.stringify({
        type: "session.resumed",
        sessionID: session.id,
        hostToken: session.hostToken,
        url: `${publicURL.origin}/join/${session.id}#${session.joinToken}`,
        viewerLimit: session.viewerLimit,
        binaryChunks: session.binaryChunks,
        gzipResponseUpload: true,
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
    const attempts = (createRates.get(address) ?? []).filter((time) => Date.now() - time < sessionCreationWindow)
    if (attempts.length >= maxSessionCreationsPerIPPerHour || sessions.size >= maxSessions) {
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
      binaryChunks: value.binaryChunks === true,
      traffic: { hostIn: 0, hostOut: 0, viewerIn: 0, viewerOut: 0, p2pDirectBytes: 0, p2pTurnBytes: 0 },
      host: socket,
      pairingSockets: new Set(),
      pairs: new Map(),
      viewers: new Map(),
      responses: new Map(),
      sockets: new Map(),
      peers: new Map(),
      peerRoutes: new Map(),
    }
    socket.data.sessionID = session.id
    sessions.set(session.id, session)
    schedulePersist()
    socket.send(
      JSON.stringify({
        type: "session.created",
        sessionID: session.id,
        hostToken: session.hostToken,
        joinToken: session.joinToken,
        url: `${publicURL.origin}/join/${session.id}#${session.joinToken}`,
        viewerLimit: session.viewerLimit,
        binaryChunks: session.binaryChunks,
        gzipResponseUpload: true,
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
  if (value.type === "peer.signal" && typeof value.peerID === "string" && isPeerSignal(value.signal)) {
    session.peers.get(value.peerID)?.send(JSON.stringify({ type: "peer.signal", signal: value.signal }))
    return
  }
  if (value.type === "peer.route" && typeof value.peerID === "string" && session.peers.has(value.peerID)) {
    const delta = recordPeerRoute(
      session.peerRoutes,
      value.peerID,
      value.route,
      value.directBytes ?? 0,
      value.turnBytes ?? 0,
    )
    if (!delta) return
    session.traffic.p2pDirectBytes += delta.directBytes
    session.traffic.p2pTurnBytes += delta.turnBytes
    return
  }
  if ((value.type === "peer.open" || value.type === "peer.close") && typeof value.peerID === "string") {
    if (value.type === "peer.close") {
      session.peerRoutes.delete(value.peerID)
      const capacityLimited = value.code === 4429
      session.peers
        .get(value.peerID)
        ?.close(
          capacityLimited ? 4429 : 1000,
          capacityLimited ? "Direct peer capacity reached" : "Desktop closed direct connection",
        )
    }
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
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    }
    session.viewers.set(pair.viewerToken, grant)
    viewerTokens.set(pair.viewerToken, grant)
    schedulePersist()
    void createPeerIceServers(session.id)
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
    if (workspace) {
      session.workspace = workspace
      schedulePersist()
      console.log(
        `workspace.update session=${session.id.slice(0, 6)} projects=${workspace.projects.length} sessions=${workspace.sessionIDs.length}`,
      )
    }
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
      const sent = session.binaryChunks
        ? sendHostBinary(
            session,
            BinaryFrameKind.SocketMessage,
            value.id,
            frame.payload,
            frame.binary ? BinaryFrameFlag.PayloadBinary : 0,
          )
        : sendHost(session, { type: "socket.message", id: value.id, data: frame.data, binary: frame.binary })
      if (!sent) {
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
    if (!response || response.closed || typeof value.status !== "number" || typeof value.headers !== "object" || !value.headers) return
    response.resolveHeaders({ status: value.status, headers: value.headers as Record<string, string> })
    return
  }
  if (value.type === "response.chunk") {
    const response = session.responses.get(value.id)
    if (!response?.controller || typeof value.data !== "string") return
    enqueueResponseChunk(session, response, decodeBase64(value.data))
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
    const payload = binary ? decodeBase64(value.data) : new TextEncoder().encode(value.data)
    session.traffic.viewerOut += payload.byteLength
    viewer.send(binary ? payload : value.data, binary)
    return
  }
  if (value.type === "socket.close") {
    const viewer = session.sockets.get(value.id)
    if (viewer) viewer.close(closeCode(value.code), closeReason(value.reason))
    session.sockets.delete(value.id)
  }
}

async function proxyRequest(
  session: RelaySession,
  request: Request,
  viewerToken: string,
  setRequestTimeout: (seconds: number) => void,
) {
  if (!session.host || session.host.readyState !== 1) return new Response("Desktop is disconnected", { status: 503 })
  if (request.headers.get("upgrade")) return new Response("Unsupported upgrade", { status: 400 })
  if (!sameOrigin(request)) return new Response("Origin rejected", { status: 403, headers: noStore })
  const target = new URL(request.url)
  target.searchParams.delete("_oc_remote_session")
  const path = target.pathname + target.search
  if (session.responses.size >= maxPendingRequests)
    return new Response("Too many remote requests", { status: 429, headers: noStore })
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > maxRequestBytes) return new Response("Request body is too large", { status: 413 })
  const id = streamID()
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
      pending.rejectHeaders(new Error("Viewer request was canceled"))
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
          "x-openctrlc-remote-session",
          "host",
          "origin",
          "referer",
          "connection",
          "content-length",
          "transfer-encoding",
        ].includes(name.toLowerCase()),
    ),
  )
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
      pending.rejectHeaders(new Error("Viewer request was canceled"))
      sendHost(session, { type: "request.cancel", id })
    },
    { once: true },
  )
  try {
    const result = await withResponseHeadersTimeout(headersPromise, responseHeadersTimeoutMs)
    const responseHeaders = sanitizeResponseHeaders(result.headers)
    keepEventStreamAlive(responseHeaders, setRequestTimeout)
    applyAssetCachePolicy(path, request.method, result.status, responseHeaders)
    if (!responseHeaders.get("cache-control")?.startsWith("public,")) {
      for (const cookie of viewerCookie(viewerToken, session.id)) responseHeaders.append("set-cookie", cookie)
    }
    if ([204, 205, 304].includes(result.status)) {
      return new Response(null, { status: result.status, headers: responseHeaders })
    }
    // Older desktop clients send decoded bodies; newer clients may already gzip
    // them before upload. Never compress a body that still has an encoding.
    if (shouldGzipToViewer(request, responseHeaders)) {
      responseHeaders.set("content-encoding", "gzip")
      return new Response(
        body.pipeThrough(new CompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>),
        {
          status: result.status,
          headers: responseHeaders,
        },
      )
    }
    return new Response(body, {
      status: result.status,
      headers: responseHeaders,
    })
  } catch (error) {
    if (error instanceof ResponseHeadersTimeoutError) {
      pending.closed = true
      session.responses.delete(id)
      pending.rejectHeaders(error)
      try {
        pending.controller?.error(error)
      } catch {}
      sendHost(session, { type: "request.cancel", id })
      return new Response("Desktop response timed out", { status: 504, headers: noStore })
    }
    return new Response("Desktop request failed", { status: 502 })
  }
}

/**
 * Hashed Vite assets are immutable. Long-caching them in the browser cuts repeat
 * remote loads from multi-MB to a handful of small document/API calls on 5Mbps.
 */
function applyAssetCachePolicy(pathnameWithQuery: string, method: string, status: number, responseHeaders: Headers) {
  // All desktops share the public origin, but API responses belong to one
  // desktop and project. Never retain them or their viewer authorization cookies.
  responseHeaders.set("cache-control", "no-store, max-age=0")
  const pathname = pathnameWithQuery.split("?")[0] ?? pathnameWithQuery
  if (
    ["GET", "HEAD"].includes(method) &&
    [200, 304].includes(status) &&
    !(responseHeaders.get("content-type") ?? "").toLowerCase().includes("text/html") &&
    /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.\w+$/.test(pathname)
  ) {
    responseHeaders.set("cache-control", "public, max-age=31536000, immutable")
    return
  }
  if (pathname === "/" || pathname.endsWith(".html")) {
    responseHeaders.set("cache-control", "private, no-cache")
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
      session.traffic.viewerIn += item.value.byteLength
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
        if (session.binaryChunks) {
          if (!sendHostBinary(session, BinaryFrameKind.RequestChunk, id, chunk)) return
          continue
        }
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
  const headers = new Headers({ ...noStore })
  for (const cookie of viewerCookie(body.viewerToken, grant.session.id)) headers.append("set-cookie", cookie)
  return new Response(null, { status: 204, headers })
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
  const sessionIDSet = new Set(sessionIDs)
  if (input.sessionInfo !== undefined && (!Array.isArray(input.sessionInfo) || input.sessionInfo.length > 128)) return
  const sessionInfo = (input.sessionInfo as unknown[] | undefined)?.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const info = item as Record<string, unknown>
    if (typeof info.sessionID !== "string" || !sessionIDSet.has(info.sessionID)) return []
    if (info.title !== undefined && (typeof info.title !== "string" || info.title.length > 200)) return []
    if (info.protocol !== undefined && info.protocol !== "v1" && info.protocol !== "v2") return []
    if (info.title === undefined && info.protocol === undefined) return []
    const protocol: "v1" | "v2" | undefined =
      info.protocol === "v1" || info.protocol === "v2" ? info.protocol : undefined
    return [
      {
        sessionID: info.sessionID,
        ...(typeof info.title === "string" ? { title: info.title } : {}),
        ...(protocol ? { protocol } : {}),
      },
    ]
  })
  if (sessionInfo && input.sessionInfo && sessionInfo.length !== input.sessionInfo.length) return
  if (input.lastProject !== undefined && (typeof input.lastProject !== "string" || input.lastProject.length > 4096))
    return
  if (
    input.activeSessionID !== undefined &&
    (typeof input.activeSessionID !== "string" ||
      input.activeSessionID.length === 0 ||
      input.activeSessionID.length > 200)
  )
    return
  if (input.hostName !== undefined && (typeof input.hostName !== "string" || input.hostName.length > 120)) return
  const workspace = {
    projects,
    ...(typeof input.lastProject === "string" ? { lastProject: input.lastProject } : {}),
    sessionIDs,
    ...(sessionInfo ? { sessionInfo } : {}),
    ...(typeof input.activeSessionID === "string" ? { activeSessionID: input.activeSessionID } : {}),
    ...(typeof input.hostName === "string" ? { hostName: input.hostName } : {}),
  } satisfies RelayWorkspaceSnapshot
  if (JSON.stringify(workspace).length > 64 * 1024) return
  return workspace
}

function hasWorkspaceBootstrapCookie(request: Request, sessionID: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .some((item) => item.trim() === `__Host-oc_remote_boot=${sessionID}`)
}

function workspaceBootstrapResponse(
  workspace: RelayWorkspaceSnapshot | undefined,
  destination: string,
  sessionID: string,
) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
  const snapshot = JSON.stringify(workspace ?? null).replaceAll("<", "\\u003c")
  const target = JSON.stringify(destination).replaceAll("<", "\\u003c")
  const key = JSON.stringify(`openctrlc.remote-workspace:${sessionID}`).replaceAll("<", "\\u003c")
  return new Response(
    `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenCtrlC</title><body><script nonce="${nonce}">try{const workspace=${snapshot};const key=${key};if(workspace){const raw=JSON.stringify(workspace);sessionStorage.setItem(key,raw);try{localStorage.setItem(key,raw)}catch{}}else{sessionStorage.removeItem(key);try{localStorage.removeItem(key)}catch{}}}catch{}location.replace(${target})</script></body></html>`,
    {
      headers: {
        ...noStore,
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        "set-cookie": `__Host-oc_remote_boot=${sessionID}; Path=/; Max-Age=60; Secure; SameSite=Strict`,
      },
    },
  )
}

function sessionFor(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"))
  // Pin API and signaling traffic to the desktop selected when this tab booted.
  // A failed explicit selection must never fall through to another desktop's cookie.
  const selected =
    request.headers.get("x-openctrlc-remote-session") ?? new URL(request.url).searchParams.get("_oc_remote_session")
  if (selected !== null) {
    if (!/^[A-Za-z0-9_-]{16}$/.test(selected)) return
    const hit = viewerForToken(cookies[viewerCookieName(selected)])
    return hit?.session.id === selected ? hit : undefined
  }
  // `oc_active` is readable/writable by the page so the remote UI can switch desktops;
  // `__Host-oc_active` remains the server-set default.
  const active = cookies["oc_active"] ?? cookies["__Host-oc_active"]
  if (active) {
    const hit = viewerForToken(cookies[viewerCookieName(active)])
    if (hit) return hit
  }
  // Fall back to any authorized browser cookie (legacy single-session name included).
  for (const [name, value] of Object.entries(cookies)) {
    if (name !== "__Host-oc_remote" && !name.startsWith(VIEWER_COOKIE_PREFIX)) continue
    const hit = viewerForToken(value)
    if (hit) return hit
  }
  return undefined
}

function viewerForToken(token: string | undefined) {
  if (!token) return undefined
  const grant = viewerTokens.get(token)
  if (!grant || !grant.session.viewers.has(token)) return undefined
  if (!touchViewer(grant.session, token)) return undefined
  return { session: grant.session, token }
}

function parseCookies(header: string | null) {
  const out: Record<string, string> = {}
  for (const part of (header ?? "").split(";")) {
    const idx = part.indexOf("=")
    if (idx <= 0) continue
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
  }
  return out
}

const VIEWER_COOKIE_PREFIX = "__Host-oc_remote_"

function viewerCookieName(sessionID: string) {
  return `${VIEWER_COOKIE_PREFIX}${sessionID}`
}

function viewerCookie(token: string, sessionID: string) {
  return [
    `${viewerCookieName(sessionID)}=${token}; Path=/; Max-Age=${viewerCookieLifetimeSeconds}; HttpOnly; Secure; SameSite=Strict`,
    `__Host-oc_active=${sessionID}; Path=/; Max-Age=${viewerCookieLifetimeSeconds}; Secure; SameSite=Strict`,
  ]
}

function removeViewer(session: RelaySession, token: string, reason = "Browser authorization expired") {
  session.viewers.delete(token)
  if (viewerTokens.get(token)?.session === session) viewerTokens.delete(token)
  schedulePersist()
  for (const [id, socket] of session.peers) {
    if (socket.data.viewerToken !== token) continue
    session.peers.delete(id)
    session.peerRoutes.delete(id)
    sendHost(session, { type: "peer.close", peerID: id })
    socket.close(4401, reason)
  }
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
  const now = Date.now()
  grant.expiresAt = now + viewerLifetime
  grant.lastSeenAt = now
  const delay = viewerActivityPersistenceInterval - (now - lastPersistAttemptAt)
  schedulePersist(delay > 0 ? delay : 250)
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
    devices: [...session.viewers.values()].map((grant) => ({
      id: grant.id,
      device: grant.device,
      createdAt: grant.createdAt,
      lastSeenAt: grant.lastSeenAt,
    })),
  })
}

function sendHost(session: RelaySession, message: RelayServerMessage) {
  if (!session.host || session.host.readyState !== 1) return false
  const encoded = JSON.stringify({
    ...message,
    sessionID: session.id,
    hostToken: session.hostToken,
  } satisfies RelayServerMessage & {
    sessionID: string
    hostToken: string
  })
  session.traffic.hostOut += new TextEncoder().encode(encoded).byteLength
  session.host.send(encoded)
  return true
}

function sendHostBinary(session: RelaySession, kind: number, id: string, payload: Uint8Array, flags = 0) {
  if (!session.host || session.host.readyState !== 1) return false
  const frame = encodeBinaryFrame(kind, id, payload, flags)
  session.traffic.hostOut += frame.byteLength
  session.host.send(frame)
  return true
}

function handleHostBinary(session: RelaySession, bytes: Uint8Array) {
  const frame = decodeBinaryFrame(bytes)
  if (!frame) return
  if (frame.kind === BinaryFrameKind.ResponseChunk) {
    const response = session.responses.get(frame.id)
    if (!response?.controller) return
    enqueueResponseChunk(session, response, frame.payload)
    return
  }
  if (frame.kind === BinaryFrameKind.SocketMessage) {
    sendViewerSocket(session, frame.id, frame.payload, (frame.flags & BinaryFrameFlag.PayloadBinary) !== 0)
  }
}

function enqueueResponseChunk(session: RelaySession, response: PendingResponse, payload: Uint8Array) {
  if (!response.controller || response.closed) return
  session.traffic.viewerOut += payload.byteLength
  response.controller.enqueue(payload)
}

function sendViewerSocket(session: RelaySession, id: string, payload: Uint8Array, binary: boolean) {
  const viewer = session.sockets.get(id)
  if (!viewer) return
  session.traffic.viewerOut += payload.byteLength
  viewer.send(binary ? payload : new TextDecoder().decode(payload), binary)
}

function healthSnapshot() {
  const totals: SessionTraffic = {
    hostIn: 0,
    hostOut: 0,
    viewerIn: 0,
    viewerOut: 0,
    p2pDirectBytes: 0,
    p2pTurnBytes: 0,
  }
  const usage = {
    connectedDesktops: 0,
    authorizedBrowsers: 0,
    activeViewerSockets: 0,
    activePeerSignalingSockets: 0,
    activeP2PDirectPeers: 0,
    activeP2PTurnPeers: 0,
    pendingViewerRequests: 0,
    pendingPairings: 0,
    stunServersConfigured: stunServersConfigured(),
    turnCredentialsConfigured: turnCredentialsConfigured(),
  }
  const active: Array<{ id: string } & SessionTraffic & { viewers: number; binaryChunks: boolean }> = []
  for (const session of sessions.values()) {
    totals.hostIn += session.traffic.hostIn
    totals.hostOut += session.traffic.hostOut
    totals.viewerIn += session.traffic.viewerIn
    totals.viewerOut += session.traffic.viewerOut
    totals.p2pDirectBytes += session.traffic.p2pDirectBytes
    totals.p2pTurnBytes += session.traffic.p2pTurnBytes
    if (session.host?.readyState === 1) usage.connectedDesktops += 1
    usage.authorizedBrowsers += session.viewers.size
    usage.activeViewerSockets += session.sockets.size
    usage.activePeerSignalingSockets += session.peers.size
    const peerRoutes = peerRouteCounts(session.peerRoutes.values())
    usage.activeP2PDirectPeers += peerRoutes.direct
    usage.activeP2PTurnPeers += peerRoutes.turn
    usage.pendingViewerRequests += session.responses.size
    usage.pendingPairings += session.pairs.size
    active.push({
      id: session.id.slice(0, 6),
      viewers: session.viewers.size,
      binaryChunks: session.binaryChunks,
      ...session.traffic,
    })
  }
  return {
    ok: true,
    sessions: sessions.size,
    usage,
    traffic: totals,
    persistence: {
      enabled: !!stateFile,
      errors: persistenceErrors,
      lastSavedAt: lastPersistedAt,
      pending: !!persistTimer,
    },
    active,
  }
}

function suspendHost(session: RelaySession, socket: Bun.ServerWebSocket<SocketData>) {
  if (session.host !== socket) return
  session.host = undefined
  const grace = session.viewers.size > 0 ? hostReconnectGraceWithViewers : hostReconnectGrace
  session.resumeUntil = Date.now() + grace
  if (session.resumeTimer) clearTimeout(session.resumeTimer)
  // setTimeout delays are 32-bit; cap the timer and let the minute sweeper finish long expirations.
  session.resumeTimer = setTimeout(
    () => {
      if (!session.host && session.resumeUntil && session.resumeUntil <= Date.now()) deleteSession(session)
    },
    Math.min(grace, 2_147_483_647),
  )

  for (const pair of session.pairs.values()) {
    pair.socket.send(JSON.stringify({ type: "pair.error" } satisfies RelayServerMessage))
    pair.socket.close(1012, "Desktop is reconnecting")
  }
  session.pairs.clear()
  for (const pairingSocket of session.pairingSockets) pairingSocket.close(1012, "Desktop is reconnecting")
  session.pairingSockets.clear()
  for (const peer of session.peers.values()) peer.close(1012, "Desktop is reconnecting")
  session.peers.clear()
  session.peerRoutes.clear()

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
  removeTurnIceServers(session.id)
  for (const [token, value] of viewerTokens) if (value.session === session) viewerTokens.delete(token)
  schedulePersist()
  for (const socket of session.pairingSockets) socket.close(4404, "Session ended")
  for (const socket of session.sockets.values()) socket.close(4404, "Session ended")
  for (const socket of session.peers.values()) socket.close(4404, "Session ended")
  session.peerRoutes.clear()
  for (const response of session.responses.values()) {
    const error = new Error("Remote session ended")
    response.rejectHeaders(error)
    response.controller?.error(error)
  }
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

function pairPage(mode: "pair" | "expired" | "home" | "already" | "disconnected") {
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
      already: "This browser is already approved. Opening your workspace…",
      error: "Could not connect. Check the connection and scan again.",
      disconnected:
        "Your desktop is not connected to OpenCtrlC Relay. Make sure OpenCtrlC is running with mobile access enabled. This page will retry automatically.",
      retry: "Try again now",
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
      already: "这台浏览器已授权，正在打开工作区…",
      error: "连接失败，请检查网络后重新扫码。",
      disconnected: "桌面端尚未连接到 OpenCtrlC 中继。请确认 OpenCtrlC 正在运行且手机访问已开启，页面会自动重试。",
      retry: "立即重试",
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
      already: "このブラウザーは承認済みです。ワークスペースを開いています…",
      error: "接続できません。ネットワークを確認して再度スキャンしてください。",
      disconnected:
        "デスクトップが OpenCtrlC Relay に接続されていません。OpenCtrlC が起動し、モバイルアクセスが有効であることを確認してください。このページは自動的に再試行します。",
      retry: "今すぐ再試行",
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
      already: "이 브라우저는 이미 승인되어 있습니다. 작업 공간을 여는 중…",
      error: "연결할 수 없습니다. 네트워크를 확인하고 다시 스캔하세요.",
      disconnected:
        "데스크톱이 OpenCtrlC Relay에 연결되어 있지 않습니다. OpenCtrlC가 실행 중이고 모바일 액세스가 켜져 있는지 확인하세요. 이 페이지는 자동으로 다시 시도합니다.",
      retry: "지금 다시 시도",
    },
  }
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
  const socketOrigin = `${publicURL.protocol === "https:" ? "wss:" : "ws:"}//${publicURL.host}`
  return {
    policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self' ${socketOrigin}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    body: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>OpenCtrlC Remote</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:#f6f6f4;color:#222;font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(92vw,420px);padding:32px 26px;border:1px solid #e6e5e1;border-radius:18px;background:white;text-align:center;box-shadow:0 8px 32px #0000000a}.mark{display:grid;place-items:center;margin:0 auto 18px;width:44px;height:44px;border-radius:13px;background:#f2f2ef;font-size:22px}.title{margin:0 0 10px;font-size:20px}.hint{margin:0;color:#666;line-height:1.55}.status{margin-top:24px;min-height:24px;color:#555;line-height:1.55}.status.disconnected{color:#8a4b08}.retry{display:inline-block;margin-top:20px;padding:10px 16px;border:1px solid #d9d8d4;border-radius:10px;color:#222;text-decoration:none;font-weight:600}.retry:hover{background:#f6f6f4}.retry:focus-visible{outline:2px solid #555;outline-offset:3px}[hidden]{display:none!important}.spinner{display:inline-block;width:15px;height:15px;margin-right:8px;border:2px solid #ddd;border-top-color:#555;border-radius:50%;vertical-align:-3px;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style><main class="card"><div class="mark">↗</div><h1 class="title">OpenCtrlC Remote</h1><p class="hint"></p><div class="status" role="status" aria-live="polite"></div><a class="retry" href="/" hidden></a></main><script nonce="${nonce}">const copy=${JSON.stringify(copy)};const mode=${JSON.stringify(mode)};const lang=(navigator.language||"en").toLowerCase();const locale=lang.startsWith("zh")?"zh":lang.startsWith("ja")?"ja":lang.startsWith("ko")?"ko":"en";const t=copy[locale];document.documentElement.lang=locale;document.querySelector(".title").textContent=t.title;document.querySelector(".hint").textContent=mode==="home"?t.hint:"";const status=document.querySelector(".status");const show=(text,loading=false)=>{status.textContent="";if(loading){const s=document.createElement("span");s.className="spinner";status.append(s)}status.append(document.createTextNode(text))};let completed=false;if(mode==="disconnected"){status.classList.add("disconnected");show(t.disconnected);const retry=document.querySelector(".retry");retry.textContent=t.retry;retry.hidden=false;setTimeout(()=>location.reload(),5000)}else if(mode==="already"){show(t.already,true);setTimeout(()=>location.replace("/"),400)}else if(mode==="expired"){show(t.expired);history.replaceState(null,"","/")}else if(mode==="pair"){const sessionID=location.pathname.slice("/join/".length);let token=location.hash.slice(1);try{const k="openctrlc.join-token."+sessionID;if(token)sessionStorage.setItem(k,token);else token=sessionStorage.getItem(k)||""}catch{};history.replaceState(null,"",location.pathname);if(!/^[A-Za-z0-9_-]{16}$/.test(sessionID)||!/^[A-Za-z0-9_-]{43}$/.test(token)){completed=true;show(t.expired)}else{show(t.connecting,true);const socket=new WebSocket(${JSON.stringify(socketOrigin)}+"/v1/viewer?session="+encodeURIComponent(sessionID));let deliveryTimeout;const handshakeTimeout=setTimeout(()=>show(t.connectingSlow,true),8000);socket.onopen=()=>{show(t.requesting,true);socket.send(JSON.stringify({type:"pair",joinToken:token}))};socket.onmessage=async(event)=>{let data;try{data=JSON.parse(event.data)}catch{return}if(data.type==="pair.waiting"){clearTimeout(handshakeTimeout);show(t.sent,true);deliveryTimeout=setTimeout(()=>show(t.deliverySlow,true),8000)}if(data.type==="pair.delivered"){clearTimeout(deliveryTimeout);show(t.waiting,true)}if(data.type==="pair.approved"){clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);completed=true;show(t.approved,true);try{if(!/^[A-Za-z0-9_-]{43}$/.test(data.viewerToken))throw new Error();const response=await fetch("/_remote/claim",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({viewerToken:data.viewerToken})});if(!response.ok)throw new Error();location.replace("/")}catch{show(t.error)}}if(data.type==="pair.denied"){clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);completed=true;show(t.denied)}if(data.type==="pair.error"){clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);completed=true;show(t.error)}};socket.onclose=()=>{clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);if(!completed)show(t.error)};socket.onerror=()=>{clearTimeout(handshakeTimeout);clearTimeout(deliveryTimeout);show(t.error)}}}</script></html>`,
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
    const fresh = times.filter((time) => now - time < sessionCreationWindow)
    if (fresh.length === 0) createRates.delete(address)
    else createRates.set(address, fresh)
  }
}, 60_000)

async function closeServer() {
  // Keep session/viewer grants on disk so a Relay restart restores browser auth.
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = undefined
  persistDueAt = 0
  persistState()
  server.stop(true)
}

process.once("SIGTERM", closeServer)
process.once("SIGINT", closeServer)
