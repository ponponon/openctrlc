import { describe, expect } from "bun:test"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { LayerNode } from "@openctrlc/core/effect/layer-node"
import { Effect } from "effect"
import { testEffect } from "../lib/effect"
import { MCP } from "../../src/mcp/index"

const it = testEffect(LayerNode.compile(MCP.node))

const serve = Effect.acquireRelease(
  Effect.promise(async () => {
    const requests: Array<{ headers: Headers; body: unknown }> = []
    const protocol = new Server({ name: "headers", version: "1.0.0" }, { capabilities: { tools: {} } })
    protocol.setRequestHandler(ListToolsRequestSchema, () => Promise.resolve({ tools: [] }))
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    })
    await protocol.connect(transport)
    const http = Bun.serve({
      port: 0,
      async fetch(request) {
        requests.push({
          headers: new Headers(request.headers),
          body: await request
            .clone()
            .json()
            .catch(() => undefined),
        })
        return transport.handleRequest(request)
      },
    })
    return {
      requests,
      url: http.url.toString(),
      close: async () => {
        await http.stop(true)
        await protocol.close()
      },
    }
  }),
  (server) => Effect.promise(server.close),
)

describe("mcp.headers", () => {
  it.instance("headers are passed to transports when oauth is enabled (default)", () =>
    Effect.gen(function* () {
      const server = yield* serve
      const mcp = yield* MCP.Service
      const result = yield* mcp.add("test-server", {
        type: "remote",
        url: server.url,
        headers: {
          Authorization: "Bearer test-token",
          "X-Custom-Header": "custom-value",
        },
      })

      expect(result.status).toMatchObject({ "test-server": { status: "connected" } })
      expect(server.requests.length).toBeGreaterThan(0)
      for (const request of server.requests) {
        expect(request.headers.get("authorization")).toBe("Bearer test-token")
        expect(request.headers.get("x-custom-header")).toBe("custom-value")
      }
      expect(
        server.requests.find((request) => (request.body as { method?: string })?.method === "initialize")?.body,
      ).toMatchObject({
        method: "initialize",
        params: { clientInfo: { name: "openctrlc" } },
      })
    }),
  )

  it.instance("headers are passed to transports when oauth is explicitly disabled", () =>
    Effect.gen(function* () {
      const server = yield* serve
      const mcp = yield* MCP.Service
      const result = yield* mcp.add("test-server-no-oauth", {
        type: "remote",
        url: server.url,
        oauth: false,
        headers: {
          Authorization: "Bearer test-token",
        },
      })

      expect(result.status).toMatchObject({ "test-server-no-oauth": { status: "connected" } })
      expect(server.requests.length).toBeGreaterThan(0)
      for (const request of server.requests) {
        expect(request.headers.get("authorization")).toBe("Bearer test-token")
      }
    }),
  )

  it.instance("no requestInit when headers are not provided", () =>
    Effect.gen(function* () {
      const server = yield* serve
      const mcp = yield* MCP.Service
      const result = yield* mcp.add("test-server-no-headers", {
        type: "remote",
        url: server.url,
      })

      expect(result.status).toMatchObject({ "test-server-no-headers": { status: "connected" } })
      expect(server.requests.length).toBeGreaterThan(0)
      for (const request of server.requests) {
        expect(request.headers.has("authorization")).toBe(false)
        expect(request.headers.has("x-custom-header")).toBe(false)
      }
    }),
  )
})
