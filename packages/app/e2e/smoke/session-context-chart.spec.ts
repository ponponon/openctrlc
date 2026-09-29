import { base64Encode } from "@openctrlc/core/util/encode"
import { expect, test } from "@playwright/test"
import { fixture, pageMessages } from "./session-context-chart.fixture"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`

test.use({ viewport: { width: 1440, height: 900 } })

test.describe("smoke: session context chart", () => {
  test.setTimeout(120_000)

  test("renders multi-model chart analysis and distribution", async ({ page }) => {
    await mockOpenCodeServer(page, {
      directory: fixture.directory,
      project: fixture.project,
      provider: fixture.provider,
      sessions: fixture.sessions,
      pageMessages,
    })
    await page.addInitScript(
      ({ directory, server, sessionID }) => {
        localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
        localStorage.setItem(
          "openctrlc.global.dat:server",
          JSON.stringify({
            projects: { local: [{ worktree: directory, expanded: true }] },
            lastProject: { local: directory },
          }),
        )
        localStorage.setItem(
          "openctrlc.window.browser.dat:tabs",
          JSON.stringify([{ type: "session", server, sessionId: sessionID }]),
        )
      },
      { directory: fixture.directory, server, sessionID: fixture.sessionID },
    )

    await page.goto(`/server/${base64Encode(server)}/session/${fixture.sessionID}`)
    await expectSessionTitle(page, fixture.title)

    const reviewToggle = page.getByRole("button", { name: "Toggle review" })
    await reviewToggle.click()
    await page.getByRole("button", { name: "View context usage" }).click()
    await expect(page.getByRole("tab", { name: "Context" })).toHaveAttribute("data-selected", "")

    await page.getByRole("button", { name: "Chart", exact: true }).click()
    await expect(page.getByRole("button", { name: "Expand analysis" })).toBeVisible()
    await expect(page.locator("#session-token-speed-chart [data-chart-point]").first()).toBeVisible()

    await page.getByRole("button", { name: "Expand analysis" }).click()
    const dialog = page.locator('[data-component="dialog"]')
    await expect(dialog).toBeVisible()

    const metricBar = dialog.getByRole("group", { name: "Chart metrics" })
    await expect(metricBar.getByRole("button", { name: "Average rate (Token/s)", exact: true })).toBeVisible()
    await expect(metricBar.getByRole("button", { name: "Cost (USD)", exact: true })).toBeVisible()
    await expect(metricBar.getByRole("button", { name: "Cumulative cost (USD)", exact: true })).toBeVisible()
    await expect(metricBar.getByRole("button", { name: "Time to first token (s)", exact: true })).toBeVisible()
    await expect(dialog.getByText("P90", { exact: true })).toBeVisible()
    await expect(dialog.getByText(/valid points/i)).toBeVisible()

    for (const label of fixture.expected.modelLabels) {
      await expect(dialog.getByRole("button", { name: new RegExp(`^${label}`) })).toBeVisible()
    }

    await dialog.getByRole("button", { name: "Distribution", exact: true }).click()
    await expect(dialog.getByText("Histogram", { exact: true })).toBeVisible()
    await expect(dialog.getByText("Box plot by model", { exact: true })).toBeVisible()

    await dialog.getByRole("button", { name: "Model compare", exact: true }).click()
    await expect(dialog.getByText("Cost share", { exact: true })).toHaveCount(fixture.expected.modelLabels.length)

    await dialog.getByRole("button", { name: "Export", exact: true }).click()
    await expect(page.getByRole("menuitem", { name: /^Export visible #\d+–#\d+ \(\d+ msgs\)$/ })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: /^Export all messages CSV \(\d+ msgs\)$/ })).toBeVisible()
  })
})
