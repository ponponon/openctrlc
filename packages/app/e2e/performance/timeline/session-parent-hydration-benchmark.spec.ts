import type { Page } from "@playwright/test"
import { expectSessionTitle } from "../../utils/waits"
import { mockOpenCodeServer } from "../../utils/mock-server"
import { benchmark, expect, withBenchmarkPage } from "../benchmark"
import { fixture } from "./session-timeline-stress.fixture"
import { installStressSessionTabs, stressSessionHref } from "./timeline-test-helpers"
import { measureSessionSwitch, waitForStableTimeline } from "./session-tab-switch-probe"

const userID = "msg_parent_hydration_user"
const expectedPageSize = 20
const userSeed = fixture.messages[fixture.targetID][0]!
const user = {
  ...userSeed,
  info: { ...userSeed.info, id: userID, time: { created: 1700001000000 } },
  parts: userSeed.parts.map((part, index) => ({ ...part, id: `prt_parent_hydration_user_${index}`, messageID: userID })),
}
const assistantSeed = fixture.messages[fixture.targetID][3]!
const assistants = Array.from({ length: 20 }, (_, index) => {
  const messageID = `msg_parent_hydration_${String(index).padStart(2, "0")}`
  return {
    ...assistantSeed,
    info: {
      ...assistantSeed.info,
      id: messageID,
      parentID: userID,
      time: { created: 1700001001000 + index * 1_000, completed: 1700001001500 + index * 1_000 },
    },
    parts: assistantSeed.parts.map((part, partIndex) => ({
      ...part,
      id: `prt_parent_hydration_${String(index).padStart(2, "0")}_${partIndex}`,
      messageID,
    })),
  }
})
const messages = assistants
const target = fixture.sessions.find((session) => session.id === fixture.targetID)!
const lastAssistant = assistants.at(-1)!
const lastID = userID
const lastPartID = `${lastAssistant.info.id}:text:0`

benchmark("loads assistant-only session pages with sidecar turn roots", async ({ browser, report }, testInfo) => {
  benchmark.setTimeout(180_000)
  const results = [] as Awaited<ReturnType<typeof trial>>[]
  for (let run = 0; run < 5; run++) {
    results.push(
      await withBenchmarkPage(
        browser,
        `session-parent-hydration-${run}`,
        trial,
        testInfo,
      ),
    )
  }
  const timing = results.map((result) => result.metrics.firstCorrectObservedMs!).sort((a, b) => a - b)
  report(
    {
      results: results.map((result) => ({
        ...result.metrics,
        requestCounts: result.requestCounts,
        pageLimits: result.pageLimits,
      })),
      summary: {
        firstCorrectObservedMs: { min: timing[0], median: timing[2], max: timing.at(-1) },
        blankSamples: results.map((result) => result.metrics.blankSamples),
        requestCounts: {
          list: results.map((result) => result.requestCounts.list),
          parent: results.map((result) => result.requestCounts.parent),
        },
      },
    },
  )
})

async function trial(page: Page) {
  const requests: { type: "list" | "parent"; before?: string }[] = []
  const pageLimits: number[] = []
  let sidecarCount = -1
  page.on("response", async (response) => {
    if (!response.url().includes(fixture.targetID) || !response.url().includes("message")) return
    const count = ((await response.json().catch(() => undefined)) as { parents?: unknown[] } | undefined)?.parents?.length ?? 0
    sidecarCount = Math.max(sidecarCount, count)
  })
  await mockOpenCodeServer(page, {
    protocol: "v2",
    sessions: fixture.sessions.filter((session) => session.id === fixture.sourceID),
    provider: fixture.provider,
    directory: fixture.directory,
    project: fixture.project,
    messageDelay: 50,
    onMessages: (request) => {
      if (request.sessionID === fixture.targetID && request.phase === "start")
        requests.push({ type: "list", before: request.before })
    },
    onMessage: (request) => {
      if (request.sessionID === fixture.targetID && parents.has(request.messageID)) requests.push({ type: "parent" })
    },
    parentMessages: (sessionID) => (sessionID === fixture.targetID ? [user] : []),
    message: (sessionID, messageID) => (sessionID === fixture.targetID && messageID === userID ? user : undefined),
    pageMessages: (sessionID, limit, before) => {
      if (sessionID === fixture.targetID) pageLimits.push(limit)
      const items = sessionID === fixture.targetID ? messages : fixture.messages[fixture.sourceID]
      const end = before ? items.findIndex((message) => message.info.id === before) : items.length
      const start = Math.max(0, end - limit)
      return { items: items.slice(start, end), cursor: start > 0 ? items[start]!.info.id : undefined }
    },
  })
  await page.route(`**/session/${fixture.targetID}`, (route) => {
    const current = new URL(route.request().url()).pathname.startsWith("/api/")
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        current
          ? {
              data: {
                ...target,
                cost: 0,
                tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
                location: { directory: target.directory },
              },
            }
          : target,
      ),
    })
  })
  await installStressSessionTabs(page, { sessionIDs: [fixture.sourceID] })
  await page.goto(stressSessionHref(fixture.sourceID))
  await expectSessionTitle(page, fixture.expected.sourceTitle)
  await waitForStableTimeline(page, fixture.expected.sourceMessageIDs.at(-1)!)

  const href = stressSessionHref(fixture.targetID)
  await page.evaluate(
    ({ href, title }) => {
      const link = document.createElement("a")
      link.id = "parent-hydration-target"
      link.href = href
      link.textContent = title
      document.body.append(link)
    },
    { href, title: target.title },
  )
  const metrics = await measureSessionSwitch(page, {
    destinationIDs: [userID],
    sourceIDs: fixture.messages[fixture.sourceID].map((message) => message.info.id),
    lastID,
    requiredPartID: lastPartID,
    requireBottomAnchor: false,
    href,
    switch: async () => {
      await page.locator("#parent-hydration-target").click()
      await expectSessionTitle(page, target.title)
      await expect.poll(() => sidecarCount).toBe(1)
    },
  })
  expect(metrics.firstCorrectObservedMs).not.toBeNull()
  const requestCounts = {
    list: requests.filter((request) => request.type === "list").length,
    parent: requests.filter((request) => request.type === "parent").length,
  }
  expect(requestCounts.list).toBe(1)
  expect(sidecarCount).toBe(1)
  expect(requestCounts.parent).toBe(0)
  expect(pageLimits).toEqual([expectedPageSize])
  return { metrics, requestCounts, pageLimits }
}
