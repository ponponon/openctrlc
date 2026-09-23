import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@openctrlc/core/util/encode"
import { fixture } from "../smoke/session-timeline.fixture"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible, expectSessionTitle } from "../utils/waits"

type TimelineSnapshot = {
  topPartID: string | null
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceFromBottom: number
}

test.describe("regression: session tab scroll position", () => {
  test.setTimeout(180_000)

  test("restores the timeline position after switching away and back", async ({ page }) => {
    await bootTabsPage(page)
    await page.goto(`/${base64Encode(fixture.directory)}/session/${fixture.targetID}`)
    await expectSessionTitle(page, fixture.expected.targetTitle)
    await waitForTimeline(page)

    await scrollTimelineUp(page, 2_000)
    await waitForStableTimeline(page)
    const before = await snapshot(page)
    expect(before.distanceFromBottom, `expected a mid-timeline position: ${JSON.stringify(before)}`).toBeGreaterThan(500)

    const rounds: TimelineSnapshot[] = []
    for (let round = 0; round < 3; round += 1) {
      await switchTitlebarSession(page, fixture.sourceID, fixture.expected.sourceTitle)
      await expectSessionTitle(page, fixture.expected.sourceTitle)
      await switchTitlebarSession(page, fixture.targetID, fixture.expected.targetTitle)
      await expectSessionTitle(page, fixture.expected.targetTitle)
      await waitForStableTimeline(page)
      rounds.push(await snapshot(page))
    }

    // The position must survive every switch, not just the first one.
    for (const [index, state] of rounds.entries()) {
      expect(
        state.topPartID,
        `top part changed on switch ${index + 1}\n${JSON.stringify({ before, rounds })}`,
      ).toBe(before.topPartID)
      expect(
        state.distanceFromBottom,
        `timeline snapped back to the bottom on switch ${index + 1}\n${JSON.stringify({ before, rounds })}`,
      ).toBeGreaterThan(500)
    }

    // Virtualized rows above the viewport can be re-measured while restoring, so the raw
    // offset is allowed to correct itself once. It must then be a fixed point: otherwise
    // every switch would drift a little further away from where the user left off.
    expect(rounds[1]!.scrollTop, `offset drifted between switches\n${JSON.stringify(rounds)}`).toBe(
      rounds[0]!.scrollTop,
    )
    expect(rounds[2]!.scrollTop, `offset drifted between switches\n${JSON.stringify(rounds)}`).toBe(
      rounds[0]!.scrollTop,
    )
  })

  test("keeps following the latest message after switching away and back", async ({ page }) => {
    await bootTabsPage(page)
    await page.goto(`/${base64Encode(fixture.directory)}/session/${fixture.targetID}`)
    await expectSessionTitle(page, fixture.expected.targetTitle)
    await waitForTimeline(page)

    await scrollTimelineDown(page)
    await waitForStableTimeline(page)
    await expect
      .poll(() => snapshot(page).then((state) => state.distanceFromBottom))
      .toBeLessThanOrEqual(1)

    await switchTitlebarSession(page, fixture.sourceID, fixture.expected.sourceTitle)
    await expectSessionTitle(page, fixture.expected.sourceTitle)
    await switchTitlebarSession(page, fixture.targetID, fixture.expected.targetTitle)
    await expectSessionTitle(page, fixture.expected.targetTitle)
    await waitForStableTimeline(page)

    await expect
      .poll(() => snapshot(page).then((state) => state.distanceFromBottom))
      .toBeLessThanOrEqual(1)
  })

  test("resumes following once the user scrolls back to the bottom", async ({ page }) => {
    await bootTabsPage(page)
    await page.goto(`/${base64Encode(fixture.directory)}/session/${fixture.targetID}`)
    await expectSessionTitle(page, fixture.expected.targetTitle)
    await waitForTimeline(page)

    await scrollTimelineUp(page, 2_000)
    await waitForStableTimeline(page)
    expect((await snapshot(page)).distanceFromBottom).toBeGreaterThan(500)

    // Returning to the bottom must be recorded as a real intent change, otherwise a
    // restored session could never start following the newest message again.
    await scrollTimelineDown(page)
    await waitForStableTimeline(page)

    await switchTitlebarSession(page, fixture.sourceID, fixture.expected.sourceTitle)
    await expectSessionTitle(page, fixture.expected.sourceTitle)
    await switchTitlebarSession(page, fixture.targetID, fixture.expected.targetTitle)
    await expectSessionTitle(page, fixture.expected.targetTitle)
    await waitForStableTimeline(page)

    const after = await snapshot(page)
    expect(after.distanceFromBottom, `expected to stay at the bottom\n${JSON.stringify(after)}`).toBeLessThanOrEqual(1)
  })
})

async function centerOf(locator: ReturnType<typeof timelineScroller>): Promise<[number, number]> {
  const box = await locator.boundingBox()
  if (!box) throw new Error("Timeline scroller is not visible")
  return [box.x + box.width / 2, box.y + box.height / 2]
}

async function bootTabsPage(page: Page) {
  await mockOpenCodeServer(page, {
    sessions: fixture.sessions,
    provider: fixture.provider,
    directory: fixture.directory,
    project: fixture.project,
    pageMessages: (sessionID) => ({ items: fixture.messages[sessionID as keyof typeof fixture.messages] ?? [] }),
  })
  await page.addInitScript(() => {
    localStorage.setItem(
      "settings.v3",
      JSON.stringify({
        general: {
          editToolPartsExpanded: true,
          shellToolPartsExpanded: true,
          showReasoningSummaries: true,
        },
      }),
    )
  })
  await page.addInitScript((directory) => {
    localStorage.setItem(
      "openctrlc.global.dat:server",
      JSON.stringify({
        projects: { local: [{ worktree: directory, expanded: true }] },
        lastProject: { local: directory },
      }),
    )
  }, fixture.directory)
  await page.addInitScript(
    ({ dirBase64, sourceID, targetID }) => {
      localStorage.setItem(
        "openctrlc.window.browser.dat:tabs",
        JSON.stringify(
          [sourceID, targetID].map((sessionId) => ({
            type: "session",
            server: "http://127.0.0.1:4096",
            dirBase64,
            sessionId,
          })),
        ),
      )
    },
    { dirBase64: base64Encode(fixture.directory), sourceID: fixture.sourceID, targetID: fixture.targetID },
  )
}

function timelineScroller(page: Page) {
  return page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })
}

async function waitForTimeline(page: Page) {
  const scroller = timelineScroller(page)
  await expectAppVisible(scroller)
  await expect(scroller.locator("[data-timeline-row]").first()).toBeVisible()
  await waitForStableTimeline(page)
}

async function snapshot(page: Page): Promise<TimelineSnapshot> {
  return timelineScroller(page).evaluate((element) => {
    const view = element.getBoundingClientRect()
    const top = [...element.querySelectorAll<HTMLElement>("[data-timeline-part-id]")].find((node) => {
      const rect = node.getBoundingClientRect()
      return rect.bottom > view.top && rect.top < view.bottom
    })
    return {
      topPartID: top?.dataset.timelinePartId ?? null,
      scrollTop: Math.round(element.scrollTop),
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      distanceFromBottom: Math.round(element.scrollHeight - element.clientHeight - element.scrollTop),
    }
  })
}

async function waitForStableTimeline(page: Page) {
  let previous = ""
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(await snapshot(page))
        const stable = current === previous
        previous = current
        return stable
      },
      { timeout: 30_000 },
    )
    .toBe(true)
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

async function scrollTimelineDown(page: Page) {
  const scroller = timelineScroller(page)
  await page.mouse.move(...(await centerOf(scroller)))
  await expect
    .poll(
      async () => {
        const current = await snapshot(page)
        if (current.distanceFromBottom <= 1) return current.distanceFromBottom
        await page.mouse.wheel(0, 900)
        return (await snapshot(page)).distanceFromBottom
      },
      { timeout: 90_000 },
    )
    .toBeLessThanOrEqual(1)
}

async function switchTitlebarSession(page: Page, sessionID: string, title: string) {
  const href = `/server/${base64Encode(fixture.serverKey)}/session/${sessionID}`
  const tab = page.locator(`[data-slot="titlebar-tabs"] a[href="${href}"]`).first()
  await expectAppVisible(tab)
  await tab.click()
  await expectSessionTitle(page, title)
}
