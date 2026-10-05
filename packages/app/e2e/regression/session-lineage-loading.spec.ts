import { base64Encode } from "@openctrlc/core/util/encode"
import { expect, test } from "@playwright/test"
import { currentSession, mockOpenCodeServer } from "../utils/mock-server"

const server = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`
const directory = "/workspace/session-lineage-loading"
const target = {
  id: "ses_lineage_loading_target",
  slug: "session-lineage-loading",
  projectID: "project-session-lineage-loading",
  directory,
  title: "Delayed session metadata",
  version: "dev",
  time: { created: 1, updated: 1 },
}

test("shows a session loading state while target lineage is unresolved", async ({ page }) => {
  await mockOpenCodeServer(page, {
    protocol: "v2",
    directory,
    project: {
      id: target.projectID,
      worktree: directory,
      vcs: "git",
      time: { created: 1, updated: 1 },
      sandboxes: [],
    },
    provider: { all: [], connected: [], default: {} },
    sessions: [],
    pageMessages: () => ({ items: [] }),
  })

  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(new RegExp(`/api/session/${target.id}(?:\\?.*)?$`), async (route) => {
    await blocked
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ data: currentSession(target, directory) }),
    })
  })
  await page.addInitScript((server) => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem("openctrlc.global.dat:server", JSON.stringify({ list: [server] }))
    localStorage.setItem("openctrlc.global.dat:language", JSON.stringify({ locale: "en" }))
    localStorage.setItem("openctrlc.window.browser.dat:tabs", JSON.stringify([]))
  }, server)

  try {
    await page.goto(`/server/${base64Encode(server)}/session/${target.id}`)
    await expect(page.getByRole("status")).toContainText("Loading session...")
    await expect(page.locator('[aria-busy="true"] .animate-pulse').first()).toBeVisible()
  } finally {
    release()
  }

  await expect(page.getByText(target.title).first()).toBeVisible()
})

test("opens the transcript while the parent lineage is still resolving", async ({ page }) => {
  const root = { ...target, id: "ses_lineage_loading_root", title: "Root session" }
  const child = { ...target, parentID: root.id, title: "Child session" }
  await mockOpenCodeServer(page, {
    protocol: "v2",
    directory,
    project: {
      id: target.projectID,
      worktree: directory,
      vcs: "git",
      time: { created: 1 },
      sandboxes: [],
    },
    provider: { all: [], connected: [], default: {} },
    // Keep the ancestor out of the list cache so the route must resolve it.
    sessions: [child],
    pageMessages: (sessionID) => ({
      items:
        sessionID === child.id
          ? [
              {
                info: { id: "msg_lineage_first_user", role: "user", time: { created: 2 } },
                parts: [{ id: "part_lineage_first_user", type: "text", text: "Transcript arrived" }],
              },
            ]
          : [],
    }),
  })

  let releaseRoot!: () => void
  const rootBlocked = new Promise<void>((resolve) => {
    releaseRoot = resolve
  })
  await page.route(new RegExp(`/api/session/${root.id}(?:\\?.*)?$`), async (route) => {
    await rootBlocked
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ data: currentSession(root, directory) }),
    })
  })
  await page.addInitScript((server) => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem("openctrlc.global.dat:server", JSON.stringify({ list: [server] }))
    localStorage.setItem("openctrlc.global.dat:language", JSON.stringify({ locale: "en" }))
    localStorage.setItem("openctrlc.window.browser.dat:tabs", JSON.stringify([]))
  }, server)

  const rootRequest = page.waitForRequest((request) => new URL(request.url()).pathname === `/api/session/${root.id}`)
  const transcriptResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/session/${child.id}/message`,
  )
  try {
    await page.goto(`/server/${base64Encode(server)}/session/${child.id}`)
    await expect(page.getByText("Loading session...", { exact: true })).toHaveCount(0)
    await rootRequest
    await transcriptResponse
    await expect(page.getByText("Transcript arrived", { exact: true })).toBeVisible()
  } finally {
    releaseRoot()
  }
})
