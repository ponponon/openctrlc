import { expect, test } from "bun:test"
import { Brand } from "@openctrlc/identity"

const read = (path: string) => Bun.file(path).text()

test("uses the current installer and CLI contract in locale sync", async () => {
  const workflow = await read("../../.github/workflows/docs-locale-sync.yml")

  expect(workflow).toContain("https://openctrlc.ai/install")
  expect(workflow).toContain(`${Brand.cli} run`)
  expect(workflow).toContain("OPENCODE_API_KEY")
  expect(workflow).not.toContain("https://opencode.ai/install")
  expect(workflow).not.toContain("opencode run")
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
