import { expect, test, type Page } from "@playwright/test"
import { historyMessages, setupTimeline } from "../performance/timeline-stability/fixture"

// 回归：打开老会话（历史需分页加载）后，导航器的「当前位置」必须落在最新一条。
//
// 旧实现按“行起点 offset ≤ scrollTop + 25% 视口高”推断当前位置，但吸底时
// 最后一轮的起点通常仍低于该目标值——它下面还有同一轮的回复内容和 paddingEnd。
// 轮次越高、行越矮，当前位置就退回得越早；真实长会话里会一路退到很早的轮次，
// 表现为“打开老会话，当前位置跑到最老一条”。
test.describe("regression: session timeline navigator current on open", () => {
  test("keeps the current marker on the newest turn when opening a long session", async ({ page }) => {
    await setupTimeline(page, {
      messages: historyMessages(160),
      historyPageSize: 20,
      viewport: { width: 1400, height: 700 },
      reducedMotion: true,
    })

    const scroller = timelineScroller(page)
    await expect(scroller.locator("[data-timeline-row]").first()).toBeVisible()
    // 等待初始吸底稳定，确保断言的是“跟随底部打开”这一场景。
    await expect.poll(async () => (await snapshot(page)).distanceFromBottom, { timeout: 30_000 }).toBeLessThanOrEqual(2)

    const markers = page.locator(".session-timeline-navigator__marker")
    const count = await markers.count()
    expect(count, "导航器应渲染出多条轮次标记").toBeGreaterThan(1)

    const current = await currentMarkerIndex(page)
    expect(current, `当前位置落在第 ${current} 条（共 ${count} 条），期望最新一条（第 ${count - 1} 条）`).toBe(
      count - 1,
    )
  })
})

function timelineScroller(page: Page) {
  return page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })
}

async function snapshot(page: Page) {
  return timelineScroller(page).evaluate((element) => ({
    scrollTop: Math.round(element.scrollTop),
    scrollHeight: Math.round(element.scrollHeight),
    clientHeight: element.clientHeight,
    distanceFromBottom: Math.round(element.scrollHeight - element.clientHeight - element.scrollTop),
  }))
}

function currentMarkerIndex(page: Page) {
  return page.evaluate(() => {
    const markers = [...document.querySelectorAll(".session-timeline-navigator__marker")]
    return markers.findIndex((marker) => marker.getAttribute("aria-current") === "location")
  })
}
