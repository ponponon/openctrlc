import { describe, expect, test } from "bun:test"
import { consumeRejectedPeerStream, type RejectedPeerStream } from "./remote-peer-rejection"

function stream(): RejectedPeerStream {
  return { peerID: "peer-a", receivedBytes: 0, inputEnded: false, timeout: setTimeout(() => {}, 30_000) }
}

describe("consumeRejectedPeerStream", () => {
  test("discards queued upload chunks and the request end without affecting the peer", () => {
    const rejected = stream()
    expect(consumeRejectedPeerStream(rejected, "peer-a", "request.chunk", 24 * 1024)).toBe("discard")
    expect(rejected.receivedBytes).toBe(24 * 1024)
    expect(consumeRejectedPeerStream(rejected, "peer-a", "request.end")).toBe("discard")
    expect(rejected.inputEnded).toBe(true)
    expect(consumeRejectedPeerStream(rejected, "peer-a", "request.chunk", 1)).toBe("invalid")
    clearTimeout(rejected.timeout)
  })

  test("clears on cancellation or socket close", () => {
    for (const type of ["request.cancel", "socket.close"]) {
      const rejected = stream()
      expect(consumeRejectedPeerStream(rejected, "peer-a", type)).toBe("clear")
      clearTimeout(rejected.timeout)
    }
  })

  test("rejects streams from another peer, unknown messages, and oversized queued bodies", () => {
    const rejected = stream()
    expect(consumeRejectedPeerStream(rejected, "peer-b", "request.chunk", 1)).toBe("invalid")
    expect(consumeRejectedPeerStream(rejected, "peer-a", "response.credit")).toBe("invalid")
    expect(consumeRejectedPeerStream(rejected, "peer-a", "request.chunk", 16 * 1024 * 1024 + 1)).toBe("invalid")
    clearTimeout(rejected.timeout)
  })
})
