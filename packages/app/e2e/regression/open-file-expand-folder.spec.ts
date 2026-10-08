import { base64Encode } from "@openctrlc/core/util/encode"
import { expect, test } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/OpenFileExpand"
const projectID = "proj_open_file_expand"
const sessionID = "ses_open_file_expand"
const title = "Open file expand"
const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`
const rootFiles = Array.from({ length: 240 }, (_, index) => ({
  name: `file-${String(index).padStart(3, "0")}.ts`,
  path: `file-${String(index).padStart(3, "0")}.ts`,
  absolute: `${directory}/file-${String(index).padStart(3, "0")}.ts`,
  type: "file" as const,
  ignored: false,
}))

test.use({ viewport: { width: 1440, height: 900 } })

test("expands Windows-separator folders and survives virtual file-tree churn", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "open-file-expand",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: { test: { id: "test", name: "Test", limit: { context: 200_000 } } },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "test" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    vcsDiff: [],
    fileList: (path) => {
      if (path === "frontend\\" || path === "frontend") {
        return [
          {
            name: "app.ts",
            path: "frontend\\app.ts",
            absolute: `${directory}/frontend/app.ts`,
            type: "file" as const,
            ignored: false,
          },
        ]
      }
      if (path) return []
      return [
        {
          name: "frontend",
          path: "frontend\\",
          absolute: `${directory}/frontend`,
          type: "directory" as const,
          ignored: false,
        },
        {
          name: "README.md",
          path: "README.md",
          absolute: `${directory}/README.md`,
          type: "file" as const,
          ignored: false,
        },
        ...rootFiles,
      ]
    },
    fileContent: (path) => ({ type: "text", content: `contents:${path}` }),
    pageMessages: () => ({ items: [] }),
  })

  await page.addInitScript(
    ({ directory, server, sessionID }) => {
      localStorage.setItem(
        "settings.v3",
        JSON.stringify({ general: { newLayoutDesigns: true, shouldDisplayTabsToast: false } }),
      )
      localStorage.setItem(
        "openctrlc.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: directory, expanded: true }] },
          lastProject: { local: directory },
        }),
      )
      localStorage.setItem(
        "openctrlc.global.dat:layout",
        JSON.stringify({ review: { diffStyle: "split", panelOpened: true } }),
      )
      localStorage.setItem(
        "openctrlc.global.dat:review-panel-v2",
        JSON.stringify({ sidebarOpened: true, sidebarWidth: 240, expandMode: "collapse" }),
      )
      localStorage.setItem(
        "openctrlc.window.browser.dat:tabs",
        JSON.stringify([{ type: "session", server, sessionId: sessionID }]),
      )
    },
    { directory, server, sessionID },
  )

  await page.goto(`/server/${base64Encode(server)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const panel = page.locator("#review-panel")
  await panel.getByRole("button", { name: "Open file" }).click()
  await expect(panel.getByRole("tab", { name: "Open file" })).toHaveAttribute("data-selected", "")

  const sidebar = panel.locator(
    '#session-side-panel-file-browser-tabpanel [data-component="session-review-v2-sidebar-root"]',
  )
  await expect(sidebar).toBeVisible()

  const frontendRow = panel.locator('[data-slot="file-tree-v2-row"][data-path="frontend"]')
  await expect(frontendRow).toBeVisible()
  await expect(frontendRow).toHaveAttribute("aria-expanded", "false")
  await frontendRow.click()
  await expect(frontendRow).toHaveAttribute("aria-expanded", "true")

  const appRow = panel.locator('[data-slot="file-tree-v2-row"][data-path="frontend/app.ts"]')
  await expect(appRow).toBeVisible()
  await appRow.click()
  await expect(panel.getByRole("tab", { name: "app.ts" })).toHaveAttribute("data-selected", "")
  await expect(panel.getByText("contents:frontend/app.ts", { exact: true })).toBeVisible()

  const tree = sidebar.locator('[data-component="file-tree-v2"]')
  await expect(tree).toHaveAttribute("data-total-rows", "243")
  const viewport = sidebar.locator('[data-slot="session-review-v2-sidebar-tree"] .scroll-view__viewport')
  const lastRootFile = panel.locator('[data-slot="file-tree-v2-row"][data-path="file-239.ts"]')
  for (let index = 0; index < 6; index += 1) {
    await viewport.evaluate((element, toBottom) => {
      element.scrollTop = toBottom ? element.scrollHeight : 0
    }, index % 2 === 0)
    await expect(index % 2 === 0 ? lastRootFile : frontendRow).toBeVisible()
  }

  await viewport.evaluate((element) => (element.scrollTop = 0))
  for (let index = 0; index < 12; index += 1) {
    const expanded = index % 2 === 1
    await frontendRow.click()
    await expect(frontendRow).toHaveAttribute("aria-expanded", expanded ? "true" : "false")
    await expect(appRow).toHaveCount(expanded ? 1 : 0)
  }
  expect(pageErrors).toEqual([])
})
