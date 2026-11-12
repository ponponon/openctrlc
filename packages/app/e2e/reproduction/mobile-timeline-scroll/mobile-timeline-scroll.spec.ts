import { expect, test, type Page } from "@playwright/test"
import { base64Encode } from "@openctrlc/core/util/encode"
import { fixture, pageMessages } from "../../smoke/session-timeline.fixture"
import { mockOpenCodeServer } from "../../utils/mock-server"
import { expectAppVisible, expectSessionTitle } from "../../utils/waits"

type Sample = { t: number; top: number; height: number; key: string; rel: number }
type Snapshot = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceFromBottom: number
}

test.describe("reproduction: mobile timeline scroll", () => {
  test.setTimeout(120_000)

  test("sliding back through history never shifts content under the viewport", async ({ page }) => {
    await boot(page)
    await openTimeline(page)
    await startSampling(page)

    const rounds: unknown[] = []
    for (let round = 0; round < 6; round += 1) {
      const before = await snapshot(page)
      await slideTowardOlder(page, 380)
      await settle(page)
      const after = await snapshot(page)
      rounds.push({ round, from: before.scrollTop, to: after.scrollTop, height: after.scrollHeight })
    }

    const shifts = analyze(await readSamples(page))
    const final = await snapshot(page)
    expect(final.distanceFromBottom, `the gesture did not scroll: ${JSON.stringify(rounds)}`).toBeGreaterThan(1_000)
    // A row that stays mounted must not move under the viewport: any jump here is what the
    // user sees as the timeline "clacking" to a different position while sliding back.
    expect(shifts, JSON.stringify({ rounds, shifts }, null, 2)).toEqual([])
  })

  test("a slow older-messages page keeps the reading position", async ({ page }) => {
    await boot(page, { historyDelay: 900 })
    await openTimeline(page)
    await startSampling(page)
    await slideTowardOlder(page, 900)
    await settle(page)
    const parked = await snapshot(page)
    await page.waitForTimeout(1_500)
    const shifts = analyze(await readSamples(page))
    expect(parked.distanceFromBottom, JSON.stringify(parked)).toBeGreaterThan(400)
    expect(shifts, JSON.stringify({ parked, shifts }, null, 2)).toEqual([])
  })

  test("streaming output while reading history keeps the position", async ({ page }) => {
    const assistant = fixture.messages[fixture.targetID]!.filter((message) => message.info.role === "assistant").at(-1)!
    const assistantID = assistant.info.id
    const partID = assistant.parts.find((part) => part.type === "text")!.id
    let connections = 0
    await boot(page, {
      events: () => {
        connections += 1
        if (connections === 1) return [status("busy")]
        if (connections === 2) return [delta(" New output keeps arriving.")]
        if (connections === 3) return [delta(" More output arrives while you read."), status("busy")]
        if (connections === 4) return [status("idle")]
        return []
      },
    })
    await openTimeline(page)
    await startSampling(page)
    await slideTowardOlder(page, 900)
    await settle(page)
    const parked = await snapshot(page)
    await page.waitForTimeout(6_000)
    const later = await snapshot(page)
    const shifts = analyze(await readSamples(page))
    console.log("streaming", JSON.stringify({ parked, later, shifts, connections }, null, 2))
    expect(parked.distanceFromBottom, JSON.stringify(parked)).toBeGreaterThan(400)
    expect(shifts).toEqual([])

    function status(type: "busy" | "idle") {
      return envelope({ type: "session.status", properties: { sessionID: fixture.targetID, status: { type } } })
    }
    function delta(text: string) {
      return envelope({
        type: "message.part.delta",
        properties: { sessionID: fixture.targetID, messageID: assistantID, partID, field: "text", delta: text },
      })
    }
    function envelope(payload: { type: string; properties: unknown }) {
      return { directory: fixture.directory, payload: { id: `evt_${payload.type}_${connections}`, type: payload.type, properties: payload.properties } }
    }
  })

  test("flinging back to the newest message stays at the bottom", async ({ page }) => {
    await boot(page)
    await openTimeline(page)
    await slideTowardOlder(page, 900)
    await settle(page)
    const parked = await snapshot(page)
    expect(parked.distanceFromBottom).toBeGreaterThan(600)

    // Drag most of the way back deliberately, then fling the last stretch so the viewport
    // reaches the bottom while momentum is still running.
    await dragTowardNewest(page, Math.max(0, parked.distanceFromBottom - 260), 10, 2_000)
    await page.waitForTimeout(400)
    const attempts: unknown[] = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await flingTowardNewest(page)
      await page.waitForTimeout(1_500)
      const state = await snapshot(page)
      attempts.push(state)
      if (state.distanceFromBottom <= 2) break
    }
    // Momentum may overshoot or stop short, but once the viewport reaches the newest message
    // it must stay there: a restore to a stale reading anchor shows up as scrollTop moving
    // back up a second later.
    const reached = await snapshot(page)
    await page.waitForTimeout(2_000)
    const settled = await snapshot(page)
    expect(
      settled.distanceFromBottom,
      JSON.stringify({ parked, attempts, reached, settled }, null, 2),
    ).toBeLessThanOrEqual(2)
  })
})

function analyze(samples: Sample[]) {
  const shifts: { at: number; shift: number; scrollDelta: number; key: string }[] = []
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!
    const current = samples[index]!
    if (previous.key !== current.key) continue
    const scrollDelta = current.top - previous.top
    // Only frames where the scroller itself did not move: content that shifts under a
    // stationary viewport is exactly the "clack to another position" the user reports.
    // While the finger is scrolling, a moving row is indistinguishable from real scrolling.
    if (Math.abs(scrollDelta) > 1) continue
    const shift = current.rel - previous.rel
    if (Math.abs(shift) > 40) {
      shifts.push({
        at: Math.round(current.t),
        shift: Math.round(shift),
        scrollDelta: Math.round(scrollDelta),
        key: current.key,
      })
    }
  }
  return shifts
}

async function startSampling(page: Page) {
  await scroller(page).evaluate((element) => {
    const store = window as unknown as { __samples?: unknown[] }
    store.__samples = []
    const tick = () => {
      const view = element.getBoundingClientRect()
      const row = [...element.querySelectorAll<HTMLElement>("[data-timeline-key]")].find((node) => {
        const rect = node.getBoundingClientRect()
        return rect.bottom > view.top
      })
      store.__samples!.push([
        performance.now(),
        element.scrollTop,
        element.scrollHeight,
        row?.dataset.timelineKey ?? "",
        row ? row.getBoundingClientRect().top - view.top : 0,
      ])
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function readSamples(page: Page): Promise<Sample[]> {
  const raw = await page.evaluate(
    () => (window as unknown as { __samples?: [number, number, number, string, number][] }).__samples ?? [],
  )
  return raw.map(([t, top, height, key, rel]) => ({ t, top, height, key, rel }))
}

async function boot(page: Page, options: { historyDelay?: number; events?: () => unknown[] } = {}) {
  await mockOpenCodeServer(page, {
    sessions: fixture.sessions,
    provider: fixture.provider,
    directory: fixture.directory,
    project: fixture.project,
    pageMessages,
    events: options.events,
    eventRetry: 400,
    beforeMessagesResponse: async ({ before }) => {
      if (!before || options.historyDelay === undefined) return
      await new Promise((resolve) => setTimeout(resolve, options.historyDelay))
    },
  })
  await page.addInitScript(() => {
    localStorage.setItem(
      "settings.v3",
      JSON.stringify({
        general: { editToolPartsExpanded: true, shellToolPartsExpanded: true, showReasoningSummaries: true },
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
}

function scroller(page: Page) {
  return page.locator(".scroll-view__viewport", { has: page.locator("[data-timeline-row]") })
}

async function openTimeline(page: Page) {
  await page.goto(`/${base64Encode(fixture.directory)}/session/${fixture.targetID}`)
  await expectSessionTitle(page, fixture.expected.targetTitle)
  const root = scroller(page)
  await expectAppVisible(root)
  await expect(root.locator("[data-timeline-row]").first()).toBeVisible()
  await settle(page)
}

async function snapshot(page: Page): Promise<Snapshot> {
  return scroller(page).evaluate((element) => ({
    scrollTop: Math.round(element.scrollTop),
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    distanceFromBottom: Math.round(element.scrollHeight - element.clientHeight - element.scrollTop),
  }))
}

async function settle(page: Page, timeout = 15_000) {
  let previous = ""
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(await snapshot(page))
        const stable = current === previous
        previous = current
        return stable
      },
      { timeout, intervals: [200, 200, 300, 400, 500] },
    )
    .toBe(true)
}

/** Finger slides down: content moves down, revealing older messages. */
async function slideTowardOlder(page: Page, distance: number) {
  const box = await scroller(page).boundingBox()
  if (!box) throw new Error("timeline scroller is not visible")
  const x = Math.round(box.x + box.width / 2)
  const startY = Math.round(box.y + box.height * 0.25)
  const client = await page.context().newCDPSession(page)
  try {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY, id: 1 }] })
    for (let step = 1; step <= 12; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY + Math.round((step * distance) / 12), id: 1 }],
      })
      await page.waitForTimeout(16)
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  } finally {
    await client.detach()
  }
}

/** Finger slides up: content moves up, returning to newer messages. */
async function dragTowardNewest(page: Page, distance: number, steps: number, totalMs: number) {
  if (distance <= 0) return
  const box = await scroller(page).boundingBox()
  if (!box) throw new Error("timeline scroller is not visible")
  const x = Math.round(box.x + box.width / 2)
  const startY = Math.round(box.y + box.height * 0.85)
  const client = await page.context().newCDPSession(page)
  try {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY, id: 1 }] })
    for (let step = 1; step <= steps; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY - Math.round((step * distance) / steps), id: 1 }],
      })
      await page.waitForTimeout(Math.max(1, Math.round(totalMs / steps)))
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  } finally {
    await client.detach()
  }
}

async function flingTowardNewest(page: Page) {
  const box = await scroller(page).boundingBox()
  if (!box) throw new Error("timeline scroller is not visible")
  const x = Math.round(box.x + box.width / 2)
  const startY = Math.round(box.y + box.height * 0.85)
  const client = await page.context().newCDPSession(page)
  try {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY, id: 1 }] })
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY - step * 30, id: 1 }],
      })
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY - step * 30 - 4, id: 1 }],
      })
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  } finally {
    await client.detach()
  }
}
