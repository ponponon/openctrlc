import { expect, test } from "bun:test"
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
