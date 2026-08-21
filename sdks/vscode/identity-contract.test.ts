import { expect, test } from "bun:test"

const read = (path: string) => Bun.file(path).text()

test("VS Code integration uses OpenCtrlC product commands and runtime markers", async () => {
  const manifest = await read("./package.json")
  const extension = await read("./src/extension.ts")
  const readme = await read("./README.md")

  for (const source of [manifest, extension, readme]) {
    expect(source).not.toContain("OPENCODE_CALLER")
    expect(source).not.toContain("_EXTENSION_OPENCODE_PORT")
    expect(source).not.toContain("opencode --port")
  }

  expect(manifest).toContain('"displayName": "OpenCtrlC"')
  expect(manifest).toContain('"publisher": "sst-dev"')
  expect(manifest).toContain('"openctrlc.openTerminal"')
  expect(extension).toContain('const TERMINAL_NAME = "openctrlc"')
  expect(extension).toContain("OPENCTRLC_CALLER")
  expect(extension).toContain("_EXTENSION_OPENCTRLC_PORT")
  expect(extension).toContain("openctrlc --port")
  expect(readme).toContain("OpenCtrlC VS Code Extension")
})
