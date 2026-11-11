import { describe, expect, test } from "bun:test"
import { isDocumentNavigation } from "./navigation"

const url = "https://openctrlc-remote.quniv.cn/server/abc/session/ses_example"

describe("isDocumentNavigation", () => {
  test("recognizes a top-level document navigation", () => {
    const request = new Request(url, {
      headers: { "sec-fetch-dest": "document", accept: "text/html,application/xhtml+xml" },
    })
    expect(isDocumentNavigation(request)).toBe(true)
  })

  test("falls back to Accept when the browser sends no fetch metadata", () => {
    const request = new Request(url, {
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    })
    expect(isDocumentNavigation(request)).toBe(true)
  })

  test("keeps fetch/XHR calls on the plain 401 path", () => {
    const request = new Request(url, {
      headers: { "sec-fetch-dest": "empty", accept: "*/*" },
    })
    expect(isDocumentNavigation(request)).toBe(false)
  })

  test("fetch metadata wins over an HTML Accept header", () => {
    const request = new Request(url, {
      headers: { "sec-fetch-dest": "iframe", accept: "text/html" },
    })
    expect(isDocumentNavigation(request)).toBe(false)
  })

  test("ignores API requests without an HTML Accept header", () => {
    const request = new Request(url, { headers: { accept: "application/json" } })
    expect(isDocumentNavigation(request)).toBe(false)
  })
})
