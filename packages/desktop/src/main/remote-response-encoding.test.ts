import { describe, expect, test } from "bun:test"
import { remoteAcceptEncoding, shouldCompressRemoteResponse } from "./remote-response-encoding"

describe("remote response compression negotiation", () => {
  test("keeps old Relay uploads uncompressed so the old Relay can gzip once", () => {
    const headers = new Headers({ "accept-encoding": "gzip, br" })
    const acceptEncoding = remoteAcceptEncoding(headers, "relay", false)

    expect(acceptEncoding).toBeNull()
    expect(shouldCompressRemoteResponse(acceptEncoding, "text/html; charset=utf-8", true)).toBe(false)
  })

  test("compresses Relay uploads only after the Relay advertises support", () => {
    const headers = new Headers({ "accept-encoding": "gzip, br" })
    const acceptEncoding = remoteAcceptEncoding(headers, "relay", true)

    expect(acceptEncoding).toBe("gzip, br")
    expect(shouldCompressRemoteResponse(acceptEncoding, "application/json", true)).toBe(true)
  })

  test("keeps peer compression independent from Relay version and ignores HTTP spoofing", () => {
    const peerHeaders = new Headers({ "x-openctrlc-remote-accept-encoding": "gzip" })
    const relayHeaders = new Headers({
      "accept-encoding": "gzip",
      "x-openctrlc-remote-accept-encoding": "gzip",
    })

    expect(remoteAcceptEncoding(peerHeaders, "peer", false)).toBe("gzip")
    expect(remoteAcceptEncoding(relayHeaders, "relay", false)).toBeNull()
    expect(shouldCompressRemoteResponse("gzip;q=0", "text/html", true)).toBe(false)
    expect(shouldCompressRemoteResponse("gzip", "text/event-stream", true)).toBe(false)
    expect(shouldCompressRemoteResponse("gzip", "text/html", false)).toBe(false)
  })
})
