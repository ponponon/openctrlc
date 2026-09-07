import { expect, test } from "@playwright/test"
import { setupTimeline } from "../performance/timeline-stability/fixture"

test("shows turn previews and navigates to an earlier session turn", async ({ page }) => {
  await setupTimeline(page, { seedHistory: true, reducedMotion: true })

  const navigator = page.locator(".session-timeline-navigator")
  const markers = navigator.locator("button")
  const scroller = page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })

  await expect(navigator).toBeVisible()
  await expect.poll(() => markers.count()).toBeGreaterThan(1)

  const initialScrollTop = await scroller.evaluate((element) => element.scrollTop)
  await markers.first().hover()
  await expect(page.locator('[role="tooltip"]')).toBeVisible()
  await expect(markers.first()).toHaveAttribute("aria-label", /.+/)

  await markers.first().click()
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeLessThan(initialScrollTop)
})
