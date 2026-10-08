import { expect, test } from "@playwright/test"
import { event, historyMessages, sessionID, setupTimeline } from "../performance/timeline-stability/fixture"

test("keeps the virtual timeline stable while scrolling and removing a message burst", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  const messages = historyMessages(80)
  const timeline = await setupTimeline(page, { messages, viewport: { width: 1400, height: 800 } })
  const scroller = page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })
  const firstResponse = page.getByText("Historical response 0.", { exact: false })
  const finalResponse = page.getByText("Historical response 79.", { exact: false })

  await scroller.evaluate((element) => (element.scrollTop = element.scrollHeight))
  await expect(finalResponse).toBeVisible()
  for (let index = 0; index < 8; index += 1) {
    const atTop = index % 2 === 0
    await scroller.evaluate((element, top) => {
      element.scrollTop = top ? 0 : element.scrollHeight
    }, atTop)
    await expect(atTop ? firstResponse : finalResponse).toBeVisible()
  }

  await timeline.transport.burst(
    messages.slice(0, -2).map((message) => event("message.removed", { sessionID, messageID: message.info.id })),
  )

  await scroller.evaluate((element) => (element.scrollTop = 0))
  await expect(firstResponse).toHaveCount(0)
  await expect(page.getByText("Historical response", { exact: false })).toHaveCount(1)
  await scroller.evaluate((element) => (element.scrollTop = element.scrollHeight))
  await expect(finalResponse).toBeVisible()
  expect(pageErrors).toEqual([])
})
