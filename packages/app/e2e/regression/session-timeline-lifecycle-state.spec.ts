import { expect, test } from "@playwright/test"
import {
  assistantMessage,
  completedAssistantInfo,
  messageUpdated,
  partUpdated,
  reasoningPart,
  setupTimeline,
  shell,
  status,
  textPart,
  toolPart,
  userMessage,
} from "../performance/timeline-stability/fixture"

for (const expanded of [false, true]) {
  test(`preserves shell user intent from a ${expanded ? "expanded" : "collapsed"} default`, async ({ page }) => {
    const id = `prt_shell_default_${expanded}`
    const timeline = await setupTimeline(page, {
      messages: [userMessage(), assistantMessage([shell(id, "completed", lines(3))])],
      settings: { shellToolPartsExpanded: expanded },
    })
    const trigger = page.locator(`[data-timeline-part-id="${id}"] [data-slot="collapsible-trigger"]`)
    await expect(trigger).toHaveAttribute("aria-expanded", String(expanded))
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", String(!expanded))

    await timeline.send(partUpdated(shell(id, "completed", lines(6))), 180)
    await timeline.send(partUpdated(textPart(`prt_sibling_${expanded}`, "Sibling content")), 180)
    await timeline.send(status("busy"), 100)
    await timeline.send(status("idle"), 250)
    await page.locator('[data-slot="session-turn-steps"] [data-slot="collapsible-trigger"]').first().click()
    const activityTrigger = page
      .locator('[data-slot="session-turn-step-group"] [data-slot="collapsible-trigger"]')
      .first()
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "false")
    await activityTrigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", String(!expanded))
  })
}

test("resets the turn-level collapse state when an expanded running turn completes", async ({ page }) => {
  const finalTextID = "prt_turn_collapse_final"
  const assistant = assistantMessage([shell("prt_turn_collapse", "running"), textPart(finalTextID, "Final response")], {
    completed: false,
  })
  const timeline = await setupTimeline(page, { messages: [userMessage(), assistant] })
  const row = page.locator('[data-timeline-row="AssistantSteps"]')
  const turn = row.locator('[data-slot="session-turn-steps"]')
  const trigger = turn.locator(':scope > [data-slot="collapsible-trigger"]')
  const content = turn.locator('[data-slot="session-turn-steps-content"]')

  await expect(row).toHaveCount(1)
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")

  await timeline.send(messageUpdated(completedAssistantInfo(assistant.info)))
  await timeline.send(partUpdated(textPart(finalTextID, "Final response updated")))
  await expect(page.getByText("Final response updated", { exact: true })).toBeVisible()
  await timeline.send(status("idle"))

  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(content).toHaveCount(0)
  await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect(content).toBeVisible()
})

test("defaults only the currently running tool activity group to open", async ({ page }) => {
  const activeToolID = "prt_activity_c_current"
  const timeline = await setupTimeline(page, {
    messages: [
      userMessage(),
      assistantMessage(
        [
          shell("prt_activity_a_previous", "completed"),
          toolPart("prt_activity_b_separator", "read", "completed", { filePath: "src/session.ts" }),
          shell(activeToolID, "running"),
        ],
        { completed: false },
      ),
    ],
  })
  const groups = page.locator('[data-slot="session-turn-step-group"]')
  const triggers = groups.locator(':scope > [data-slot="collapsible-trigger"]')

  await expect(groups).toHaveCount(2)
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "false")
  await expect(triggers.nth(1)).toHaveAttribute("aria-expanded", "true")

  await timeline.send(partUpdated(shell(activeToolID, "completed", "done")))
  await expect(triggers.nth(1)).toHaveAttribute("aria-expanded", "false")
})

test("defaults only the last active group open across process rows in one turn", async ({ page }) => {
  const firstActiveToolID = "prt_activity_split_01_first"
  const textPartID = "prt_activity_split_02_text"
  const lastActiveToolID = "prt_activity_split_03_last"
  await setupTimeline(page, {
    messages: [
      userMessage(),
      assistantMessage(
        [
          shell(firstActiveToolID, "running"),
          textPart(textPartID, "Visible update between concurrent tools."),
          shell(lastActiveToolID, "running"),
        ],
        { completed: false },
      ),
    ],
  })
  const processRows = page.locator('[data-timeline-row="AssistantSteps"]')
  const groups = processRows.locator('[data-slot="session-turn-step-group"]')
  const triggers = groups.locator(':scope > [data-slot="collapsible-trigger"]')

  await expect(processRows).toHaveCount(2)
  await expect(page.locator(`[data-timeline-part-id="${textPartID}"]`)).toBeVisible()
  await expect(groups).toHaveCount(2)
  await expect(triggers.nth(0)).toHaveAttribute("aria-expanded", "false")
  await expect(triggers.nth(1)).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator(`[data-timeline-part-id="${firstActiveToolID}"]`)).toHaveCount(0)
  await expect(page.locator(`[data-timeline-part-id="${lastActiveToolID}"]`)).toBeVisible()
})

test("shows and expands a running shell command without shimmering it", async ({ page }) => {
  const id = "prt_shell_running_command"
  const command = "sleep 10 && echo done"
  await setupTimeline(page, {
    messages: [userMessage(), assistantMessage([shell(id, "running", "still running", command)], { completed: false })],
    settings: { shellToolPartsExpanded: false },
  })

  const tool = page.locator(`[data-timeline-part-id="${id}"]`)
  await expect(tool.locator('[data-component="text-shimmer"]')).toHaveAttribute("data-active", "true")
  await expect(tool.locator('[data-component="shell-submessage"]')).toHaveText(command)
  await expect(tool.locator('[data-component="shell-submessage"] [data-component="text-shimmer"]')).toHaveCount(0)
  await tool.locator('[data-slot="collapsible-trigger"]').click()
  await expect(tool.locator('[data-slot="collapsible-trigger"]')).toHaveAttribute("aria-expanded", "true")
  await expect(tool.locator('[data-slot="bash-pre"]')).toContainText("still running")
})

test("transitions thinking and hidden reasoning through busy to idle", async ({ page }) => {
  const reasoningID = "prt_reasoning_hidden"
  const assistant = assistantMessage([reasoningPart(reasoningID, "## Inspecting stability")], { completed: false })
  const timeline = await setupTimeline(page, {
    messages: [userMessage(), assistant],
    settings: { showReasoningSummaries: false },
    cpuRate: 4,
  })
  await timeline.send(status("busy"), 150)

  await expect(page.locator('[data-timeline-row="Thinking"]')).toBeVisible()
  await expect(page.getByText("Inspecting stability", { exact: true })).toBeVisible()
  await expect(page.locator(`[data-timeline-part-id="${reasoningID}"]`)).toHaveCount(0)
  await timeline.send(partUpdated(shell("prt_reasoning_shell", "running")), 160)
  await expect(page.locator('[data-timeline-row="Thinking"]')).toBeVisible()
  await timeline.send(partUpdated(shell("prt_reasoning_shell", "completed", "done")), 180)
  await timeline.send(messageUpdated(completedAssistantInfo(assistant.info)), 100)
  await timeline.send(status("idle"), 300)
  await expect(page.locator('[data-timeline-row="Thinking"]')).toHaveCount(0)
  await expect(page.locator(`[data-timeline-part-id="${reasoningID}"]`)).toHaveCount(0)
})

test("moves busy through retry and recovery to final idle content", async ({ page }) => {
  const assistant = assistantMessage([], { completed: false })
  const timeline = await setupTimeline(page, {
    messages: [
      userMessage(undefined, {
        summary: {
          diffs: [
            {
              file: "src/retry.ts",
              additions: 1,
              deletions: 1,
              patch: "@@ -1 +1 @@\n-export const retry = false\n+export const retry = true",
            },
          ],
        },
      }),
      assistant,
    ],
  })
  await timeline.send(status("busy"), 140)
  await expect(page.locator('[data-timeline-row="Thinking"]')).toBeVisible()
  await expect(page.locator('[data-timeline-row="DiffSummary"]')).toHaveCount(0)
  await timeline.send(status("retry"), 180)
  await expect(page.locator('[data-timeline-row="Retry"]')).toBeVisible()
  await expect(page.locator('[data-timeline-row="Thinking"]')).toHaveCount(0)
  await timeline.send(status("busy", 2), 180)
  await expect(page.locator('[data-timeline-row="Thinking"]')).toBeVisible()
  await timeline.send(partUpdated(textPart("prt_recovered", "Recovered response")), 140)
  await timeline.send(messageUpdated(completedAssistantInfo(assistant.info)), 100)
  await timeline.send(status("idle"), 350)
  await expect(page.locator('[data-timeline-row="Retry"]')).toHaveCount(0)
  await expect(page.locator('[data-timeline-row="Thinking"]')).toHaveCount(0)
  await expect(page.locator('[data-timeline-row="DiffSummary"]')).toBeVisible()
})

function lines(count: number) {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join("\n")
}
