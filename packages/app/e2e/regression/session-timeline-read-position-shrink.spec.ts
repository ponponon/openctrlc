import { expect, test, type Page } from "@playwright/test"
import {
  assistantMessage,
  event,
  sessionID,
  setupTimeline,
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

// 回归：视口上方内容变矮时不能把回看位置夹到底部。
//
// 用户只向上滚“一点”时 distanceFromBottom 很小，此时只要视口上方的高度收缩量
// 超过这个距离，scrollHeight 就会降到 scrollTop + clientHeight 以下，浏览器会把
// scrollTop 夹到新的 max —— 视口正好落在最底部。用户看到的就是“上滑一点就自动弹回底部”。
// 这也解释了为什么：老会话更容易（行多、重测量 churn 多）、滚一点点更容易、
// 测量稳定后不再出现（总高度不再缩水）。
//
// 既有用例（session-timeline-follow-pause / read-position）都一次滚 600~2500px，
// 收缩量很难超过那么大的距离，所以覆盖不到这条路径。
test.describe("regression: session timeline shrink clamp", () => {
  test("keeps a small scroll-up offset when content above shrinks", async ({ page }) => {
    const messages = history(60)
    const timeline = await setupTimeline(page, {
      messages,
      viewport: { width: 1400, height: 700 },
      reducedMotion: true,
    })

    const scroller = timelineScroller(page)
    await expect(scroller.locator("[data-timeline-row]").first()).toBeVisible()
    await expect.poll(async () => (await snapshot(page)).distanceFromBottom, { timeout: 30_000 }).toBeLessThanOrEqual(2)

    await scrollUpSmall(page, 240)
    const before = await snapshot(page)
    expect(before.distanceFromBottom, `expected a small offset: ${JSON.stringify(before)}`).toBeGreaterThan(80)

    // 收缩视口上方的内容：总高度骤降，scrollTop 会触及上限。
    await timeline.transport.burst(
      messages.slice(0, 100).map((message) => event("message.removed", { sessionID, messageID: message.info.id })),
    )

    await expect
      .poll(async () => {
        const current = await snapshot(page)
        return current.scrollHeight < before.scrollHeight - 100 && current.distanceFromBottom > 80
      })
      .toBeTruthy()
    const after = await snapshot(page)

    expect(
      after.distanceFromBottom,
      `viewport was clamped back to the bottom: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    ).toBeGreaterThan(80)
  })

  test("does not restore an old up anchor after actual downward movement", async ({ page }) => {
    const messages = history(60)
    const timeline = await setupTimeline(page, {
      messages,
      viewport: { width: 1400, height: 700 },
      reducedMotion: true,
    })

    const scroller = timelineScroller(page)
    await expect(scroller.locator("[data-timeline-row]").first()).toBeVisible()
    await expect.poll(async () => (await snapshot(page)).distanceFromBottom, { timeout: 30_000 }).toBeLessThanOrEqual(2)

    await scrollUpSmall(page, 240)
    const beforeDown = await snapshot(page)
    expect(beforeDown.distanceFromBottom).toBeGreaterThan(80)

    const box = await scroller.boundingBox()
    if (!box) throw new Error("Timeline scroller is not visible")
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 80)
    await expect.poll(async () => (await snapshot(page)).distanceFromBottom).toBeLessThan(beforeDown.distanceFromBottom)
    const beforeShrink = await snapshot(page)
    expect(beforeShrink.distanceFromBottom).toBeGreaterThan(2)

    await timeline.transport.burst(
      messages.slice(0, 100).map((message) => event("message.removed", { sessionID, messageID: message.info.id })),
    )

    await expect
      .poll(async () => {
        const current = await snapshot(page)
        return current.scrollHeight < beforeShrink.scrollHeight - 100 && current.distanceFromBottom <= 2
      })
      .toBeTruthy()

    const clamped = await snapshot(page)
    await page.mouse.wheel(0, -80)
    await expect
      .poll(async () => (await snapshot(page)).distanceFromBottom)
      .toBeGreaterThan(clamped.distanceFromBottom + 2)
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

/** 用小步长滚轮靠近目标位置，避免一次 -600 直接越过目标。 */
async function scrollUpSmall(page: Page, offset: number) {
  const box = await timelineScroller(page).boundingBox()
  if (!box) throw new Error("Timeline scroller is not visible")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect
    .poll(
      async () => {
        const current = await snapshot(page)
        if (current.distanceFromBottom >= offset) return current.distanceFromBottom
        await page.mouse.wheel(0, -120)
        return (await snapshot(page)).distanceFromBottom
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(offset)
}

function history(count: number): TimelineMessage[] {
  return Array.from({ length: count }, (_, index) => {
    const prefix = `msg_${String(index).padStart(4, "0")}_shrink`
    const userID = `${prefix}_a_user`
    return [
      userMessage(undefined, { id: userID, created: 1690000000000 + index * 10_000 }),
      assistantMessage(
        [textPart(`prt_${String(index).padStart(4, "0")}_shrink`, `History ${index}. ${"content ".repeat(30)}`)],
        {
          id: `${prefix}_b_assistant`,
          parentID: userID,
          created: 1690000001000 + index * 10_000,
        },
      ),
    ]
  }).flat()
}
