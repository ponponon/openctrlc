import { expect, test } from "@playwright/test"
import { setupTimeline } from "./fixture"

test.describe("session search timeline reveal", () => {
  for (const newLayoutDesigns of [true, false]) {
    test(`reveals and marks an offscreen match in the ${newLayoutDesigns ? "new" : "legacy"} layout`, async ({ page }) => {
      await setupTimeline(page, {
        seedHistory: true,
        settings: { newLayoutDesigns },
        viewport: { width: 900, height: 420 },
      })

      const timeline = page.locator('[data-timeline-virtual-content]')
      await expect(timeline).toBeAttached()
      await timeline.evaluate((element) => element.setAttribute("data-timeline-mount-probe", "search-reveal"))
      const timelineElement = await timeline.elementHandle()
      expect(timelineElement).not.toBeNull()
      const scroller = page.locator(".scroll-view__viewport", { has: timeline })
      const target = page.locator('[data-timeline-row="UserMessage"][data-message-id="msg_00017_history_a_user"]')
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const view = document.querySelector<HTMLElement>(".scroll-view__viewport")
            const element = document.querySelector<HTMLElement>(`[data-timeline-row="UserMessage"][data-message-id="${id}"]`)
            if (!view || !element) return true
            const viewBox = view.getBoundingClientRect()
            const box = element.getBoundingClientRect()
            return !element || box.bottom <= viewBox.top || box.top >= viewBox.bottom
          }, "msg_00017_history_a_user"),
        )
        .toBe(true)

      await page.keyboard.press("Control+f")
      const search = page.getByRole("search")
      await expect(search).toBeVisible()
      const input = page.getByRole("textbox", { name: "Search session messages" })
      await input.fill("Historical response 17.")
      await expect(search).toContainText("1 of 1 results")
      await page.getByRole("button", { name: "Next result" }).click()

      const active = page.locator(
        '[data-timeline-row="UserMessage"][data-search-active][data-message-id="msg_00017_history_a_user"]',
      )
      const markers = page.locator('[data-timeline-row="UserMessage"][data-search-active]')
      await expect(markers).toHaveCount(1)
      await expect(markers).toHaveAttribute("data-message-id", /history_a_user$/)
      await expect(active).toBeVisible()
      await expect(active).toHaveAttribute("data-search-active", "")
      await expect(timeline).toHaveAttribute("data-timeline-mount-probe", "search-reveal")
      await expect
        .poll(() => page.evaluate((element) => element === document.querySelector("[data-timeline-virtual-content]"), timelineElement))
        .toBe(true)
      await expect
        .poll(async () => {
          const view = await scroller.boundingBox()
          const box = await active.boundingBox()
          if (!view || !box) return 0
          return Math.abs(box.y + box.height / 2 - (view.y + view.height / 2))
        })
        .toBeLessThan(240)
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
})
