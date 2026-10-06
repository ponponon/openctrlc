import { expect, test, type Page, type Route } from "@playwright/test"
import { base64Encode } from "@openctrlc/core/util/encode"
import { currentSession } from "../utils/mock-server"

const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`
const sessions = [
  session("ses_strip_a", "Strip A session"),
  session("ses_strip_b", "Strip B session"),
  session("ses_strip_c", "Strip C session"),
  session("ses_strip_d", "Strip D session"),
  session("ses_strip_e", "Strip E session"),
  session("ses_strip_f", "Strip F session"),
]

test("clicking an offscreen leading tab must not scroll titlebar ancestors vertically", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 })
  await mockServer(page)
  await page.addInitScript(
    ({ server, ids }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(
        "openctrlc.window.browser.dat:tabs",
        JSON.stringify(ids.map((sessionId: string) => ({ type: "session", server, sessionId }))),
      )
    },
    { server, ids: sessions.map((item) => item.id) },
  )

  const hrefFirst = `/server/${base64Encode(server)}/session/${sessions[0].id}`
  const hrefLast = `/server/${base64Encode(server)}/session/${sessions.at(-1)!.id}`
  await page.goto(hrefLast)
  await expect(page.getByText(sessions.at(-1)!.title).first()).toBeVisible()

  const tabsScroll = page.locator('[data-slot="titlebar-tabs-scroll"]')
  await expect(tabsScroll).toBeVisible()
  await expect(page.locator("[data-titlebar-tab-slot]:visible")).toHaveCount(sessions.length)

  // Start on the trailing tab so the leading tab is offscreen and needs a
  // horizontal scroll — the only case that used to also scroll overflow
  // ancestors vertically and clip the lite-network chip.
  const linkFirst = page.locator(`a[data-titlebar-tab-link][href="${hrefFirst}"]`)
  await expect(linkFirst).toBeAttached()
  const before = await readTitlebarScrollTops(page)
  expect(before.tabsScrollTop).toBe(0)
  expect(before.innerScrollTop).toBe(0)

  await linkFirst.click()
  await expect(page).toHaveURL(new RegExp(`${hrefFirst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`))

  const after = await readTitlebarScrollTops(page)
  expect(after.tabsScrollTop).toBe(0)
  expect(after.innerScrollTop).toBe(0)
})

test("clicking a visible trailing tab keeps titlebar scroll at rest", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 })
  await mockServer(page)
  await page.addInitScript(
    ({ server, ids }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(
        "openctrlc.window.browser.dat:tabs",
        JSON.stringify(ids.map((sessionId: string) => ({ type: "session", server, sessionId }))),
      )
    },
    { server, ids: sessions.map((item) => item.id) },
  )

  const hrefFirst = `/server/${base64Encode(server)}/session/${sessions[0].id}`
  const hrefSecond = `/server/${base64Encode(server)}/session/${sessions[1].id}`
  await page.goto(hrefFirst)
  await expect(page.getByText(sessions[0].title).first()).toBeVisible()

  const linkSecond = page.locator(`a[data-titlebar-tab-link][href="${hrefSecond}"]`)
  await expect(linkSecond).toBeVisible()
  await linkSecond.click()
  await expect(page).toHaveURL(new RegExp(`${hrefSecond.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`))

  const after = await readTitlebarScrollTops(page)
  expect(after.tabsScrollTop).toBe(0)
  expect(after.innerScrollTop).toBe(0)
})

async function readTitlebarScrollTops(page: Page) {
  return page.evaluate(() => {
    const tabs = document.querySelector('[data-slot="titlebar-tabs-scroll"]')
    const inner = tabs?.parentElement?.parentElement
    return {
      tabsScrollTop: tabs instanceof HTMLElement ? tabs.scrollTop : Number.NaN,
      innerScrollTop: inner instanceof HTMLElement ? inner.scrollTop : Number.NaN,
    }
  })
}

function session(id: string, title: string) {
  return {
    id,
    slug: id,
    projectID: "project-strip",
    directory: "C:/strip-project",
    title,
    version: "dev",
    time: { created: 1, updated: 1 },
  }
}

async function mockServer(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== server) return route.fallback()
    if (url.pathname === "/global/event" || url.pathname === "/event" || url.pathname === "/api/event")
      return sse(route)
    if (url.pathname === "/global/health") return json(route, { healthy: true })
    if (url.pathname === "/api/session") return json(route, { data: sessions.map(currentSession), cursor: {} })
    if (url.pathname === "/api/session/active") return json(route, { data: {} })
    const currentSessionInfo = sessions.find((item) => url.pathname === `/api/session/${item.id}`)
    if (currentSessionInfo) return json(route, { data: currentSession(currentSessionInfo) })
    if (sessions.some((item) => url.pathname === `/api/session/${item.id}/message`))
      return json(route, { data: [], cursor: {} })
    const byId = sessions.find((item) => url.pathname === `/session/${item.id}`)
    if (byId) return json(route, byId)
    if (/^\/session\/[^/]+$/.test(url.pathname)) return json(route, { name: "NotFoundError" }, 404)
    if (/^\/session\/[^/]+\/message$/.test(url.pathname)) return json(route, [])
    if (/^\/session\/[^/]+\/(children|todo|diff)$/.test(url.pathname)) return json(route, [])
    if (["/skill", "/command", "/lsp", "/formatter", "/permission", "/question", "/vcs/diff"].includes(url.pathname))
      return json(route, [])
    if (["/global/config", "/config", "/provider/auth", "/mcp"].includes(url.pathname)) return json(route, {})
    if (url.pathname === "/provider")
      return json(route, { all: [], connected: [], default: { providerID: "", modelID: "" } })
    if (url.pathname === "/agent") return json(route, [{ name: "build", mode: "primary" }])
    if (url.pathname === "/project" || url.pathname === "/project/current") {
      const project = {
        id: sessions[0].projectID,
        worktree: sessions[0].directory,
        vcs: "git",
        time: { created: 1, updated: 1 },
        sandboxes: [],
      }
      return json(route, url.pathname === "/project" ? [project] : project)
    }
    if (url.pathname === "/path" || url.pathname === "/api/path")
      return json(route, {
        state: sessions[0].directory,
        config: sessions[0].directory,
        worktree: sessions[0].directory,
        directory: sessions[0].directory,
        home: sessions[0].directory,
      })
    if (url.pathname === "/vcs") return json(route, { branch: "main", default_branch: "main" })
    if (url.pathname === "/api/vcs")
      return json(route, {
        location: { directory: sessions[0].directory },
        data: { branch: "main", defaultBranch: "main" },
      })
    return json(route, {})
  })
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  })
}

function sse(route: Route) {
  return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ok\n\n" })
}
