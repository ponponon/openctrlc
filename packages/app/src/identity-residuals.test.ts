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
  const expectedPersistence = new Map([
    [
      "e2e/performance/timeline/timeline-test-helpers.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    ["e2e/performance/timeline-stability/fixture.ts", ["openctrlc.global.dat:language"]],
    [
      "e2e/regression/cross-server-tab-close.spec.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    [
      "e2e/regression/file-browser-sidebar-tab-switch.spec.ts",
      [
        "openctrlc.global.dat:server",
        "openctrlc.global.dat:layout",
        "openctrlc.global.dat:review-panel-v2",
        "openctrlc.window.browser.dat:tabs",
      ],
    ],
    [
      "e2e/regression/open-file-expand-folder.spec.ts",
      [
        "openctrlc.global.dat:server",
        "openctrlc.global.dat:layout",
        "openctrlc.global.dat:review-panel-v2",
        "openctrlc.window.browser.dat:tabs",
      ],
    ],
    ["e2e/regression/project-picker-recent-search.spec.ts", ["openctrlc.global.dat:server"]],
    [
      "e2e/regression/remote-session-settings.spec.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    ["e2e/regression/remote-tab-busy.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    [
      "e2e/regression/review-open-file.spec.ts",
      [
        "openctrlc.global.dat:server",
        "openctrlc.global.dat:layout",
        "openctrlc.global.dat:review-panel-v2",
        "openctrlc.window.browser.dat:tabs",
      ],
    ],
    ["e2e/regression/review-tab-switch.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    [
      "e2e/regression/review-state-persistence.spec.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    ["e2e/regression/review-terminal-stacked.spec.ts", ["openctrlc.global.dat:layout"]],
    ["e2e/regression/session-list-path-loading.spec.ts", ["openctrlc.global.dat:server"]],
    [
      "e2e/regression/session-todo-dock-navigation.spec.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    [
      "e2e/regression/subagent-child-navigation.spec.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    ["e2e/regression/tab-navigate-mousedown.spec.ts", ["openctrlc.window.browser.dat:tabs"]],
    ["e2e/regression/terminal-composer-focus.spec.ts", ["openctrlc.global.dat:layout"]],
    [
      "e2e/regression/terminal-tab-switch.spec.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    [
      "e2e/regression/new-session-panel-corner.spec.ts",
      ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"],
    ],
    ["e2e/smoke/session-timeline.spec.ts", ["openctrlc.global.dat:server", "openctrlc.window.browser.dat:tabs"]],
    ["e2e/user-story/model-selection-flow.spec.ts", ["openctrlc.global.dat:server"]],
  ])
  const expectedNoPersistence = new Set([
    "e2e/performance/playwright.uncapped.config.ts",
    "e2e/performance/playwright.config.ts",
    "e2e/performance/benchmark.ts",
    "e2e/performance/chrome-trace.ts",
    "e2e/performance/timeline/first-navigation-benchmark.spec.ts",
    "e2e/performance/timeline/session-tab-flash.spec.ts",
    "e2e/performance/timeline/session-tab-repaint-probe.ts",
    "e2e/performance/timeline/session-tab-switch-benchmark.spec.ts",
    "e2e/performance/timeline/session-tab-switch-metrics.ts",
    "e2e/performance/timeline/session-tab-switch-probe.ts",
    "e2e/performance/timeline/session-timeline-benchmark.fixture.ts",
    "e2e/performance/timeline/session-timeline-benchmark.spec.ts",
    "e2e/performance/timeline/session-timeline-profile.ts",
    "e2e/performance/timeline/session-timeline-stream-probe.ts",
    "e2e/performance/timeline/session-timeline-stress.fixture.ts",
    "e2e/performance/timeline/first-navigation-metrics.ts",
    "e2e/performance/timeline/first-navigation-probe.ts",
    "e2e/performance/timeline/navigation-milestones.ts",
    "e2e/performance/timeline/home-tab-navigation-benchmark.spec.ts",
    "e2e/performance/timeline/review-pane-scaling-benchmark.spec.ts",
    "e2e/performance/timeline/session-parent-hydration-benchmark.spec.ts",
    "e2e/performance/timeline-stability/adverse.spec.ts",
    "e2e/performance/timeline-stability/context-matrix.spec.ts",
    "e2e/performance/timeline-stability/environment-matrix.spec.ts",
    "e2e/performance/timeline-stability/file-matrix.spec.ts",
    "e2e/performance/timeline-stability/file-mutation.spec.ts",
    "e2e/performance/timeline-stability/fixture.test.ts",
    "e2e/performance/timeline-stability/interaction.spec.ts",
    "e2e/performance/timeline-stability/lifecycle.spec.ts",
    "e2e/performance/timeline-stability/oracle-browser.spec.ts",
    "e2e/performance/timeline-stability/playwright.config.ts",
    "e2e/performance/timeline-stability/scroll-interaction.spec.ts",
    "e2e/performance/timeline-stability/shell-matrix.spec.ts",
    "e2e/performance/timeline-stability/tool-mutation.spec.ts",
    "e2e/performance/timeline-stability/tools.spec.ts",
    "e2e/performance/timeline-stability/transition-matrix.spec.ts",
    "e2e/performance/unit/chrome-trace-write.test.ts",
    "e2e/performance/unit/first-navigation-metrics.test.ts",
    "e2e/performance/unit/mock-server.test.ts",
    "e2e/performance/unit/navigation-milestones.test.ts",
    "e2e/performance/unit/session-tab-repaint-probe.test.ts",
    "e2e/performance/unit/session-tab-switch-metrics.test.ts",
    "e2e/performance/unit/session-tab-switch-probe.test.ts",
    "e2e/performance/unit/session-timeline-stream-probe.test.ts",
    "e2e/performance/unit/session-timeline-visual-tracking.test.ts",
    "e2e/performance/unit/timeline-test-helpers.test.ts",
    "e2e/performance/unit/visual-stability.test.ts",
    "e2e/reproduction/timeline-suspense/playwright.config.ts",
    "e2e/reproduction/timeline-suspense/timeline-suspense.repro.ts",
    "e2e/reproduction/timeline-suspense/vite.config.ts",
    "e2e/regression/prompt-input-v2-command-draft.spec.ts",
    "e2e/regression/prompt-thinking-level.spec.ts",
    "e2e/regression/review-image-flash.spec.ts",
    "e2e/regression/review-line-comment.spec.ts",
    "e2e/regression/session-request-docks.spec.ts",
    "e2e/regression/session-timeline-accessibility.spec.ts",
    "e2e/regression/session-timeline-collapse-state.spec.ts",
    "e2e/regression/session-timeline-context-resize.spec.ts",
    "e2e/regression/session-timeline-context-state.spec.ts",
    "e2e/regression/session-timeline-file-projection.spec.ts",
    "e2e/regression/session-timeline-history-root.spec.ts",
    "e2e/regression/session-timeline-lifecycle-state.spec.ts",
    "e2e/regression/session-timeline-locale-projection.spec.ts",
    "e2e/regression/session-timeline-projection.spec.ts",
    "e2e/regression/session-timeline-reasoning-projection.spec.ts",
    "e2e/regression/session-timeline-reducer-projection.spec.ts",
    "e2e/regression/session-timeline-shell-outline.spec.ts",
    "e2e/regression/session-timeline-tool-projection.spec.ts",
    "e2e/regression/session-timeline-transport.spec.ts",
    "e2e/regression/session-timeline-file-state.spec.ts",
    "e2e/regression/session-timeline-tool-state.spec.ts",
    "e2e/regression/terminal-hidden.spec.ts",
    "e2e/smoke/session-timeline.fixture.ts",
    "e2e/utils/errors.ts",
    "e2e/utils/mock-server.ts",
    "e2e/utils/sse-transport.ts",
    "e2e/utils/visual-stability.ts",
    "e2e/utils/visual-stability/analyzer.ts",
    "e2e/utils/visual-stability/capture.ts",
    "e2e/utils/visual-stability/index.ts",
    "e2e/utils/visual-stability/invariant.ts",
    "e2e/utils/visual-stability/model.ts",
    "e2e/utils/visual-stability/probe.ts",
    "e2e/utils/visual-stability/regions.ts",
    "e2e/utils/visual-stability/reporter.ts",
    "e2e/utils/visual-stability/scenario.ts",
    "e2e/utils/waits.ts",
  ])

  expect(legacySpecs).toEqual(["e2e/regression/legacy-new-session.spec.ts"])
  const discoveredPersistence = new Map<string, string[]>()

  for (const path of specs) {
    const source = await read(path)
    const legacyKeys = [...new Set([...source.matchAll(legacyPersistenceKey)].map((match) => match[0]))]
    const keys = [...new Set([...source.matchAll(persistenceKey)].map((match) => match[0]))]
    if (path === "e2e/regression/legacy-new-session.spec.ts") {
      expect(legacyKeys).toEqual(["opencode.window.browser.dat:tabs"])
      expect(keys).toEqual(["opencode.window.browser.dat:tabs"])
      expect(source).toContain("legacy persistence key is migrated")
      continue
    }
    expect(legacyKeys).toEqual([])
    if (keys.length > 0) discoveredPersistence.set(path, keys.sort())
  }

  expect(discoveredPersistence).toEqual(
    new Map([...expectedPersistence.entries()].map(([path, keys]) => [path, keys.sort()])),
  )
  expect(new Set(specs)).toEqual(
    new Set([...expectedPersistence.keys(), ...expectedNoPersistence, "e2e/regression/legacy-new-session.spec.ts"]),
  )
  expect(new Set([...expectedNoPersistence].filter((path) => discoveredPersistence.has(path)))).toEqual(new Set())
  for (const path of expectedNoPersistence) expect(await read(path)).not.toMatch(persistenceKey)
  expect(specs.length).toBeGreaterThan(0)
})
