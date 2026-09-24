import { expect, test } from "@playwright/test"
import {
  assistantMessage,
  historyMessages,
  setupTimeline,
  shell,
  textPart,
  userMessage,
} from "../performance/timeline-stability/fixture"

test.describe("regression: session search tool hit", () => {
  test("marks tool command/output hits in all-content scope", async ({ page }) => {
    const shellID = "prt_tool_hit_shell"
    const userID = "msg_tool_hit_user"
    const assistantID = "msg_tool_hit_assistant"
    await setupTimeline(page, {
      messages: [
        ...historyMessages(8),
        userMessage(undefined, { id: userID }),
        assistantMessage(
          [
            shell(shellID, "completed", "unique-out-token here\nsecond line", "echo unique-cmd-token"),
            textPart("prt_tool_hit_text", "done"),
          ],
          { id: assistantID, parentID: userID },
        ),
      ],
      settings: { newLayoutDesigns: true, shellToolPartsExpanded: true },
      viewport: { width: 1100, height: 640 },
      reducedMotion: true,
    })

    await page.keyboard.press("Control+f")
    const search = page.getByRole("search")
    await expect(search).toBeVisible()
    const input = page.getByRole("textbox", { name: "Search session messages" })
    await input.fill("unique-")
    await search.locator('[data-slot="select-select-trigger"]').click()
    await page.getByRole("option", { name: "All content" }).click()
    // command、output，以及 shell fixture 写入的 title=command
    await expect(search).toContainText("1 of 3 results")

    const tool = page.locator(`[data-timeline-part-id="${shellID}"]`)
    await expect(tool).toBeVisible()
    await expect(tool.locator("[data-slot='bash-pre']").first()).toBeVisible()

    const highlightCounts = () =>
      page.evaluate(() => {
        const normal = CSS.highlights?.get("session-search-hit")
        const active = CSS.highlights?.get("session-search-hit-current")
        return {
          normal: normal ? [...normal].length : 0,
          active: active ? [...active].length : 0,
          roots: document.querySelectorAll("[data-search-highlight-root]").length,
        }
      })

    // 先切到 output 命中（第 2 条），这是最干净的 tool-output 字段
    await search.getByRole("button", { name: "Next result" }).click()
    await expect(search).toContainText("2 of 3 results")
    const counts = await highlightCounts()
    expect(counts.roots, `highlight roots missing: ${JSON.stringify(counts)}`).toBeGreaterThan(0)
    expect(counts.normal + counts.active, `expected tool hits: ${JSON.stringify(counts)}`).toBeGreaterThan(0)
    // 同文出现在 command/title/收起摘要时可能有多处 active，只要当前命中被点亮即可
    expect(counts.active, `expected an active hit: ${JSON.stringify(counts)}`).toBeGreaterThanOrEqual(1)
  })
})
