import { expect, test } from "@playwright/test"
import { base64Encode } from "@openctrlc/core/util/encode"
import { mockOpenCodeServer } from "../utils/mock-server"

const directory = "C:/OpenCode/RemoteSessionTabs"
const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`
const remoteSessionID = "remote-session01"
const desktopSession = {
  id: "ses_desktop_open",
  title: "Desktop session should stay closed",
  directory,
  time: { created: 1, updated: 1 },
}
const historySession = {
  id: "ses_mobile_history",
  slug: "ses_mobile_history",
  projectID: "project_remote_session_tabs",
  directory,
  title: "Historical conversation from mobile",
  version: "dev",
  time: { created: 2, updated: 2 },
}
const snapshot = {
  projects: [{ worktree: directory, expanded: true }],
  lastProject: directory,
  sessionIDs: [desktopSession.id],
  sessionInfo: [{ sessionID: desktopSession.id, title: desktopSession.title, directory, protocol: "v2" as const }],
  activeSessionID: desktopSession.id,
}

test("remote home keeps desktop session tabs closed until a history session is selected", async ({ page }) => {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: "project_remote_session_tabs",
      worktree: directory,
      vcs: "git",
      name: "RemoteSessionTabs",
      time: { created: 1, updated: 1 },
      sandboxes: [],
    },
    provider: { all: [], connected: [], default: {} },
    sessions: [historySession],
    pageMessages: () => ({ items: [] }),
  })
  await page.route("**/_remote/workspace", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { etag: '"workspace-v1"' },
      body: JSON.stringify({ workspace: snapshot }),
    }),
  )
  await page.context().addCookies([{ name: "oc_active", value: remoteSessionID, domain: "127.0.0.1", path: "/" }])
  await page.addInitScript(
    ({ remoteSessionID, snapshot }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(`openctrlc.remote-workspace:${remoteSessionID}`, JSON.stringify(snapshot))
    },
    { remoteSessionID, snapshot },
  )

  const workspaceResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/_remote/workspace",
  )
  await page.goto("/")
  await workspaceResponse

  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.locator('[data-component="home-session-row"]').filter({ hasText: historySession.title }),
  ).toBeVisible()
  await expect(page.locator("[data-titlebar-tab-slot]")).toHaveCount(0)

  await page.locator('[data-component="home-session-row"]').filter({ hasText: historySession.title }).click()

  const href = `/server/${base64Encode(server)}/session/${historySession.id}`
  await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`))
  await expect(page.locator(`[data-slot="titlebar-tabs"] a[href="${href}"]`)).toContainText(historySession.title)
})
