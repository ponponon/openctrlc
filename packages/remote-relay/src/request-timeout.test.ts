import { expect, test } from "bun:test"
import { keepEventStreamAlive, ResponseHeadersTimeoutError, withResponseHeadersTimeout } from "./request-timeout"

test("disables the request idle timeout for event streams", () => {
  const values: number[] = []
  keepEventStreamAlive(new Headers({ "content-type": "text/event-stream; charset=utf-8" }), (seconds) => values.push(seconds))
  expect(values).toEqual([0])
})

test("keeps normal responses under the configured server timeout", () => {
  const values: number[] = []
  keepEventStreamAlive(new Headers({ "content-type": "application/json" }), (seconds) => values.push(seconds))
  expect(values).toEqual([])
})

test("returns response headers when the desktop responds before the deadline", async () => {
  const response = { status: 200, headers: { "content-type": "application/json" } }
  expect(await withResponseHeadersTimeout(Promise.resolve(response), 100)).toEqual(response)
})

test("rejects a stalled response-header wait with a timeout error", async () => {
  const pending = new Promise<never>(() => {})
  await expect(withResponseHeadersTimeout(pending, 10)).rejects.toBeInstanceOf(ResponseHeadersTimeoutError)
})
