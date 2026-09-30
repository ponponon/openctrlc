export type RelayWorkspaceSnapshot = {
  projects: Array<{ worktree: string; expanded: boolean }>
  lastProject?: string
  sessionIDs: string[]
  activeSessionID?: string
}

export const DEFAULT_VIEWER_LIMIT = 10
export const MIN_VIEWER_LIMIT = 1
export const MAX_VIEWER_LIMIT = 100

export function isViewerLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_VIEWER_LIMIT && value <= MAX_VIEWER_LIMIT
}

export type RelayHostMessage =
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
  | {
      type: "session.created"
      sessionID: string
      hostToken: string
      joinToken: string
      url: string
      viewerLimit: number
      binaryChunks?: boolean
    }
  | {
      type: "session.resumed"
      sessionID: string
      hostToken: string
      url: string
      viewerLimit: number
      binaryChunks?: boolean
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
  | { type: "viewer.list"; devices: Array<{ id: string; device: string }> }
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
