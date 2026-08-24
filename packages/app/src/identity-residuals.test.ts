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

test("e2e fixtures use OpenCtrlC persistence keys", async () => {
  const helper = await read("./e2e/performance/timeline/timeline-test-helpers.ts")
  const regression = await read("./e2e/regression/cross-server-tab-close.spec.ts")

  expect(helper).toContain("openctrlc.global.dat")
  expect(helper).toContain("openctrlc.window.browser.dat")
  expect(regression).toContain("openctrlc.global.dat")
  expect(regression).toContain("openctrlc.window.browser.dat")
  expect(helper).not.toContain("opencode.global.dat")
  expect(helper).not.toContain("opencode.window.browser.dat")
  expect(regression).not.toContain("opencode.global.dat")
  expect(regression).not.toContain("opencode.window.browser.dat")
})
