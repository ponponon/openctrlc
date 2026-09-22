import { expect, test } from "bun:test"
import { wrapClientError } from "../src/error-interceptor"

test("uses the OpenCtrlC server name for empty responses", () => {
  const error = wrapClientError(
    undefined,
    new Response(null, { status: 499, statusText: "unknown" }),
    new Request("http://127.0.0.1:4096/command", { method: "GET" }),
    { throwOnError: true },
  )

  expect(error).toBeInstanceOf(Error)
  if (!(error instanceof Error)) throw new Error("Expected an Error")
  expect(error.message).toBe(
    "openctrlc server GET http://127.0.0.1:4096/command → 499 unknown: (empty response body)",
  )
})
