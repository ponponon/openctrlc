import { expect, test } from "bun:test"
import { ResponseHeadersTimeoutError, withResponseHeadersTimeout } from "./request-timeout"

test("returns response headers when the desktop responds before the deadline", async () => {
  const response = { status: 200, headers: { "content-type": "application/json" } }
  expect(await withResponseHeadersTimeout(Promise.resolve(response), 100)).toEqual(response)
})

test("rejects a stalled response-header wait with a timeout error", async () => {
  const pending = new Promise<never>(() => {})
  await expect(withResponseHeadersTimeout(pending, 10)).rejects.toBeInstanceOf(ResponseHeadersTimeoutError)
})
