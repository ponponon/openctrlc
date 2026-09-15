import { expect, test } from "bun:test"

test("keeps the shared wordmark branded as OpenCtrlC", async () => {
  const source = (await Bun.file(new URL("./logo.tsx", import.meta.url)).text()).replace(/\r\n/g, "\n")

  expect(source).toContain(">\n        OpenCtrlC\n      </text>")
  expect(source).not.toContain("OpenCode")
})
