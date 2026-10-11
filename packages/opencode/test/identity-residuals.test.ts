import { expect, test } from "bun:test"
import { SpoofedOpencodeVersion } from "@openctrlc/core/installation/version"
import { Brand } from "@openctrlc/identity"
import { debugInitializeRequest } from "../src/mcp/client-info"
import semver from "semver"

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

test("zen User-Agent spoofs the upstream version while other requests use product identity", async () => {
  const request = await read("./src/session/llm/request.ts")

  // zen 分支必须伪装上游版本号（>= 1.18.0），禁止退回 InstallationVersion：
  // 1.1.x/local 会被 zen 拒绝并报 "OpenCode 1.18.0 or newer is required"。
  expect(request).toContain("`opencode/${SpoofedOpencodeVersion}`")
  expect(request).not.toContain("`opencode/${InstallationVersion}`")
  // 非 zen 分支用真实产品身份。
  expect(request).toContain("`${Brand.cli}/${InstallationVersion}`")

  // models.opencode.ai 目录与 installation UA 同样不能携带我们自己的版本号。
  const models = await read("../core/src/models-dev.ts")
  expect(models).toContain("`opencode/${InstallationChannel}/${SpoofedOpencodeVersion}/${Flag.OPENCTRLC_CLIENT}`")
  expect(models).not.toContain("`${InstallationChannel}/${InstallationVersion}/")
})

test("spoofed opencode version satisfies the zen free tier minimum", () => {
  // zen 服务端要求 UA 中版本 >= 1.18.0；伪装版本必须是合法 semver 且不低于该下限。
  expect(semver.valid(SpoofedOpencodeVersion)).not.toBeNull()
  expect(semver.gte(SpoofedOpencodeVersion, "1.18.0")).toBe(true)
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
