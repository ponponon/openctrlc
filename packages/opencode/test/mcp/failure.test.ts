import { expect, test } from "bun:test"
import { classifyMcpFailure } from "../../src/mcp/index"

test("classifies browser-control port conflicts without hiding other MCP failures", () => {
  expect(classifyMcpFailure("Configured port 8089 is already in use. Please configure a different port.")).toBe(
    "port_in_use",
  )
  expect(classifyMcpFailure("Error: connect ECONNREFUSED 127.0.0.1:8089")).toBe("other")
})
