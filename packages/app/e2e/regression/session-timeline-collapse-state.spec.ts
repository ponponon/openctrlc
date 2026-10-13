import { expect, test, type Locator, type Page } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible, expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/TimelineStateRegression"
const projectID = "proj_timeline_state_regression"
const sessionID = "ses_timeline_state_regression"
const userMessageID = "msg_user_regression"
const assistantMessageID = "msg_assistant_regression"
const editPartID = "prt_0001_edit"
const textPartID = "prt_9999_text"
const title = "Timeline collapse state regression"
const model = { providerID: "opencode", modelID: "claude-opus-4-6", variant: "max" }

type EventPayload = {
  directory: string
  payload: Record<string, unknown>
}

declare global {
  interface Window {
    __timelineDiffProbe: {
      reset: () => void
      shadowRoots: () => number
    }
  }
}

const userMessage = {
  info: {
    id: userMessageID,
    sessionID,
    role: "user",
    time: { created: 1700000000000 },
    summary: { diffs: [] },
    agent: "build",
    model,
  },
  parts: [
    {
      id: "prt_user_text",
      sessionID,
      messageID: userMessageID,
      type: "text",
      text: "Please edit the file.",
    },
  ],
}

const editPart = {
  id: editPartID,
  sessionID,
  messageID: assistantMessageID,
  type: "tool",
  callID: "call_edit_regression",
  tool: "edit",
  state: {
    status: "completed",
    input: { filePath: "src/regression.ts" },
    output: "Edited src/regression.ts",
    title: "src/regression.ts",
    metadata: {
      filediff: {
        file: "src/regression.ts",
        additions: 1,
        deletions: 1,
        before: "export const value = 'before'\n",
        after: "export const value = 'after'\n",
      },
      diff: "diff --git a/src/regression.ts b/src/regression.ts\n-export const value = 'before'\n+export const value = 'after'\n",
    },
    time: { start: 1700000001000, end: 1700000002000 },
  },
}

const secondEditPart = {
  ...editPart,
  id: "prt_0002_edit",
  callID: "call_second_edit_regression",
  state: {
    ...editPart.state,
    input: { filePath: "src/second-regression.ts" },
    output: "Edited src/second-regression.ts",
    title: "src/second-regression.ts",
  },
}

const streamedTextPart = {
  id: textPartID,
  sessionID,
  messageID: assistantMessageID,
  type: "text",
  text: "Streaming added a later assistant text part.",
}

const commentaryPart = {
  ...streamedTextPart,
  id: "prt_0003_commentary",
  channel: "commentary",
  text: "Checking the edit before answering.",
}

const followUpTextPart = {
  ...streamedTextPart,
  id: "prt_9999_followup",
  text: "A sibling assistant text part was added.",
}

const assistantMessage = {
  info: {
    id: assistantMessageID,
    sessionID,
    role: "assistant",
    time: { created: 1700000001000 },
    parentID: userMessageID,
    modelID: model.modelID,
    providerID: model.providerID,
    mode: "build",
    agent: "build",
    path: { cwd: directory, root: directory },
    cost: 0.01,
    tokens: { input: 100, output: 200, reasoning: 0, cache: { read: 0, write: 0 } },
    variant: "max",
  },
  parts: [editPart],
}

test.describe("regression: session timeline local row state", () => {
  test("keeps a manually collapsed tool collapsed when later assistant content streams", async ({ page }) => {
    const events: EventPayload[] = []
    await mockServer(page, events)
    await configurePage(page)

    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
    await expectSessionTitle(page, title)

    const wrapper = page.locator(`[data-timeline-part-id="${editPartID}"]`).first()
    await expectAppVisible(wrapper)
    await expectExpanded(wrapper, true)

    await wrapper.evaluate((element) => {
      ;(element as HTMLElement).dataset.regressionMarker = "before-stream"
    })
    await wrapper.locator('[data-slot="collapsible-trigger"]').first().click()
    await expectExpanded(wrapper, false)

    events.push({
      directory,
      payload: {
        type: "message.part.updated",
        properties: { part: streamedTextPart },
      },
    })

    await expect(page.locator(`[data-timeline-part-id="${textPartID}"]`).first()).toBeVisible({ timeout: 10_000 })
    await page.locator('[data-slot="session-turn-steps"] [data-slot="collapsible-trigger"]').first().click()
    await page.locator('[data-slot="session-turn-step-group"] [data-slot="collapsible-trigger"]').first().click()

    expect(await readToolState(page)).toEqual({
      expanded: false,
      row: "AssistantSteps",
      streamedTextVisible: true,
    })
  })

  test("collapses the turn, activity group, and tool details independently", async ({ page }) => {
    const events: EventPayload[] = []
    await mockServer(page, events, [userMessage, { ...assistantMessage, parts: [editPart, commentaryPart, streamedTextPart] }])
    await configurePage(page, { editToolPartsExpanded: false })

    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
    await expectSessionTitle(page, title)

    const steps = page.locator('[data-slot="session-turn-steps"]').first()
    await expectAppVisible(steps)
    await expect(steps.locator('[data-slot="collapsible-trigger"]')).toHaveAttribute("aria-expanded", "false")
    await expect(steps.locator('[data-slot="session-turn-steps-content"]')).toHaveCount(0)

    await steps.locator('[data-slot="collapsible-trigger"]').first().click()
    await expect(page.locator(`[data-timeline-part-id="${commentaryPart.id}"]`).first()).toContainText(commentaryPart.text)
    await expect(page.locator(`[data-timeline-part-id="${commentaryPart.id}"]`).first()).toBeVisible()
    const activity = steps.locator('[data-slot="session-turn-step-group"]').first()
    const activityTrigger = activity.locator(':scope > [data-slot="collapsible-trigger"]')
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "false")
    await expect(activityTrigger).toContainText("Made 1 edit")
    await expect(page.locator(`[data-timeline-part-id="${editPartID}"]`).first()).toHaveCount(0)
    await activityTrigger.click()
    const edit = page.locator(`[data-timeline-part-id="${editPartID}"]`).first()
    await expect(edit).toBeVisible()
    await expect(edit.locator('[data-component="edit-content"]')).toHaveCount(0)
    await edit.locator('[data-slot="collapsible-trigger"]').first().click()
    await expect(edit.locator('[data-component="edit-content"]')).toBeVisible()

    await activityTrigger.click()
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "false")
    await expect(activity.locator('[data-slot="session-turn-step-group-content"]')).toHaveCount(0)

    await expect
      .poll(async () =>
        page.evaluate((textPartID) => {
          const stepsFrame = document
            .querySelector<HTMLElement>('[data-slot="session-turn-steps"]')
            ?.closest<HTMLElement>("[data-timeline-row]")
          const responseFrame = document
            .querySelector<HTMLElement>(`[data-timeline-part-id="${textPartID}"]`)
            ?.closest<HTMLElement>("[data-timeline-row]")
          if (!stepsFrame || !responseFrame) return Number.POSITIVE_INFINITY
          return responseFrame.getBoundingClientRect().top - stepsFrame.getBoundingClientRect().bottom
        }, textPartID),
      )
      .toBeLessThan(24)
  })

  test("keeps nested step controls keyboard-usable on a narrow timeline", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const events: EventPayload[] = []
    await mockServer(page, events, [userMessage, { ...assistantMessage, parts: [editPart, commentaryPart, streamedTextPart] }])
    await configurePage(page, { editToolPartsExpanded: false })

    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
    await expectSessionTitle(page, title)

    const steps = page.locator('[data-slot="session-turn-steps"]').first()
    const outer = steps.locator(':scope > [data-slot="collapsible-trigger"]')
    await outer.focus()
    await expect(outer).toBeFocused()
    await outer.press("Enter")
    await expect(outer).toHaveAttribute("aria-expanded", "true")

    const activity = steps.locator('[data-slot="session-turn-step-group"]').first()
    const activityTrigger = activity.locator(':scope > [data-slot="collapsible-trigger"]')
    await activityTrigger.focus()
    await expect(activityTrigger).toBeFocused()
    await activityTrigger.press("Enter")
    const edit = page.locator(`[data-timeline-part-id="${editPartID}"]`).first()
    await expect(edit).toBeVisible()
    await edit.scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })

  test("uses one turn-level trigger and summarizes adjacent tools", async ({ page }) => {
    const events: EventPayload[] = []
    await mockServer(page, events, [
      userMessage,
      { ...assistantMessage, parts: [editPart, streamedTextPart, secondEditPart] },
    ])
    await configurePage(page)

    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
    await expectSessionTitle(page, title)

    const steps = page.locator('[data-slot="session-turn-steps"]')
    const trigger = steps.locator('[data-slot="collapsible-trigger"]').first()
    const processRows = page.locator('[data-timeline-row="AssistantSteps"]')
    await expectAppVisible(trigger)
    await expect(steps).toHaveCount(1)
    await expect(page.locator('[data-slot="session-turn-steps-content"]')).toHaveCount(0)
    await expect(page.locator(`[data-timeline-part-id="${textPartID}"]`).first()).toContainText(streamedTextPart.text)

    await trigger.click()

    await expect(processRows).toHaveCount(1)
    await expect(page.locator('[data-slot="session-turn-steps-content"]')).toHaveCount(1)
    const activityTrigger = page.locator('[data-slot="session-turn-step-group"] [data-slot="collapsible-trigger"]')
    await expect(activityTrigger).toHaveCount(1)
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "false")
    await expect(activityTrigger).toContainText("Made 2 edits")
    await activityTrigger.click()
    await expect(page.locator(`[data-timeline-part-id="${editPartID}"]`).first()).toBeVisible()
    await expect(page.locator(`[data-timeline-part-id="${secondEditPart.id}"]`).first()).toBeVisible()
    await expect(page.locator(`[data-timeline-part-id="${textPartID}"]`).first()).toContainText(streamedTextPart.text)

    await trigger.click()
    await expect(page.locator('[data-slot="session-turn-steps-content"]')).toHaveCount(0)
    await expect(page.locator('[data-slot="session-turn-step-group"]')).toHaveCount(0)
  })

  test("collapses interrupted process while keeping assistant text visible", async ({ page }) => {
    const events: EventPayload[] = []
    const interruptedMessage = {
      ...assistantMessage,
      info: {
        ...assistantMessage.info,
        error: { name: "MessageAbortedError", data: { message: "Stopped" } },
      },
      parts: [editPart, streamedTextPart],
    }
    await mockServer(page, events, [userMessage, interruptedMessage])
    await configurePage(page)

    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
    await expectSessionTitle(page, title)

    const steps = page.locator('[data-slot="session-turn-steps"]').first()
    const trigger = steps.locator('[data-slot="collapsible-trigger"]').first()
    await expectAppVisible(steps)
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(steps.locator('[data-slot="session-turn-steps-content"]')).toHaveCount(0)
    await expect(page.locator(`[data-timeline-part-id="${textPartID}"]`).first()).toContainText(streamedTextPart.text)
    await expect(steps.locator('[data-slot="session-turn-steps-label"]')).toContainText("Interrupted")

    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  test("does not remount an edit diff when sibling parts or diff counts update", async ({ page }) => {
    const events: EventPayload[] = []
    await installDiffProbe(page)
    await mockServer(page, events, [userMessage, { ...assistantMessage, parts: [editPart, streamedTextPart] }])
    await configurePage(page)

    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
    await expectSessionTitle(page, title)
    await page.locator('[data-slot="session-turn-steps"] [data-slot="collapsible-trigger"]').first().click()
    await page.locator('[data-slot="session-turn-step-group"] [data-slot="collapsible-trigger"]').first().click()

    const wrapper = page.locator(`[data-timeline-part-id="${editPartID}"]`).first()
    await expectAppVisible(wrapper)
    const file = wrapper.locator('[data-component="file"][data-mode="diff"]').first()
    await expectAppVisible(file)
    await markDiffProbe(page)

    events.push({
      directory,
      payload: {
        type: "message.part.updated",
        properties: { part: followUpTextPart },
      },
    })

    await expect(page.locator(`[data-timeline-part-id="${followUpTextPart.id}"]`).first()).toBeVisible({
      timeout: 10_000,
    })
    const siblingProbe = await readDiffProbe(page)
    expect(siblingProbe).toEqual({
      fileMarker: "before",
      frameMarker: "before",
      rowKey: `assistant-steps:${userMessageID}:part:${assistantMessageID}:${editPartID}`,
      rowMarker: "before",
      shadowRoots: 0,
      toolMarker: "before",
    })

    await markDiffProbe(page)
    events.push({
      directory,
      payload: {
        type: "message.part.updated",
        properties: { part: editPartWithAdditions(2) },
      },
    })

    await expect(wrapper.locator('[data-slot="diff-changes-additions"]').filter({ hasText: "+2" }).first()).toBeVisible(
      { timeout: 10_000 },
    )
    expect(await readDiffProbe(page)).toEqual({
      fileMarker: "before",
      frameMarker: "before",
      rowKey: `assistant-steps:${userMessageID}:part:${assistantMessageID}:${editPartID}`,
      rowMarker: "before",
      shadowRoots: 0,
      toolMarker: "before",
    })
  })

  test("keeps a sticky edit header aligned with a multi-hunk diff", async ({ page }) => {
    const events: EventPayload[] = []
    const lines = Array.from({ length: 1_000 }, (_, index) => `export const value${index} = ${index}\n`).join("")
    const after = [100, 300, 500, 700, 900].reduce(
      (result, index) =>
        result.replace(`export const value${index} = ${index}`, `export const value${index} = compute(${index})`),
      lines,
    )
    const part = {
      ...editPart,
      state: {
        ...editPart.state,
        metadata: {
          ...editPart.state.metadata,
          filediff: {
            file: "src/regression.ts",
            additions: 1,
            deletions: 1,
            before: lines,
            after,
          },
        },
      },
    }
    await mockServer(page, events, [userMessage, { ...assistantMessage, parts: [part] }])
    await configurePage(page)

    await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
    await expectSessionTitle(page, title)

    const wrapper = page.locator(`[data-timeline-part-id="${editPartID}"]`).first()
    const trigger = wrapper.locator('[data-slot="collapsible-trigger"]').first()
    const diff = wrapper.locator('[data-component="edit-content"]').first()
    await expectAppVisible(diff)
    await expect.poll(() => wrapper.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(500)
    const samples = await wrapper.evaluate(async (element) => {
      const root = element.closest<HTMLElement>(".scroll-view__viewport")!
      element.scrollIntoView({ block: "start" })
      const result = []
      for (const offset of [0, 120, 240, 360, 480]) {
        root.scrollBy(0, offset - (result.at(-1)?.offset ?? 0))
        await new Promise(requestAnimationFrame)
        const trigger = element.querySelector<HTMLElement>('[data-slot="collapsible-trigger"]')!
        const diff = element.querySelector<HTMLElement>('[data-component="edit-content"]')!
        result.push({
          offset,
          trigger: trigger.getBoundingClientRect().y,
          diff: diff.getBoundingClientRect().y,
          bottom: element.getBoundingClientRect().bottom,
        })
      }
      return result
    })

    expect(samples[0]!.trigger).toBeLessThan(samples[0]!.diff)
    expect(samples.every((sample) => Math.abs(sample.trigger - samples[0]!.trigger) <= 1)).toBe(true)
    expect(samples.every((sample) => sample.trigger < sample.bottom)).toBe(true)
  })
})

async function configurePage(page: Page, general: Record<string, boolean> = {}) {
  await page.addInitScript((general) => {
    localStorage.setItem(
      "settings.v3",
      JSON.stringify({
        general: {
          editToolPartsExpanded: true,
          shellToolPartsExpanded: true,
          showReasoningSummaries: true,
          ...general,
        },
      }),
    )
  }, general)
}

async function expectExpanded(locator: Locator, expected: boolean) {
  await expect.poll(() => locator.evaluate(readExpanded)).toBe(expected)
}

async function readToolState(page: Page) {
  return page
    .locator(`[data-timeline-part-id="${editPartID}"]`)
    .first()
    .evaluate(
      (element, textPartID) => ({
        expanded: (() => {
          const trigger = element.querySelector('[data-slot="collapsible-trigger"]')
          const aria = trigger?.getAttribute("aria-expanded")
          if (aria === "true") return true
          if (aria === "false") return false

          const root = element.querySelector('[data-component="collapsible"]')
          if (root?.hasAttribute("data-expanded")) return true
          if (root?.hasAttribute("data-closed")) return false

          const content = element.querySelector<HTMLElement>('[data-slot="collapsible-content"]')
          return !!content && content.getBoundingClientRect().height > 0
        })(),
        row: element.closest("[data-timeline-row]")?.getAttribute("data-timeline-row"),
        streamedTextVisible: !!document.querySelector(`[data-timeline-part-id="${textPartID}"]`),
      }),
      textPartID,
    )
}

async function installDiffProbe(page: Page) {
  await page.addInitScript(() => {
    let shadowRootCount = 0
    const attachShadow = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (init) {
      shadowRootCount += 1
      return attachShadow.call(this, init)
    }
    window.__timelineDiffProbe = {
      reset: () => {
        shadowRootCount = 0
      },
      shadowRoots: () => shadowRootCount,
    }
  })
}

async function markDiffProbe(page: Page) {
  await page
    .locator(`[data-timeline-part-id="${editPartID}"]`)
    .first()
    .evaluate((element) => {
      const tool = element as HTMLElement
      const file = tool.querySelector<HTMLElement>('[data-component="file"][data-mode="diff"]')
      const row = tool.closest<HTMLElement>("[data-timeline-key]")
      const frame = tool.closest<HTMLElement>("[data-timeline-row]")
      if (!file) throw new Error("missing edit diff file")
      if (!row) throw new Error("missing virtual timeline row")
      if (!frame) throw new Error("missing timeline row frame")

      tool.dataset.timelineProbe = "before"
      file.dataset.timelineProbe = "before"
      row.dataset.timelineProbe = "before"
      frame.dataset.timelineProbe = "before"
      window.__timelineDiffProbe.reset()
    })
}

async function readDiffProbe(page: Page) {
  return page
    .locator(`[data-timeline-part-id="${editPartID}"]`)
    .first()
    .evaluate((element) => {
      const tool = element as HTMLElement
      const file = tool.querySelector<HTMLElement>('[data-component="file"][data-mode="diff"]')
      const row = tool.closest<HTMLElement>("[data-timeline-key]")
      const frame = tool.closest<HTMLElement>("[data-timeline-row]")
      return {
        fileMarker: file?.dataset.timelineProbe,
        shadowRoots: window.__timelineDiffProbe.shadowRoots(),
        toolMarker: tool.dataset.timelineProbe,
        rowMarker: row?.dataset.timelineProbe,
        rowKey: row?.dataset.timelineKey,
        frameMarker: frame?.dataset.timelineProbe,
      }
    })
}

function editPartWithAdditions(additions: number) {
  return {
    ...editPart,
    state: {
      ...editPart.state,
      metadata: {
        ...editPart.state.metadata,
        filediff: {
          ...editPart.state.metadata.filediff,
          additions,
        },
      },
    },
  }
}

function readExpanded(element: Element) {
  const trigger = element.querySelector('[data-slot="collapsible-trigger"]')
  const aria = trigger?.getAttribute("aria-expanded")
  if (aria === "true") return true
  if (aria === "false") return false

  const root = element.querySelector('[data-component="collapsible"]')
  if (root?.hasAttribute("data-expanded")) return true
  if (root?.hasAttribute("data-closed")) return false

  const content = element.querySelector<HTMLElement>('[data-slot="collapsible-content"]')
  return !!content && content.getBoundingClientRect().height > 0
}

async function mockServer(page: Page, events: EventPayload[], messages = [userMessage, assistantMessage]) {
  await mockOpenCodeServer(page, {
    protocol: "v1",
    directory,
    project: project(),
    provider: provider(),
    sessions: [session()],
    pageMessages: () => ({ items: messages }),
    events: () => events.splice(0, 1),
    eventRetry: 16,
  })
}

function project() {
  return {
    id: projectID,
    worktree: directory,
    vcs: "git",
    name: "timeline-state-regression",
    time: { created: 1700000000000, updated: 1700000000000 },
    sandboxes: [],
  }
}

function session() {
  return {
    id: sessionID,
    slug: "timeline-state-regression",
    projectID,
    directory,
    title,
    version: "dev",
    time: { created: 1700000000000, updated: 1700000000000 },
  }
}

function provider() {
  return {
    all: [
      {
        id: "opencode",
        name: "OpenCode",
        models: { "claude-opus-4-6": { id: "claude-opus-4-6", name: "Claude Opus 4.6", limit: { context: 200_000 } } },
      },
    ],
    connected: ["opencode"],
    default: { providerID: "opencode", modelID: "claude-opus-4-6" },
  }
}

function base64Encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
