import { expect, test } from "bun:test"

const read = (path: string) => Bun.file(path).text()
const legacyPersistenceKey = /opencode\.[A-Za-z0-9_.-]+\.dat(?::[A-Za-z0-9_.-]+)?/g

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

test("all E2E TypeScript fixtures use OpenCtrlC keys except the exact legacy negative", async () => {
  const specs: string[] = []
  for await (const path of new Bun.Glob("e2e/**/*.ts").scan({ cwd: "." })) specs.push(path)
  const legacySpecs = specs.filter((path) => path === "e2e/regression/legacy-new-session.spec.ts")

  expect(legacySpecs).toEqual(["e2e/regression/legacy-new-session.spec.ts"])

  for (const path of specs) {
    const source = await read(path)
    const legacyKeys = [...source.matchAll(legacyPersistenceKey)].map((match) => match[0])
    if (path === "e2e/regression/legacy-new-session.spec.ts") {
      expect(legacyKeys).toEqual(["opencode.window.browser.dat:tabs"])
      expect(source).toContain("legacy persistence key is migrated")
      continue
    }
    expect(legacyKeys).toEqual([])
  }

  expect(await read("e2e/performance/timeline/timeline-test-helpers.ts")).toEqual(
    expect.stringContaining("openctrlc.window.browser.dat:tabs"),
  )
  expect(await read("e2e/regression/cross-server-tab-close.spec.ts")).toEqual(
    expect.stringContaining("openctrlc.global.dat:server"),
  )
  expect(specs.length).toBeGreaterThan(0)
})
