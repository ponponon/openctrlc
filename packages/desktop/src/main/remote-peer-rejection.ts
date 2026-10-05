export type RejectedPeerStream = {
  peerID: string
  receivedBytes: number
  inputEnded: boolean
  timeout: ReturnType<typeof setTimeout>
}

export function consumeRejectedPeerStream(
  stream: RejectedPeerStream,
  peerID: string,
  type: string,
  bytes = 0,
): "discard" | "clear" | "invalid" {
  if (stream.peerID !== peerID) return "invalid"
  if (type === "request.chunk" && !stream.inputEnded) {
    stream.receivedBytes += bytes
    return stream.receivedBytes <= 16 * 1024 * 1024 ? "discard" : "invalid"
  }
  if (type === "request.end") {
    stream.inputEnded = true
    return "discard"
  }
  if (type === "request.cancel" || type === "socket.close") return "clear"
  return "invalid"
}
