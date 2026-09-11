import { expect, test } from "bun:test"
import { Brand } from "@openctrlc/identity"
import { debugInitializeRequest } from "../src/mcp/client-info"

const read = (path: string) => Bun.file(path).text()

test("uses the current installer and Pages deployment contract", async () => {
  const workflow = await read("../../.github/workflows/deploy.yml")
  const action = await read("../../github/action.yml")

  expect(action).toContain("https://raw.githubusercontent.com/ponponon/openctrlc/dev/install")
  expect(workflow).toContain("openctrlc")
  expect(workflow).toContain("openctrlc-docs")
  expect(action).toContain("run: openctrlc github run")
  expect(workflow).not.toContain("https://opencode.ai/install")
})

test("uses the product CLI for MCP user guidance and local detection", async () => {
  const source = await read("./src/mcp/index.ts")

  expect(source).toContain("Brand.cli")
  expect(source).not.toContain("Run: opencode mcp auth")
  expect(source).not.toContain('cmd === "opencode"')
})

test("uses the product CLI in Parallel search User-Agent", () => {
  expect(Brand.cli).toBe("openctrlc")
})

test("uses the product CLI in the web search User-Agent", async () => {
  const source = await read("./src/tool/websearch.ts")

  expect(source).toContain('"User-Agent": `${Brand.cli}/${InstallationVersion}`')
  expect(source).not.toContain('"User-Agent": `opencode/${InstallationVersion}`')
})

test("uses product identity for all MCP client initialization paths", async () => {
  const mcp = await read("./src/mcp/index.ts")
  const debug = await read("./src/cli/cmd/mcp.ts")
  const oauth = await read("./src/mcp/oauth-provider.ts")

  expect(mcp).toContain("name: Brand.cli")
  expect(debug).toContain("debugInitializeRequest")
  expect(debug).toContain("name: Brand.cli")
  expect(oauth).toContain("client_name: Brand.name")
  expect(mcp).not.toContain('name: "opencode"')
  expect(debug).not.toContain('name: "opencode-debug"')
  expect(oauth).not.toContain('client_name: "OpenCode"')
})

test("uses the OpenCtrlC canonical URI for MCP OAuth client metadata", async () => {
  const oauth = await read("./src/mcp/oauth-provider.ts")
  expect(oauth).toContain('client_uri: "https://openctrlc.pages.dev"')
  expect(oauth).not.toContain('client_uri: "https://opencode.ai"')
})

test("builds the debug initialize payload with the product CLI identity", () => {
  expect(debugInitializeRequest()).toMatchObject({
    method: "initialize",
    params: { clientInfo: { name: Brand.cli } },
  })
})
