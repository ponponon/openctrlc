import { describe, expect, test } from "bun:test"
import { contextUsagePercent } from "./session-context-usage"

describe("contextUsagePercent", () => {
  test("reports the share of the context window", () => {
    expect(contextUsagePercent(636_000, 1_000_000)).toBe(64)
  })

  test("stays undefined without a limit", () => {
    expect(contextUsagePercent(636_000, undefined)).toBeUndefined()
    expect(contextUsagePercent(636_000, 0)).toBeUndefined()
    expect(contextUsagePercent(undefined, 1_000_000)).toBeUndefined()
  })
})
