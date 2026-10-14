import { expect, test, type Page } from "@playwright/test"
import {
  assistantMessage,
  setupTimeline,
  textPart,
  userMessage,
  type TimelineMessage,
} from "../performance/timeline-stability/fixture"

type TimelineSnapshot = { scrollTop: number; scrollHeight: number; clientHeight: number; distanceFromBottom: number }

// 回归：用户回看历史时，后续的历史分页加载与行高重测量都不能把视口推回底部。
// 夹具刻意让行高极不均匀（60px 估算 vs 数千像素实测），复现真实的测量 churn。
test.describe("regression: session timeline read position", () => {
  test("keeps the reading position while history pages load and rows remeasure", async ({ page }) => {
    await setupTimeline(page, {
      messages: [...history(160), userMessage(), assistantMessage([textPart("prt_read_tail", "tail output")])],
      viewport: { width: 1400, height: 700 },
      reducedMotion: true,
      historyPageSize: 20,
    })

    const scroller = timelineScroller(page)
    await expect(scroller.locator("[data-timeline-row]").first()).toBeVisible()
    await expect.poll(async () => (await snapshot(page)).distanceFromBottom, { timeout: 30_000 }).toBeLessThanOrEqual(2)

    await scrollTimelineUp(page, 2500)
    const before = await snapshot(page)
    expect(before.distanceFromBottom).toBeGreaterThan(2000)

    // 分页继续加载 + 测量 churn 跑完
    await page.waitForTimeout(8000)
    const after = await snapshot(page)

    expect(
      after.distanceFromBottom,
      `viewport drifted back toward the bottom: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    ).toBeGreaterThan(before.distanceFromBottom - 200)

    // 非跟随状态下不允许出现 scrollToEnd 写入（开发期自证钩子）。
    const writes = await page.evaluate(
      () => (globalThis as { __timelineScrollWrites?: unknown[] }).__timelineScrollWrites ?? [],
    )
    expect(writes, `unexpected pin-to-bottom writes: ${JSON.stringify(writes, null, 2)}`).toHaveLength(0)
  })
})

function timelineScroller(page: Page) {
  return page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })
}

async function snapshot(page: Page): Promise<TimelineSnapshot> {
  return timelineScroller(page).evaluate((element) => ({
    scrollTop: Math.round(element.scrollTop),
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    distanceFromBottom: Math.round(element.scrollHeight - element.clientHeight - element.scrollTop),
  }))
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
      { timeout: 120_000 },
    )
    .toBeGreaterThanOrEqual(offset)
}

function history(count: number): TimelineMessage[] {
  return Array.from({ length: count }, (_, index) => {
    const value = String(index).padStart(4, "0")
    const userID = `msg_${value}_read_a_user`
    const bulky = index % 3 === 0
    const body = `History ${index}. ` + "long content paragraph. ".repeat(bulky ? 1200 : 12)
    return [
      userMessage(undefined, { id: userID, created: 1690000000000 + index * 10_000 }),
      assistantMessage([textPart(`prt_${value}_read`, body)], {
        id: `msg_${value}_read_b_assistant`,
        parentID: userID,
        created: 1690000001000 + index * 10_000,
      }),
    ]
  }).flat()
}
