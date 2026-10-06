import { describe, expect, test } from "bun:test"
import { detectServerProtocol, ServerProtocolDetectionError } from "./server-protocol"

const server = { url: "http://localhost:4096" }
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
const mockFetch = (run: (input: string | URL | Request) => Promise<Response>) =>
  Object.assign(run, { preconnect: globalThis.fetch.preconnect })

describe("detectServerProtocol", () => {
  test("runs health probes concurrently and prefers V1 when both API generations exist", async () => {
    const calls: string[] = []
    let active = 0
    let maximumActive = 0
    const fetcher = mockFetch(async (input) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname
      calls.push(path)
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
      if (path === "/global/health") return json({ healthy: true, version: "1.18.4" })
      return json({ healthy: true, version: "2.0.0", pid: 123 })
    })

    expect(await detectServerProtocol(server, fetcher)).toBe("v1")
    expect(calls.sort()).toEqual(["/api/health", "/global/health"])
    expect(maximumActive).toBe(2)
  })

  test("recognizes V2 health by its process identifier", async () => {
    const fetcher = mockFetch((input) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname
      if (path === "/global/health") return Promise.resolve(json({}, 404))
      return Promise.resolve(json({ healthy: true, version: "2.0.0", pid: 123 }))
    })

    expect(await detectServerProtocol(server, fetcher)).toBe("v2")
  })

  test("recognizes the transitional V1 API health response", async () => {
    const fetcher = mockFetch((input) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname
      if (path === "/global/health") return Promise.resolve(json({}, 404))
      return Promise.resolve(json({ healthy: true }))
    })

    expect(await detectServerProtocol(server, fetcher)).toBe("v1")
  })

  test("retries transient Relay disconnects before resolving the protocol", async () => {
    const calls = new Map<string, number>()
    const fetcher = mockFetch(async (input) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname
      const count = (calls.get(path) ?? 0) + 1
      calls.set(path, count)
      if (count === 1) return json({ error: "Desktop is disconnected" }, 503)
      if (path === "/global/health") return json({}, 404)
      return json({ healthy: true, version: "2.0.0", pid: 123 })
    })

    expect(await detectServerProtocol(server, fetcher)).toBe("v2")
    expect(calls).toEqual(new Map([["/global/health", 2], ["/api/health", 2]]))
  })

  test("bounds repeated transient protocol failures to two retries", async () => {
    const calls = new Map<string, number>()
    const fetcher = mockFetch(async (input) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname
      calls.set(path, (calls.get(path) ?? 0) + 1)
      return json({ error: "Desktop is disconnected" }, 503)
    })

    await expect(detectServerProtocol(server, fetcher)).rejects.toMatchObject({
      name: "ServerProtocolDetectionError",
      v1Probe: "http-503",
      v2Probe: "http-503",
    })
    expect(calls).toEqual(new Map([["/global/health", 3], ["/api/health", 3]]))
  })

  test("does not mistake two malformed health responses for an empty V2 server", async () => {
    const fetcher = mockFetch(async (input) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname
      if (path === "/global/health")
        return new Response("not-json", { headers: { "content-type": "application/json" } })
      return new Response("<html>relay fallback</html>", { headers: { "content-type": "text/html" } })
    })

    await expect(detectServerProtocol(server, fetcher)).rejects.toMatchObject({
      name: "ServerProtocolDetectionError",
      v1Probe: "invalid-json-response",
      v2Probe: "non-json-response",
    })
  })

  test("does not infer a protocol when both supported health endpoints are unavailable", async () => {
    const fetcher = mockFetch(async () => json({}, 404))

    await expect(detectServerProtocol(server, fetcher)).rejects.toBeInstanceOf(ServerProtocolDetectionError)
  })
})
