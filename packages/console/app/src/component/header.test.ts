import { expect, test } from "bun:test"

test("uses the shared OpenCtrlC logo instead of a page-local mark", async () => {
  const source = await Bun.file(new URL("./header.tsx", import.meta.url)).text()

  expect(source).toContain('import { Logo } from "@openctrlc/ui/logo"')
  expect(source).toContain('<Logo class="site-logo-image" />')
  expect(source).not.toContain('data-slot="mark"')
  expect(source).not.toContain('data-slot="wordmark"')
})
