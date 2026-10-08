import { expect, test } from "@playwright/test"

test("rapidly replacing virtual file rows does not leave stale rows or runtime errors", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto("/")
  const list = page.locator('[data-component="file-tree-v2"]')
  const rows = list.locator('[data-slot="file-tree-v2-row"]')
  await expect(list).toHaveAttribute("data-total-rows", "1000")
  await expect(rows).not.toHaveCount(0)
  expect(await rows.count()).toBeLessThan(1_000)

  await page.getByRole("button", { name: "Replace rows rapidly" }).click()

  await expect(list).toHaveAttribute("data-total-rows", "1")
  await expect(rows).toHaveCount(1)
  await expect(rows).toHaveAttribute("data-path", "final/keep.ts")
  expect(pageErrors).toEqual([])
})
