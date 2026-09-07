import { expect, test } from "@playwright/test"
import { setupTimeline } from "../performance/timeline-stability/fixture"

test("shows turn previews and navigates to an earlier session turn", async ({ page }) => {
  await setupTimeline(page, { seedHistory: true, reducedMotion: true })

  const navigator = page.locator(".session-timeline-navigator")
  const markers = navigator.locator(".session-timeline-navigator__marker")
  const startButton = navigator.locator(".session-timeline-navigator__edge-button--start")
  const previousButton = navigator.locator(".session-timeline-navigator__edge-button--previous")
  const nextButton = navigator.locator(".session-timeline-navigator__edge-button--next")
  const latestButton = navigator.locator(".session-timeline-navigator__edge-button--end")
  const scroller = page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })

  await expect(navigator).toBeVisible()
  await expect.poll(() => markers.count()).toBeGreaterThan(1)
  await expect(startButton).toBeVisible()
  await expect(previousButton).toBeVisible()
  await expect(nextButton).toBeVisible()
  await expect(latestButton).toBeVisible()

  const markerBox = await markers.first().boundingBox()
  const messageBox = await page.locator('[data-slot="session-turn-message-container"]').first().boundingBox()
  expect(markerBox).not.toBeNull()
  expect(messageBox).not.toBeNull()
  if (!markerBox || !messageBox) throw new Error("Timeline navigator layout is not measurable")
  expect(markerBox.width).toBeGreaterThanOrEqual(40)
  expect(markerBox.x + markerBox.width).toBeLessThanOrEqual(messageBox.x)

  const initialScrollTop = await scroller.evaluate((element) => element.scrollTop)
  await markers.first().hover()
  await expect(page.locator('[role="tooltip"]')).toBeVisible()
  await expect(markers.first()).toHaveAttribute("aria-label", /.+/)

  await markers.first().click()
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeLessThan(initialScrollTop)
  await expect(startButton).toBeDisabled()
  await expect(nextButton).toBeEnabled()

  await nextButton.click()
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(1)
  await expect(startButton).toBeEnabled()
  await expect(previousButton).toBeEnabled()

  await startButton.click()
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(1)
  await expect(previousButton).toBeDisabled()
  await expect(nextButton).toBeEnabled()

  await nextButton.click()
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(1)

  await latestButton.click()
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop >= element.scrollHeight - element.clientHeight - 1))
    .toBeTruthy()
  await expect(nextButton).toBeDisabled()
})
