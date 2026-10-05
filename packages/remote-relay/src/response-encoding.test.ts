import { describe, expect, test } from "bun:test"
import { sanitizeResponseHeaders, shouldGzipToViewer } from "./response-encoding"

describe("remote response encoding", () => {
  test("keeps host-compressed JSON and prevents a second gzip pass", () => {
    const headers = sanitizeResponseHeaders({
      "content-encoding": "gzip",
      "content-length": "1024",
      "content-type": "application/json; charset=utf-8",
    })

    expect(headers.get("content-encoding")).toBe("gzip")
    expect(headers.has("content-length")).toBe(false)
    expect(
      shouldGzipToViewer(new Request("https://example.test", { headers: { "accept-encoding": "gzip" } }), headers),
    ).toBe(false)
  })

  test("compresses unencoded JSON only when the viewer accepts gzip", () => {
    const headers = new Headers({ "content-type": "application/json; charset=utf-8" })

    expect(
      shouldGzipToViewer(new Request("https://example.test", { headers: { "accept-encoding": "gzip" } }), headers),
    ).toBe(true)
    expect(
      shouldGzipToViewer(new Request("https://example.test", { headers: { "accept-encoding": "gzip;q=0" } }), headers),
    ).toBe(false)
    expect(shouldGzipToViewer(new Request("https://example.test"), headers)).toBe(false)
  })

  test("does not compress event streams or retain unsupported upstream encodings", () => {
    const headers = sanitizeResponseHeaders({
      "content-encoding": "br",
      "content-length": "1024",
      "content-type": "text/event-stream",
    })

    expect(headers.has("content-encoding")).toBe(false)
    expect(headers.has("content-length")).toBe(false)
    expect(
      shouldGzipToViewer(new Request("https://example.test", { headers: { "accept-encoding": "gzip" } }), headers),
    ).toBe(false)
  })
})
