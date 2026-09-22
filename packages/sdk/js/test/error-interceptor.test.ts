import { expect, test } from "bun:test"
import { isClientAbortError, wrapClientError } from "../src/error-interceptor"

test("classifies a 499 empty response as a client cancellation", () => {
  const error = wrapClientError(
    undefined,
    new Response(null, { status: 499, statusText: "unknown" }),
    new Request("http://127.0.0.1:4096/command", { method: "GET" }),
    { throwOnError: true },
  )

  expect(error).toBeInstanceOf(Error)
  if (!(error instanceof Error)) throw new Error("Expected an Error")
  expect(error.message).toBe("openctrlc server GET http://127.0.0.1:4096/command → 499 unknown: request cancelled")
  expect(isClientAbortError(error)).toBe(true)
  expect(error.cause).toMatchObject({ kind: "cancelled", status: 499 })
})

test("does not classify an ordinary server error as a client cancellation", () => {
  const error = wrapClientError(
    { name: "ServerError", data: { message: "boom" } },
    new Response(null, { status: 503 }),
    new Request("http://127.0.0.1:4096/mcp", { method: "GET" }),
    { throwOnError: true },
  )

  expect(isClientAbortError(error)).toBe(false)
})
