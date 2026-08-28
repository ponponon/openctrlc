import { expect, test } from "@playwright/test"

test("renders the production session search bar and handles every state", async ({ page }) => {
  await page.goto("/")
  const bar = page.locator('[data-component="session-search-bar"]')
  await expect(bar).toHaveCount(0)

  await page.evaluate(() => window.__sessionSearchHarness?.set({ open: true }))
  await expect(bar).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Search session messages" })).toBeFocused()
  await expect(page.getByPlaceholder("Search this session")).toHaveAttribute("aria-label", "Search session messages")
  const scope = bar.locator('[data-slot="select-select-trigger"]')
  await expect(scope).toBeVisible()

  const query = page.getByRole("textbox", { name: "Search session messages" })
  await query.fill("needle")
  await expect.poll(() => page.evaluate(() => window.__sessionSearchHarness?.state.query)).toBe("needle")
  await scope.click()
  await page.getByRole("option", { name: "All content" }).click()
  await expect.poll(() => page.evaluate(() => window.__sessionSearchHarness?.state.scope)).toBe("all")

  await page.evaluate(() => window.__sessionSearchHarness?.set({ matches: 2, activeMatch: 1 }))
  await expect(bar).toContainText("2 of 2 results")
  const previous = page.getByRole("button", { name: "Previous result" })
  const next = page.getByRole("button", { name: "Next result" })
  await expect(previous).toBeEnabled()
  await expect(next).toBeEnabled()
  await previous.click()
  await next.click()
  await expect.poll(() => page.evaluate(() => window.__sessionSearchHarness?.state.navigation)).toEqual([-1, 1])

  await page.evaluate(() => window.__sessionSearchHarness?.set({ error: "History unavailable" }))
  await expect(bar).toContainText("History unavailable")
  await page.evaluate(() => window.__sessionSearchHarness?.set({ partial: true }))
  await expect(bar).toContainText("Partial history")
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.poll(() => page.evaluate(() => window.__sessionSearchHarness?.state.retries)).toBe(1)

  await page.evaluate(() => window.__sessionSearchHarness?.set({ loading: true, error: undefined }))
  await expect(bar).toContainText("Loading results...")
  await page.evaluate(() => window.__sessionSearchHarness?.set({ loading: false, matches: 0 }))
  await expect(bar).toContainText("No results")
  await expect(previous).toBeDisabled()
  await expect(next).toBeDisabled()

  await page.getByRole("button", { name: "Close search" }).click()
  await expect(bar).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__sessionSearchHarness?.state.closed)).toBe(1)
})
