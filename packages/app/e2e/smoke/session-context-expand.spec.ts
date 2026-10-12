import { base64Encode } from "@openctrlc/core/util/encode"
import { expect, test } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`
const directory = "C:/OpenCode/ExpandRepro"
const projectID = "proj_expand_repro"
const sessionID = "ses_expand_repro"
const title = "Expand repro session"
const baseTime = 1_700_000_000_000

test.use({ viewport: { width: 1440, height: 900 } })

const provider = {
  all: [
    {
      id: "opencode",
      name: "OpenCode",
      models: {
        "alpha-fast": { id: "alpha-fast", name: "Alpha Fast", limit: { context: 200_000 } },
      },
    },
  ],
  connected: ["opencode"],
  default: { providerID: "opencode", modelID: "alpha-fast" },
}

const project = {
  id: projectID,
  worktree: directory,
  vcs: "git",
  name: "expand-repro",
  time: { created: baseTime, updated: baseTime },
  sandboxes: [],
}

const sessions = [
  {
    id: sessionID,
    slug: "expand-repro",
    projectID,
    directory,
    title,
    version: "dev",
    time: { created: baseTime, updated: baseTime },
  },
]

type Message = { info: Record<string, unknown> & { id: string; role: string }; parts: Record<string, unknown>[] }

function buildMessages(): Message[] {
  const messages: Message[] = []
  for (let index = 0; index < 400; index++) {
    const isUser = index % 2 === 0
    const id = isUser ? `msg_user_${index}` : `msg_assistant_${index}`
    const created = baseTime + index * 5_000
    if (isUser) {
      messages.push({
        info: {
          id,
          sessionID,
          role: "user",
          time: { created },
          summary: { diffs: [] },
          agent: "build",
          model: { providerID: "opencode", modelID: "alpha-fast" },
        },
        parts: [{ id: `prt_${id}`, sessionID, messageID: id, type: "text", text: `Prompt ${index}` }],
      })
      continue
    }
    const parentID = `msg_user_${index - 1}`
    const duration = 1_200 + ((index * 17) % 5_000)
    messages.push({
      info: {
        id,
        sessionID,
        role: "assistant",
        time: { created, completed: created + duration, firstGenerated: created + 180, generationDuration: 900 },
        parentID,
        modelID: "alpha-fast",
        providerID: "opencode",
        mode: "build",
        agent: "build",
        path: { cwd: directory, root: directory },
        cost: 0.002 + ((index * 7) % 40) / 1000,
        tokens: {
          input: 1_200 + index * 13,
          output: 80 + ((index * 43) % 420),
          reasoning: 5,
          cache: { read: (index * 220) % 4_000, write: index },
        },
        finish: "stop",
      },
      parts: [{ id: `prt_${id}`, sessionID, messageID: id, type: "text", text: `Assistant reply ${index}` }],
    })
  }
  return messages
}

const allMessages = buildMessages()

function pageMessages(sessionIDArg: string, limit: number, before?: string) {
  const messages = sessionIDArg === sessionID ? allMessages : []
  const end = before
    ? Math.max(0, messages.findIndex((message) => message.info.id === before))
    : messages.length
  const start = Math.max(0, end - limit)
  return { items: messages.slice(start, end), cursor: start > 0 ? messages[start]!.info.id : undefined }
}

async function openContext(page: import("@playwright/test").Page) {
  await mockOpenCodeServer(page, { directory, project, provider, sessions, pageMessages })
  await page.addInitScript(
    ({ directory, server, sessionID }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(
        "openctrlc.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: directory, expanded: true }] },
          lastProject: { local: directory },
        }),
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
  await page.getByRole("button", { name: "Toggle review" }).click()
  await page.getByRole("button", { name: "View context usage" }).click()
  await expect(page.getByRole("tab", { name: "Context" })).toHaveAttribute("data-selected", "")
}

async function measure(page: import("@playwright/test").Page) {
  await page.waitForTimeout(500)
  return page.evaluate(() => {
    const expanded = document.querySelector('[data-slot="accordion-item"][data-expanded]')
    if (!expanded) return { error: "no expanded item" }
    const header = expanded.querySelector('[data-slot="accordion-header"]')
    const contentEl = expanded.querySelector('[data-slot="accordion-content"]')
    let wrapper: Element | null = expanded
    while (wrapper && !(wrapper instanceof HTMLElement && wrapper.style.position === "absolute")) {
      wrapper = wrapper.parentElement
    }
    const nextWrapper = wrapper?.nextElementSibling ?? null
    const accordion = wrapper?.parentElement
    const rect = (el: Element | null | undefined) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
    }
    let overlap: Array<{ text: string; top: number; bottom: number }> = []
    if (contentEl) {
      const cr = contentEl.getBoundingClientRect()
      const root = wrapper?.parentElement
      if (root) {
        for (const child of Array.from(root.children)) {
          if (child === wrapper) continue
          const r = child.getBoundingClientRect()
          if (r.height > 0 && r.top < cr.bottom && r.bottom > cr.top) {
            overlap.push({
              text: child.textContent?.slice(0, 40) ?? "",
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
            })
          }
        }
      }
    }
    // Sticky headers painted above content?
    const headersOverContent: number[] = []
    if (contentEl) {
      const cr = contentEl.getBoundingClientRect()
      for (const h of document.querySelectorAll('[data-component="sticky-accordion-header"]')) {
        if (expanded.contains(h)) continue
        const r = h.getBoundingClientRect()
        if (r.height > 0 && r.top < cr.bottom && r.bottom > cr.top) headersOverContent.push(Math.round(r.top))
      }
    }
    return {
      header: rect(header),
      content: rect(contentEl),
      wrapper: rect(wrapper),
      next: rect(nextWrapper),
      accordion: rect(accordion),
      accordionStyle: accordion instanceof HTMLElement ? accordion.getAttribute("style") : null,
      wrapperTransform: wrapper instanceof HTMLElement ? wrapper.style.transform : null,
      nextText: nextWrapper?.textContent?.slice(0, 50) ?? null,
      expandedText: expanded.textContent?.slice(0, 50) ?? null,
      overlap,
      headersOverContent,
    }
  })
}

test.describe("repro: context raw message expand with heavy list", () => {
  test.setTimeout(180_000)

  test("expand deep in a long virtual list", async ({ page }) => {
    await openContext(page)

    const rows = page.locator('[data-component="sticky-accordion-header"]')
    await rows.first().scrollIntoViewIfNeeded()

    // Scroll the context panel to ~50% depth.
    await page.evaluate(() => {
      const el = document.querySelector('[data-component="sticky-accordion-header"]')
      let node: Element | null = el
      while (node) {
        if (node instanceof HTMLElement) {
          const style = getComputedStyle(node)
          if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 10) {
            node.scrollTop = Math.floor(node.scrollHeight * 0.5)
            return
          }
        }
        node = node.parentElement
      }
      throw new Error("no scrollable ancestor")
    })
    await page.waitForTimeout(400)

    const target = page.locator('[data-component="sticky-accordion-header"]').filter({ hasText: "assistant" }).first()
    await target.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await target.getByRole("button").click()

    await expect(page.locator('[data-slot="accordion-item"][data-expanded]').first()).toBeVisible()
    const content = page.locator('[data-slot="accordion-item"][data-expanded] [data-slot="accordion-content"]').first()
    await expect(content.locator("text=parentID").first()).toBeVisible({ timeout: 15_000 })

    // Give virtualizer + RO time to re-measure.
    await page.waitForTimeout(600)
    const layout = await measure(page)
    console.log("CASE-HEAVY", JSON.stringify(layout, null, 2))

    expect(layout.header).toBeTruthy()
    expect(layout.content).toBeTruthy()

    const gap = layout.content!.top - layout.header!.bottom
    console.log("header/content gap:", gap)
    expect(gap).toBeGreaterThanOrEqual(-2)
    expect(gap).toBeLessThanOrEqual(4)

    if (layout.next) {
      console.log("next row top vs content bottom:", layout.next!.top, layout.content!.bottom)
      expect(layout.next!.top).toBeGreaterThanOrEqual(layout.content!.bottom - 2)
    }
    expect(layout.overlap).toHaveLength(0)
    expect(layout.headersOverContent).toHaveLength(0)

    // Virtual rows must be positioned with `top`, not `transform`: an ancestor
    // transform makes the sticky header resolve against pre-transform coordinates
    // and land inside the expanded JSON (regression: 展开位置错乱).
    expect(layout.wrapperTransform).toBeFalsy()

    await page.screenshot({ path: "e2e/test-results/context-expand-heavy.png" })
  })

  test("sticky header pins to viewport top after scrolling past the list top", async ({ page }) => {
    await openContext(page)

    // Expand a row near the top of the raw message list.
    const firstAssistant = page
      .locator('[data-component="sticky-accordion-header"]')
      .filter({ hasText: "assistant" })
      .first()
    await firstAssistant.scrollIntoViewIfNeeded()
    await firstAssistant.getByRole("button").click()
    const content = page.locator('[data-slot="accordion-item"][data-expanded] [data-slot="accordion-content"]').first()
    await expect(content.locator("text=parentID").first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(500)

    // Scroll the panel deep into the expanded content so sticky engages.
    await page.evaluate(() => {
      const el = document.querySelector('[data-component="sticky-accordion-header"]')
      let node: Element | null = el
      while (node) {
        if (node instanceof HTMLElement) {
          const style = getComputedStyle(node)
          if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 10) {
            node.scrollTop += 1200
            return
          }
        }
        node = node.parentElement
      }
      throw new Error("no scrollable ancestor")
    })
    await page.waitForTimeout(400)

    const sticky = await page.evaluate(() => {
      const expanded = document.querySelector('[data-slot="accordion-item"][data-expanded]')
      if (!expanded) return { error: "no expanded" }
      const header = expanded.querySelector('[data-slot="accordion-header"]')
      const content = expanded.querySelector('[data-slot="accordion-content"]')
      // Scope to the tab panel: the page also has the timeline's scroll-view.
      const viewport = expanded.closest('[role="tabpanel"]')?.querySelector(".scroll-view__viewport")
      if (!viewport) return { error: "no panel viewport" }
      const hr = header.getBoundingClientRect()
      const cr = content.getBoundingClientRect()
      const vr = viewport.getBoundingClientRect()
      // Header must pin within the viewport (not float mid-content), and the
      // content behind it must still be continuous (no other row painted over).
      const headerInsideViewport = hr.top >= vr.top - 2 && hr.top <= vr.top + 40
      const headerWithinContent = hr.top >= cr.top && hr.top <= cr.bottom
      return {
        headerTop: Math.round(hr.top),
        viewportTop: Math.round(vr.top),
        contentTop: Math.round(cr.top),
        contentBottom: Math.round(cr.bottom),
        headerInsideViewport,
        headerWithinContent,
      }
    })
    console.log("STICKY", JSON.stringify(sticky, null, 2))
    expect(sticky.error).toBeFalsy()
    expect(sticky.headerInsideViewport).toBe(true)
    expect(sticky.headerWithinContent).toBe(true)
  })
})
