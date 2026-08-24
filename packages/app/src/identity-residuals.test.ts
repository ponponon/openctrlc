import { expect, test } from "bun:test"

const read = (path: string) => Bun.file(path).text()

test("uses the OpenCtrlC Vite server contract", async () => {
  const env = await read("./src/env.d.ts")
  const entry = await read("./src/entry.tsx")
  const playwright = await read("./playwright.config.ts")

  expect(env).toContain("VITE_OPENCTRLC_SERVER_HOST")
  expect(env).toContain("VITE_OPENCTRLC_SERVER_PORT")
  expect(entry).toContain("VITE_OPENCTRLC_SERVER_HOST")
  expect(entry).toContain("VITE_OPENCTRLC_SERVER_PORT")
  expect(playwright).toContain("VITE_OPENCTRLC_SERVER_HOST")
  expect(playwright).toContain("VITE_OPENCTRLC_SERVER_PORT")
  expect(env).not.toContain("VITE_OPENCODE_SERVER_")
  expect(entry).not.toContain("VITE_OPENCODE_SERVER_")
  expect(playwright).not.toContain("VITE_OPENCODE_SERVER_")
})

test("all E2E persistence fixtures use OpenCtrlC keys except the legacy negative", async () => {
  const specs: string[] = []
  for await (const path of new Bun.Glob("e2e/**/*.spec.ts").scan({ cwd: "." })) specs.push(path)

  for (const path of specs) {
    const source = await read(path)
    if (path === "e2e/regression/legacy-new-session.spec.ts") {
      expect(source).toContain('"opencode.window.browser.dat:tabs"')
      expect(source).toContain("legacy persistence key is migrated")
      continue
    }
    expect(source).not.toContain("opencode.global.dat")
    expect(source).not.toContain("opencode.window.browser.dat")
  }

  expect(specs.length).toBeGreaterThan(0)
})
