import { expect, test } from "bun:test"
import path from "node:path"
import { scanText } from "./check-namespace"

test("reports a product token beside an allowed external contract", () => {
  expect(scanText("OpenCode uses https://opencode.ai/docs for API docs.", "packages/web/src/content/docs/example.mdx")).toEqual([
    "packages/web/src/content/docs/example.mdx:1:OpenCode",
  ])
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
  expect(scanText("@opencode-ai/plugin-extra and @opencode-ai/client-extra", "packages/web/src/content/docs/example.mdx")).toEqual([
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
  expect(scanText("[opencode.ai](https://opencode.ai.evil.example/zen)", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
  expect(scanText("[opencode.ai](https://evil.example/?next=opencode.ai)", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
  expect(scanText("[openctrlc.ai](https://openctrlc.ai.evil.example/zen)", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
  expect(scanText("[openctrlc.ai](https://evil.example/?next=openctrlc.ai)", "x.mdx")).toEqual(["x.mdx:1:external-link-mismatch"])
})

test("keeps every translated provider Zen link label aligned with its href", async () => {
  const root = path.resolve(import.meta.dirname, "..")
  const files = (await Bun.$`git ls-files packages/web/src/content/docs/**/providers.mdx packages/web/src/content/docs/providers.mdx`.cwd(root).text()).trim().split("\n")
  expect(files).toHaveLength(18)
  for (const file of files) {
    const source = await Bun.file(path.join(root, file)).text()
    expect(source).not.toContain("[opencode.ai/auth](https://opencode.ai/zen)")
    if (source.includes("https://opencode.ai/zen")) expect(source).toContain("[opencode.ai/zen](https://opencode.ai/zen)")
  }
})
