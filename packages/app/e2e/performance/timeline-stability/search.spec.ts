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

      await page.keyboard.press("Control+f")
      const search = page.getByRole("search")
      await expect(search).toBeVisible()
      const input = page.getByRole("textbox", { name: "Search session messages" })
      await input.fill("Historical response 0.")
      await expect(search).toContainText("1 of 1 results")
      await page.getByRole("button", { name: "Next result" }).click()

      const active = page.locator(
        '[data-timeline-row="UserMessage"][data-search-active][data-message-id="msg_00000_history_a_user"]',
      )
      await expect(active).toBeAttached()
      await expect(timeline).toBeAttached()
      await expect(page.locator('[data-timeline-virtual-content]')).toHaveCount(1)
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
