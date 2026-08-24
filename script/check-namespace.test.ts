import { expect, test } from "bun:test"
import path from "node:path"
import { scanProductSource, scanText } from "./check-namespace"

test("reports product-owned identity and fallback UA", () => {
  expect(scanProductSource('const host = "opencode.local"', "packages/opencode/src/server/mdns.ts")).toEqual([
    "packages/opencode/src/server/mdns.ts:1:opencode.local",
  ])
  expect(scanProductSource('"User-Agent": "opencode"', "packages/opencode/src/tool/webfetch.ts")).toEqual([
    'packages/opencode/src/tool/webfetch.ts:1:"User-Agent": "opencode"',
  ])
  expect(
    scanProductSource('const username = "opencode"', "packages/app/src/components/dialog-select-server.tsx"),
  ).toEqual(["packages/app/src/components/dialog-select-server.tsx:1:opencode"])
  expect(scanProductSource('const copy = "OpenCode is now authorized."', "packages/core/src/oauth/page.ts")).toEqual([
    "packages/core/src/oauth/page.ts:1:OpenCode",
  ])
})

test("allows only the exact external provider line, not a whole source directory", () => {
  expect(scanProductSource('"User-Agent": `opencode/${version}`', "packages/opencode/src/plugin/xai.ts")).toEqual([])
  expect(scanProductSource('const label = "OpenCode"', "packages/opencode/src/plugin/xai.ts")).toEqual([
    "packages/opencode/src/plugin/xai.ts:1:OpenCode",
  ])
  expect(scanProductSource("OPENCODE_BASE_MODE", "packages/opencode/src/cli/cmd/run/footer.view.tsx")).toEqual([])
  expect(scanProductSource("OPENCODE_BASE_MODE", "packages/opencode/src/cli/cmd/other.ts")).toEqual([
    "packages/opencode/src/cli/cmd/other.ts:1:OPENCODE_BASE_MODE",
  ])
  expect(scanProductSource('const label = "OpenCode"', "packages/opencode/src/plugin/other.ts")).toEqual([
    "packages/opencode/src/plugin/other.ts:1:OpenCode",
  ])
})

test("reports a product token beside an allowed external contract", () => {
  expect(
    scanText("OpenCode uses https://opencode.ai/docs for API docs.", "packages/web/src/content/docs/example.mdx"),
  ).toEqual(["packages/web/src/content/docs/example.mdx:1:OpenCode"])
})

test("reports unauthorized product copy beside an allowed source contract", () => {
  expect(
    scanProductSource(
      'const copy = "OpenCode"; const url = "https://opencode.ai/zen"',
      "packages/app/src/i18n/en.ts",
    ),
  ).toEqual(["packages/app/src/i18n/en.ts:1:OpenCode"])
})

test("reports product UA beside an allowed provider contract", () => {
  expect(
    scanProductSource(
      'const provider = "opencode"; const headers = { "User-Agent": "OpenCode" }',
      "packages/opencode/src/plugin/xai.ts",
    ),
  ).toEqual(["packages/opencode/src/plugin/xai.ts:1:OpenCode"])
})

test("reports internal packages without rejecting external package contracts", () => {
  expect(scanText("@opencode-ai/core and @opencode-ai/sdk", "packages/web/src/content/docs/example.mdx")).toEqual([
    "packages/web/src/content/docs/example.mdx:1:@opencode-ai/core",
  ])
})

test("reports unknown OpenCode packages by default", () => {
  expect(scanText("@opencode-ai/unknown-package", "packages/web/src/content/docs/example.mdx")).toEqual([
    "packages/web/src/content/docs/example.mdx:1:@opencode-ai/unknown-package",
  ])
})

test("preserves external provider and model IDs", () => {
  expect(scanText("opencode/gpt-5.5 and opencode-go/kimi-k3", "packages/web/src/content/docs/zen.mdx")).toEqual([])
})

test("allows an explicitly listed package and its subpath but rejects lookalikes", () => {
  expect(scanText("@opencode-ai/sdk/subpath", "packages/web/src/content/docs/example.mdx")).toEqual([])
  expect(scanText("@opencode-ai/sdk-extra", "packages/web/src/content/docs/example.mdx")).toEqual([
    "packages/web/src/content/docs/example.mdx:1:@opencode-ai/sdk-extra",
  ])
  expect(scanText("@opencode-ai/sdk.extra", "packages/web/src/content/docs/example.mdx")).toEqual([
    "packages/web/src/content/docs/example.mdx:1:@opencode-ai/sdk.extra",
  ])
  expect(
    scanText("@opencode-ai/plugin-extra and @opencode-ai/client-extra", "packages/web/src/content/docs/example.mdx"),
  ).toEqual([
    "packages/web/src/content/docs/example.mdx:1:@opencode-ai/plugin-extra",
    "packages/web/src/content/docs/example.mdx:1:@opencode-ai/client-extra",
  ])
})

test("reports mismatched external domain labels and hrefs", () => {
  expect(scanText("[openctrlc.ai](https://opencode.ai/zen)", "packages/web/src/content/docs/example.mdx")).toEqual([
    "packages/web/src/content/docs/example.mdx:1:external-link-mismatch",
  ])
  expect(scanText("[opencode.ai](https://openctrlc.ai/zen)", "packages/web/src/content/docs/example.mdx")).toEqual([
    "packages/web/src/content/docs/example.mdx:1:external-link-mismatch",
  ])
})

test("rejects lookalike external hostnames and query disguises", () => {
  expect(scanText("[opencode.ai](https://opencode.ai.evil.example/zen)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText("[opencode.ai](https://evil.example/?next=opencode.ai)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText("[openctrlc.ai](https://openctrlc.ai.evil.example/zen)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText("[openctrlc.ai](https://evil.example/?next=openctrlc.ai)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
})

test("strict product source scanning parses bare URL hostnames exactly", () => {
  expect(scanProductSource('const url = "https://opencode.ai/api"', "packages/app/src/entry.tsx")).toEqual([])
  expect(scanProductSource('const url = "https://opencode.ai.evil.example/api"', "packages/app/src/entry.tsx")).toEqual([
    "packages/app/src/entry.tsx:1:external-url-mismatch",
  ])
  expect(scanProductSource('const url = "https://evil.example/?next=opencode.ai/api"', "packages/app/src/entry.tsx")).toEqual([
    "packages/app/src/entry.tsx:1:external-url-mismatch",
  ])
})

test("App i18n only allows explicit provider and Zen contracts", () => {
  expect(scanProductSource('const copy = "OpenCode"', "packages/app/src/i18n/en.ts")).toEqual([
    "packages/app/src/i18n/en.ts:1:OpenCode",
  ])
  expect(
    scanProductSource(
      '"provider.connect.opencodeZen.line1": "OpenCode Zen gives access to curated models."',
      "packages/app/src/i18n/en.ts",
    ),
  ).toEqual([])
  expect(scanProductSource('"dialog.provider.opencode.note": "OpenCode models"', "packages/app/src/i18n/en.ts")).toEqual(
    [],
  )
})

test("reports malformed web URLs as external link mismatches", () => {
  expect(scanText("[opencode.ai](https://[)", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
})

test("normalizes web URL audit matching without accepting disguises", () => {
  expect(scanText("[OpenCode.AI](HTTPS://opencode.ai/zen)", "x.mdx")).toEqual([])
  expect(scanText("[OpenCtrlC.Ai](hTTpS://docs.openctrlc.ai/zen)", "x.mdx")).toEqual([])
  expect(scanText('[Opencode.AI](<HTTPS://docs.opencode.ai/zen> "title")', "x.mdx")).toEqual([])
  expect(scanText("[OpenCtrlC.AI](<hTTpS://docs.openctrlc.ai/zen> 'title')", "x.mdx")).toEqual([])
  expect(scanText("[OpenCode.AI](HTTPS://opencode.ai.evil.example/zen)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText("[OpenCode.AI](HTTPS://evil.example/?next=opencode.ai)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText("[OpenCtrlC.AI](HTTPS://openctrlc.ai.evil.example/zen)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText("[OpenCtrlC.AI](HTTPS://evil.example/?next=openctrlc.ai)", "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText('[OpenCode.AI](<HTTPS://opencode.ai.evil.example/zen> "title")', "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
})

test("rejects malformed branded web links instead of skipping the audit", () => {
  expect(scanText("[opencode.ai](https://evil.example/zen bad)", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
  expect(scanText("[opencode.ai](https://evil.example/zen", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
  expect(scanText("[opencode.ai](https://[ bad)", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
  expect(scanText('[opencode.ai](<https://evil.example/zen> "a) b")', "x.mdx")).toEqual([
    "x.mdx:1:external-link-mismatch",
  ])
  expect(scanText('[opencode.ai](<https://opencode.ai/zen> "a) b")', "x.mdx")).toEqual([])
  expect(scanText("opencode/gpt-5.5 and opencode-go/kimi-k3", "x.mdx")).toEqual([])
})

test("keeps every translated provider Zen link label aligned with its href", async () => {
  const root = path.resolve(import.meta.dirname, "..")
  const files = (
    await Bun.$`git ls-files packages/web/src/content/docs/**/providers.mdx packages/web/src/content/docs/providers.mdx`
      .cwd(root)
      .text()
  )
    .trim()
    .split("\n")
  expect(files).toHaveLength(18)
  for (const file of files) {
    const source = await Bun.file(path.join(root, file)).text()
    expect(source).not.toContain("[opencode.ai/auth](https://opencode.ai/zen)")
    if (source.includes("https://opencode.ai/zen"))
      expect(source).toContain("[opencode.ai/zen](https://opencode.ai/zen)")
  }
})
