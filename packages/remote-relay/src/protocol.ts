export type RelayHostMessage =
  | { type: "session.create" }
  | { type: "session.resume"; sessionID: string; hostToken: string }
  | { type: "session.ping"; pingID?: string }
  | { type: "session.stop"; sessionID: string; hostToken: string }
  | { type: "pair.rotate"; sessionID: string; hostToken: string }
  | { type: "pair.approve" | "pair.deny"; sessionID: string; hostToken: string; pairID: string }
  | { type: "pair.received"; sessionID: string; hostToken: string; pairID: string }
  | { type: "viewer.revoke"; sessionID: string; hostToken: string; viewerID: string }
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
  | { type: "session.created"; sessionID: string; hostToken: string; joinToken: string; url: string }
  | { type: "session.resumed"; sessionID: string; hostToken: string; url: string }
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

export function encodeBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
}

export function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}
