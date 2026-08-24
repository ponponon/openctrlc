import { expect, test } from "bun:test"

const read = (path: string) => Bun.file(path).text()
const legacyPersistenceKey = /opencode\.[A-Za-z0-9_.-]+\.dat(?::[A-Za-z0-9_.-]+)?/g
const persistenceKey = /(?:openctrlc|opencode)\.[A-Za-z0-9_.-]+\.dat(?::[A-Za-z0-9_.-]+)?/g

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

test("uses the product identity for server defaults and config copy", async () => {
  const selectServer = await read("./src/components/dialog-select-server.tsx")
  const terminal = await read("./src/components/terminal.tsx")
  const status = await read("./src/components/status-popover-body.tsx")

  expect(selectServer).toContain("const DEFAULT_USERNAME = Brand.cli")
  expect(terminal).toContain("const username = auth?.username ?? Brand.cli")
  expect(status).toContain("Brand.configFile")
  expect(selectServer).not.toContain('DEFAULT_USERNAME = "opencode"')
  expect(terminal).not.toContain('auth?.username ?? "opencode"')
  expect(status).not.toContain('"opencode.json"')
})

test("all E2E TypeScript fixtures use the expected persistence namespace", async () => {
  const specs: string[] = []
  for await (const path of new Bun.Glob("e2e/**/*.ts").scan({ cwd: "." })) specs.push(path)
  const legacySpecs = specs.filter((path) => path === "e2e/regression/legacy-new-session.spec.ts")
  const expectedKeys = new Map([
    ["e2e/performance/timeline/timeline-test-helpers.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/performance/timeline-stability/fixture.ts", ["openctrlc.global.dat:language"]],
    ["e2e/regression/cross-server-tab-close.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/file-browser-sidebar-tab-switch.spec.ts", ["openctrlc.global.dat:server", "openctrlc.global.dat:layout", "openctrlc.global.dat:review-panel-v2", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/open-file-expand-folder.spec.ts", ["openctrlc.global.dat:server", "openctrlc.global.dat:layout", "openctrlc.global.dat:review-panel-v2", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/project-picker-recent-search.spec.ts", ["openctrlc.global.dat:server"]],
    ["e2e/regression/remote-session-settings.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/remote-tab-busy.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/review-open-file.spec.ts", ["openctrlc.global.dat:server", "openctrlc.global.dat:layout", "openctrlc.global.dat:review-panel-v2", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/review-tab-switch.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/review-state-persistence.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/review-terminal-stacked.spec.ts", ["openctrlc.global.dat:layout"]],
    ["e2e/regression/session-list-path-loading.spec.ts", ["openctrlc.global.dat:server"]],
    ["e2e/regression/session-todo-dock-navigation.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/subagent-child-navigation.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/tab-navigate-mousedown.spec.ts", ["openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/terminal-composer-focus.spec.ts", ["openctrlc.global.dat:layout"]],
    ["e2e/regression/terminal-tab-switch.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/new-session-panel-corner.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/smoke/session-timeline.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/user-story/model-selection-flow.spec.ts", ["openctrlc.global.dat:server"]],
  ])

  expect(legacySpecs).toEqual(["e2e/regression/legacy-new-session.spec.ts"])

  for (const path of specs) {
    const source = await read(path)
    const legacyKeys = [...source.matchAll(legacyPersistenceKey)].map((match) => match[0])
    const keys = [...source.matchAll(persistenceKey)].map((match) => match[0])
    if (path === "e2e/regression/legacy-new-session.spec.ts") {
      expect(legacyKeys).toEqual(["opencode.window.browser.dat:tabs"])
      expect(source).toContain("legacy persistence key is migrated")
      continue
    }
    expect(legacyKeys).toEqual([])
    for (const key of expectedKeys.get(path) ?? []) expect(keys).toContain(key)
  }

  expect([...expectedKeys.keys()].every((path) => specs.includes(path))).toBe(true)
  expect(specs.length).toBeGreaterThan(0)
})
