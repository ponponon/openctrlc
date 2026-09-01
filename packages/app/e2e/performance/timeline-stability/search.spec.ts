import { expect, test } from "@playwright/test"
import { base64Encode } from "@openctrlc/core/util/encode"
import {
  assistantMessage,
  historyMessages,
  session as makeSession,
  setupTimeline,
  textPart,
  userMessage,
} from "./fixture"

test.describe("session search timeline reveal", () => {
  test("distinguishes the active assistant hit without outlining the parent user bubble", async ({ page }) => {
    const userID = "msg_0998_search_active_user"
    await setupTimeline(page, {
      messages: [
        userMessage(undefined, { id: userID }),
        assistantMessage([textPart("prt_0999_search_active_answer", "你好，助手回复。你好")], {
          id: "msg_0999_search_active_assistant",
          parentID: userID,
        }),
      ],
      settings: { newLayoutDesigns: true },
      viewport: { width: 900, height: 420 },
    })

    await page.keyboard.press("Control+f")
    const input = page.getByRole("textbox", { name: "Search session messages" })
    await input.fill("你好")
    await expect(page.getByRole("search")).toContainText("1 of 2 results")

    const highlightState = () =>
      page.evaluate(() => {
        const normal = CSS.highlights?.get("session-search-hit")
        const active = CSS.highlights?.get("session-search-hit-current")
        return {
          normal: normal ? [...normal].map((range) => range.startOffset) : [],
          active: active ? [...active].map((range) => range.startOffset) : [],
        }
      })

    await expect.poll(highlightState).toEqual({ normal: [8], active: [0] })
    await expect(
      page.locator(`[data-timeline-row="UserMessage"][data-message-id="${userID}"] [data-slot="user-message-text"]`),
    ).toHaveCSS("box-shadow", "none")

    await input.press("Enter")
    await expect.poll(highlightState).toEqual({ normal: [0], active: [8] })
  })

  for (const newLayoutDesigns of [true, false]) {
    test(`reveals and marks an offscreen match in the ${newLayoutDesigns ? "new" : "legacy"} layout`, async ({ page }) => {
      await setupTimeline(page, {
        messages: historyMessages(80),
        settings: { newLayoutDesigns },
        viewport: { width: 900, height: 420 },
      })

      const timeline = page.locator('[data-timeline-virtual-content]')
      await expect(timeline).toBeAttached()
      await timeline.evaluate((element) => element.setAttribute("data-timeline-mount-probe", "search-reveal"))
      const timelineElement = await timeline.elementHandle()
      expect(timelineElement).not.toBeNull()
      const scroller = page.locator(".scroll-view__viewport", { has: timeline })
      const targetID = "msg_00079_history_a_user"
      const target = page.locator(`[data-timeline-row="UserMessage"][data-message-id="${targetID}"]`)
      await expect(target).toBeAttached()
      await scroller.hover()
      await page.mouse.wheel(0, -1000)
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const view = document.querySelector<HTMLElement>(".scroll-view__viewport")
            const element = document.querySelector<HTMLElement>(`[data-timeline-row="UserMessage"][data-message-id="${id}"]`)
            if (!view) return { view: "missing", element: element ? "mounted" : "missing" }
            if (!element) return { view: "mounted", element: "missing" }
            const viewBox = view.getBoundingClientRect()
            const box = element.getBoundingClientRect()
            return {
              view: "mounted",
              element: box.bottom <= viewBox.top || box.top >= viewBox.bottom ? "offscreen" : "onscreen",
            }
          }, targetID),
        )
        .toEqual({ view: "mounted", element: "offscreen" })

      await page.keyboard.press("Control+f")
      const search = page.getByRole("search")
      await expect(search).toBeVisible()
      const input = page.getByRole("textbox", { name: "Search session messages" })
      await input.fill("Historical response 79.")
      await expect(search).toContainText("1 of 1 results")

      const active = page.locator(
        `[data-timeline-row="UserMessage"][data-search-active][data-message-id="${targetID}"]`,
      )
      const markers = page.locator('[data-timeline-row="UserMessage"][data-search-active]')
      await expect(markers).toHaveCount(1)
      await expect(markers).toHaveAttribute("data-message-id", /history_a_user$/)
      await expect(active).toBeVisible()
      await expect(active).toHaveAttribute("data-search-active", "")
      await expect
        .poll(async () => {
          const view = await scroller.boundingBox()
          const box = await active.boundingBox()
          if (!view || !box) return Number.POSITIVE_INFINITY
          return Math.abs(box.y + box.height / 2 - (view.y + view.height / 2))
        })
        .toBeLessThanOrEqual(40)
      await expect(timeline).toHaveAttribute("data-timeline-mount-probe", "search-reveal")
      await expect
        .poll(() => page.evaluate((element) => element === document.querySelector("[data-timeline-virtual-content]"), timelineElement))
        .toBe(true)
      await expect
        .poll(async () => {
          const view = await scroller.boundingBox()
          const box = await active.boundingBox()
          if (!view || !box) return Number.POSITIVE_INFINITY
          return Math.abs(box.y + box.height / 2 - (view.y + view.height / 2))
        })
        .toBeLessThanOrEqual(40)
    })
  }

  test("keeps the mounted timeline and row measurements stable during ordinary scrolling", async ({ page }) => {
    await setupTimeline(page, {
      seedHistory: true,
      viewport: { width: 900, height: 420 },
    })

    const timeline = page.locator('[data-timeline-virtual-content]')
    const scroller = page.locator(".scroll-view__viewport", { has: timeline })
    await timeline.evaluate((element) => {
      element.dataset.timelineMountProbe = "mounted"
    })
    await scroller.evaluate((element) => {
      element.scrollTop = Math.min(360, element.scrollHeight - element.clientHeight)
    })
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await expect(timeline).toBeAttached()
    await expect(page.locator('[data-timeline-virtual-content]')).toHaveCount(1)
    await expect(timeline).toHaveAttribute("data-timeline-mount-probe", "mounted")
  })

  test("hydrates paginated history, preserves initial results for retry, and ignores stale session loads", async ({ page }) => {
    const firstSession = makeSession({ id: "ses_timeline_stability" })
    const secondSession = makeSession({ id: "ses_search_second", title: "Search second" })
    const firstMessages = historyMessages(120)
    const secondMessages = historyMessages(8).map((message) => ({
      ...message,
      info: { ...message.info, sessionID: secondSession.id },
      parts: message.parts.map((part) => ({
        ...part,
        sessionID: secondSession.id,
        ...(part.type === "text" ? { text: part.text.replace("Historical response", "Second session response") } : {}),
      })),
    })) as typeof firstMessages
    const timeline = await setupTimeline(page, {
      sessions: [firstSession, secondSession],
      messages: firstMessages,
      messagesBySession: { [firstSession.id]: firstMessages, [secondSession.id]: secondMessages },
      historyPageSize: 50,
      historyFailureCount: 1,
      viewport: { width: 900, height: 420 },
    })
    await page.keyboard.press("Control+f")
    const input = page.getByRole("textbox", { name: "Search session messages" })
    await input.fill("Historical response")
    await expect(page.getByRole("search")).toContainText("500 Internal Server Error")
    await expect(page.getByRole("search")).toContainText("Partial history")
    await expect(page.getByRole("search")).toContainText(/1 of \d+ results/)
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible()
    await page.getByRole("button", { name: "Retry" }).click()
    await expect(page.getByRole("search")).toContainText(/\d+ of 120 results/)
    await expect.poll(() => timeline.historyRequests.length).toBeGreaterThan(2)
    expect(timeline.historyRequests.every((request) => request.sessionID === firstSession.id)).toBe(true)

    await page.getByRole("button", { name: "Close search" }).click()
    await navigateInApp(page, `/${base64Encode("C:/OpenCode/TimelineStability")}/session/${secondSession.id}`)
    await expect(page.getByRole("heading", { name: "Search second" })).toBeVisible()
    await page.keyboard.press("Control+f")
    await input.fill("Historical response 119.")
    await expect(page.getByRole("search")).toContainText("No results")
    await expect(page.locator('[data-search-active]')).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("Historical response 119.")
    await timeline.settle()
  })

  test("does not apply a blocked search page after switching sessions", async ({ page }) => {
    const firstSession = makeSession({ id: "ses_timeline_stability" })
    const secondSession = makeSession({ id: "ses_search_second", title: "Search second" })
    const oldMarker = "OLD_SESSION_SEARCH_MARKER"
    const newMarker = "NEW_SESSION_SEARCH_MARKER"
    const firstMessages = historyMessages(120).map((message) => ({
      ...message,
      parts: message.parts.map((part) =>
        part.type === "text" ? { ...part, text: `${oldMarker}: ${part.text}` } : part,
      ),
    }))
    const secondMessages = historyMessages(8).map((message) => ({
      ...message,
      info: { ...message.info, sessionID: secondSession.id },
      parts: message.parts.map((part) => ({
        ...part,
        sessionID: secondSession.id,
        ...(part.type === "text" ? { text: `${newMarker}: ${part.text}` } : {}),
      })),
    })) as typeof firstMessages
    const historyBlock = { enabled: true as boolean, release: undefined as (() => void) | undefined }
    const timeline = await setupTimeline(page, {
      sessions: [firstSession, secondSession],
      messages: firstMessages,
      messagesBySession: { [firstSession.id]: firstMessages, [secondSession.id]: secondMessages },
      historyPageSize: 50,
      historyBlock,
      viewport: { width: 900, height: 420 },
    })
    await page.keyboard.press("Control+f")
    const input = page.getByRole("textbox", { name: "Search session messages" })
    await input.fill(oldMarker)
    await expect.poll(() => historyBlock.release !== undefined).toBe(true)

    await navigateInApp(page, `/${base64Encode("C:/OpenCode/TimelineStability")}/session/${secondSession.id}`)
    await expect(page.getByRole("heading", { name: "Search second" })).toBeVisible()
    historyBlock.enabled = false
    historyBlock.release?.()
    await page.keyboard.press("Control+f")
    await expect(page.getByRole("search")).toBeVisible()
    await input.fill(oldMarker)
    await expect(page.getByRole("search")).toContainText("No results")
    await expect(page.getByRole("search")).not.toContainText(oldMarker)
    expect(timeline.historyRequests.some((request) => request.sessionID === firstSession.id && request.before)).toBe(true)
    await expect(page.locator("body")).toContainText(newMarker)
    await expect(page.locator("body")).not.toContainText(oldMarker)
    await expect(page.locator('[data-timeline-row="UserMessage"][data-search-active]')).toHaveCount(0)
  })

  test("keeps normal history paging behind pending search hydration", async ({ page }) => {
    const firstSession = makeSession({ id: "ses_timeline_stability" })
    const secondSession = makeSession({ id: "ses_search_second", title: "Search second" })
    const historyBlock = { enabled: false as boolean, release: undefined as (() => void) | undefined }
    const historyOverlap = { active: 0, max: 0 }
    const timeline = await setupTimeline(page, {
      sessions: [firstSession, secondSession],
      messages: historyMessages(120),
      historyPageSize: 50,
      historyBlock,
      historyOverlap,
      viewport: { width: 900, height: 420 },
    })

    await expect(page.locator("[data-timeline-virtual-content]")).toBeAttached()
    await page.keyboard.press("Control+f")
    const input = page.getByRole("textbox", { name: "Search session messages" })
    historyBlock.enabled = true
    await input.fill("Historical response")
    await expect.poll(() => historyBlock.release !== undefined).toBe(true)
    const requestsBeforeScroll = timeline.historyRequests.length

    const scroller = page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-virtual-content]") })
    await scroller.hover()
    await page.mouse.wheel(0, -1000)
    await expect.poll(() => timeline.historyRequests.length).toBe(requestsBeforeScroll)
    expect(historyOverlap.max).toBe(1)

    historyBlock.enabled = false
    historyBlock.release?.()
    await expect(page.getByRole("search")).toContainText(/of 120 results/)
    expect(historyOverlap.max).toBe(1)
  })
})

async function navigateInApp(page: import("@playwright/test").Page, href: string) {
  await page.evaluate((next) => {
    window.history.pushState({}, "", next)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, href)
}
