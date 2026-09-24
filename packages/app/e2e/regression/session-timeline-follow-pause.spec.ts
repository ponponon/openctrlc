import { expect, test, type Page } from "@playwright/test"
import {
  assistantMessage,
  partUpdated,
  setupTimeline,
  shell,
  textPart,
  userMessage,
  type TimelineMessage,
} from "../performance/timeline-stability/fixture"

type TimelineSnapshot = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceFromBottom: number
}

test.describe("regression: session timeline follow pause", () => {
  test("keeps the reading position when new output arrives while scrolled up", async ({ page }) => {
    const shellID = "prt_pause_01_shell"
    const lateID = "prt_pause_02_late"
    const timeline = await setupTimeline(page, {
      messages: [
        ...history(16),
        userMessage(),
        assistantMessage([shell(shellID, "running", lines(8))], { completed: false }),
      ],
      settings: { shellToolPartsExpanded: true },
      viewport: { width: 1400, height: 700 },
      reducedMotion: true,
    })

    const scroller = timelineScroller(page)
    await expect(scroller.locator("[data-timeline-row]").first()).toBeVisible()
    await expect
      .poll(async () => (await snapshot(page)).distanceFromBottom, { timeout: 30_000 })
      .toBeLessThanOrEqual(2)

    await scrollTimelineUp(page, 600)
    const before = await snapshot(page)
    expect(before.distanceFromBottom, `expected a mid-timeline position: ${JSON.stringify(before)}`).toBeGreaterThan(500)

    // Streaming growth and a brand-new assistant row both count as "new output".
    await timeline.send(partUpdated(shell(shellID, "running", lines(60))))
    await timeline.send(partUpdated(textPart(lateID, "Late output while paused")))

    const after = await snapshot(page)
    expect(
      after.distanceFromBottom,
      `new output pulled the viewport back to the bottom: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    ).toBeGreaterThan(300)
    expect(after.scrollTop, `viewport snapped to the end: ${JSON.stringify(after)}`).toBeLessThan(
      after.scrollHeight - after.clientHeight - 200,
    )

    const count = page.locator('[data-slot="jump-latest-count"]')
    await expect(count).toBeVisible()
    await expect(count).toHaveText(/^[1-9]\d*$/)

    await count.locator("xpath=ancestor::button").click()
    await expect
      .poll(async () => (await snapshot(page)).distanceFromBottom, { timeout: 30_000 })
      .toBeLessThanOrEqual(2)
    await expect(count).toBeHidden()
  })
})

function timelineScroller(page: Page) {
  return page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })
}

async function snapshot(page: Page): Promise<TimelineSnapshot> {
  return timelineScroller(page).evaluate((element) => {
    return {
      scrollTop: Math.round(element.scrollTop),
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      distanceFromBottom: Math.round(element.scrollHeight - element.clientHeight - element.scrollTop),
    }
  })
}

async function scrollTimelineUp(page: Page, offset: number) {
  const box = await timelineScroller(page).boundingBox()
  if (!box) throw new Error("Timeline scroller is not visible")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect
    .poll(
      async () => {
        const current = await snapshot(page)
        if (current.distanceFromBottom >= offset) return current.distanceFromBottom
        await page.mouse.wheel(0, -600)
        return current.distanceFromBottom
      },
      { timeout: 90_000 },
    )
    .toBeGreaterThanOrEqual(offset)
}

function history(count: number): TimelineMessage[] {
  return Array.from({ length: count }, (_, index) => {
    const prefix = `msg_${String(index).padStart(4, "0")}_pause`
    const userID = `${prefix}_a_user`
    return [
      userMessage(undefined, { id: userID, created: 1690000000000 + index * 10_000 }),
      assistantMessage(
        [textPart(`prt_${String(index).padStart(4, "0")}_pause`, `History ${index}. ${"content ".repeat(30)}`)],
        {
          id: `${prefix}_b_assistant`,
          parentID: userID,
          created: 1690000001000 + index * 10_000,
        },
      ),
    ]
  }).flat()
}

function lines(count: number) {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join("\n")
}
