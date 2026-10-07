export type RelayWorkspaceSnapshot = {
  projects: Array<{ worktree: string; expanded: boolean }>
  lastProject?: string
  sessionIDs: string[]
  sessionInfo?: Array<{ sessionID: string; title?: string; directory?: string; protocol?: "v1" | "v2" }>
  activeSessionID?: string
  hostName?: string
}

export const DEFAULT_VIEWER_LIMIT = 10
export const MIN_VIEWER_LIMIT = 1
export const MAX_VIEWER_LIMIT = 100

/** Direct response streams grant byte credit only while the browser has buffer capacity. */
export const PEER_RESPONSE_CHUNK_BYTES = 24 * 1024
export const PEER_RESPONSE_BUFFER_BYTES = 256 * 1024

export function isViewerLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_VIEWER_LIMIT && value <= MAX_VIEWER_LIMIT
}

export type RelayHostMessage =
  | { type: "peer.signal"; peerID: string; signal: PeerSignal }
  | { type: "peer.route"; peerID: string; route: "direct" | "turn"; directBytes?: number; turnBytes?: number }
  | { type: "peer.close"; peerID: string; code?: 1000 | 1012 | 4429 }
  | { type: "session.create"; viewerLimit: number; binaryChunks?: boolean }
  | { type: "session.resume"; sessionID: string; hostToken: string; binaryChunks?: boolean }
  | { type: "session.limit.update"; sessionID: string; hostToken: string; viewerLimit: number }
  | { type: "session.ping"; pingID?: string }
  | { type: "session.stop"; sessionID: string; hostToken: string }
  | { type: "pair.rotate"; sessionID: string; hostToken: string }
  | { type: "pair.approve" | "pair.deny"; sessionID: string; hostToken: string; pairID: string }
  | { type: "pair.received"; sessionID: string; hostToken: string; pairID: string }
  | { type: "viewer.revoke"; sessionID: string; hostToken: string; viewerID: string }
  | {
      type: "workspace.update"
      sessionID: string
      hostToken: string
      workspace: RelayWorkspaceSnapshot
    }
  | { type: "request.start"; id: string; method: string; path: string; headers: Record<string, string> }
  | { type: "request.chunk"; id: string; data: string }
  | { type: "request.end"; id: string }
  | { type: "request.cancel"; id: string }
  | { type: "response.start"; id: string; status: number; headers: Record<string, string> }
  | { type: "response.chunk"; id: string; data: string }
  | { type: "response.end"; id: string }
  | { type: "response.error"; id: string; message: string }
  | { type: "socket.open"; id: string; path: string; protocols: string[] }
  | { type: "socket.opened"; id: string; protocol: string }
  | { type: "socket.message"; id: string; data: string; binary: boolean }
  | { type: "socket.close"; id: string; code: number; reason: string }

export type RelayServerMessage =
  | { type: "peer.ready"; peerID: string; iceServers: PeerIceServer[] }
  | { type: "peer.open"; peerID: string; iceServers: PeerIceServer[] }
  | { type: "peer.close"; peerID: string }
  | { type: "peer.signal"; peerID: string; signal: PeerSignal }
  | {
      type: "session.created"
      sessionID: string
      hostToken: string
      joinToken: string
      url: string
      viewerLimit: number
      binaryChunks?: boolean
      gzipResponseUpload?: boolean
    }
  | {
      type: "session.resumed"
      sessionID: string
      hostToken: string
      url: string
      viewerLimit: number
      binaryChunks?: boolean
      gzipResponseUpload?: boolean
    }
  | { type: "session.limit.updated"; viewerLimit: number }
  | { type: "session.resume.error"; reason: "unavailable" | "invalid" }
  | { type: "pair.request"; pairID: string; device: string }
  | { type: "pair.approved"; pairID: string }
  | { type: "pair.denied"; pairID: string }
  | { type: "pair.error"; message?: string }
  | { type: "session.stopped" }
  | { type: "session.pong"; pingID?: string }
  | { type: "viewer.count"; count: number }
  | { type: "viewer.list"; devices: Array<{ id: string; device: string; createdAt?: number; lastSeenAt?: number }> }
  | { type: "viewer.revoked"; viewerID: string }
  | { type: "viewer.revoke.error"; viewerID: string }
  | { type: "pair.rotated"; joinToken: string; url: string }
  | { type: "pair.waiting"; pairID: string }
  | { type: "pair.delivered"; pairID: string }
  | { type: "remote.ready"; protocol: string }
  | { type: "request.start"; id: string; method: string; path: string; headers: Record<string, string> }
  | { type: "request.chunk"; id: string; data: string }
  | { type: "request.end"; id: string }
  | { type: "request.cancel"; id: string }
  | { type: "response.start"; id: string; status: number; headers: Record<string, string> }
  | { type: "response.chunk"; id: string; data: string }
  | { type: "response.end"; id: string }
  | { type: "response.error"; id: string; message: string }
  | { type: "socket.open"; id: string; path: string; protocols: string[] }
  | { type: "socket.opened"; id: string; protocol: string }
  | { type: "socket.message"; id: string; data: string; binary: boolean }
  | { type: "socket.close"; id: string; code: number; reason: string }

export type RelayViewerMessage = { type: "pair"; joinToken: string }
export type PeerRoute = "direct" | "turn"
export type PeerRouteBytes = { directBytes: number; turnBytes: number }

export function isPeerRouteBytes(value: unknown): value is PeerRouteBytes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const bytes = value as Record<string, unknown>
  return (
    Number.isSafeInteger(bytes.directBytes) &&
    (bytes.directBytes as number) >= 0 &&
    Number.isSafeInteger(bytes.turnBytes) &&
    (bytes.turnBytes as number) >= 0
  )
}

export type PeerSignal =
  | { type: "offer" | "answer"; sdp: string }
  | { type: "candidate"; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }

export function isPeerRelayAvailable(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const capabilities = value as Record<string, unknown>
  return capabilities.peerProtocol === 1 && capabilities.iceConfigured === true
}

export type PeerIceServer = {
  urls: string | string[]
  username?: string
  credential?: string
}

export function isPeerIceServers(value: unknown): value is PeerIceServer[] {
  if (!Array.isArray(value) || value.length > 8) return false
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false
    const server = item as Record<string, unknown>
    const urls = typeof server.urls === "string" ? [server.urls] : server.urls
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > 8) return false
    if (!urls.every((url) => typeof url === "string" && url.length <= 512 && /^(stun|stuns|turn|turns):/i.test(url)))
      return false
    if (server.username !== undefined && (typeof server.username !== "string" || server.username.length > 512))
      return false
    if (server.credential !== undefined && (typeof server.credential !== "string" || server.credential.length > 512))
      return false
    return (server.username === undefined) === (server.credential === undefined)
  })
}

/** Signaling is untrusted even after a browser has been authorized. */
export function isPeerSignal(value: unknown): value is PeerSignal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const signal = value as Record<string, unknown>
  if (signal.type === "offer" || signal.type === "answer")
    return typeof signal.sdp === "string" && signal.sdp.length > 0 && signal.sdp.length <= 60_000
  return (
    signal.type === "candidate" &&
    typeof signal.candidate === "string" &&
    signal.candidate.length <= 4096 &&
    (signal.sdpMid === null || (typeof signal.sdpMid === "string" && signal.sdpMid.length <= 256)) &&
    (signal.sdpMLineIndex === null ||
      (typeof signal.sdpMLineIndex === "number" &&
        Number.isInteger(signal.sdpMLineIndex) &&
        signal.sdpMLineIndex >= 0 &&
        signal.sdpMLineIndex < 256))
  )
}

export function relayMessage(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string") return
  try {
    const result: unknown = JSON.parse(value)
    if (!result || typeof result !== "object" || Array.isArray(result)) return
    return result as Record<string, unknown>
  } catch {
    return
  }
}

export function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

/**
 * Stream IDs travel in fixed 12-byte binary-frame headers.
 * 9 random bytes base64-encode to exactly 12 characters.
 */
export function streamID() {
  return randomToken(9)
}

export function encodeBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
}

export function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

/** Bulk payload frames on the host WebSocket. Control messages stay JSON. */
export const BINARY_FRAME_MAGIC = 0xc1
export const BINARY_FRAME_HEADER = 15
/** Stream IDs must fit here; generate them with `streamID()` (12 chars). */
export const BINARY_FRAME_ID_BYTES = 12

export const BinaryFrameKind = {
  RequestChunk: 1,
  ResponseChunk: 2,
  SocketMessage: 3,
} as const

export const BinaryFrameFlag = {
  PayloadBinary: 1,
} as const

export function encodeBinaryFrame(kind: number, id: string, payload: Uint8Array, flags = 0) {
  const frame = new Uint8Array(BINARY_FRAME_HEADER + payload.length)
  frame[0] = BINARY_FRAME_MAGIC
  frame[1] = kind
  frame[2] = flags
  const encodedID = new TextEncoder().encode(id.slice(0, BINARY_FRAME_ID_BYTES))
  frame.set(encodedID, 3)
  frame.set(payload, BINARY_FRAME_HEADER)
  return frame
}

export function decodeBinaryFrame(value: Uint8Array) {
  if (value.length < BINARY_FRAME_HEADER || value[0] !== BINARY_FRAME_MAGIC) return
  const kind = value[1]
  if (
    kind !== BinaryFrameKind.RequestChunk &&
    kind !== BinaryFrameKind.ResponseChunk &&
    kind !== BinaryFrameKind.SocketMessage
  )
    return
  const id = new TextDecoder().decode(value.subarray(3, BINARY_FRAME_HEADER)).replace(/\0+$/, "")
  if (!id) return
  return {
    kind,
    flags: value[2],
    id,
    payload: value.subarray(BINARY_FRAME_HEADER),
  }
}
