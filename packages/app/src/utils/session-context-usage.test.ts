import { describe, expect, test } from "bun:test"
import { contextUsagePercent, formatContextUsage, formatTokenCount } from "./session-context-usage"

describe("formatTokenCount", () => {
  test("keeps small counts exact", () => {
    expect(formatTokenCount(0)).toBe("")
    expect(formatTokenCount(999)).toBe("999")
  })

  test("uses thousands and millions", () => {
    expect(formatTokenCount(1_000)).toBe("1K")
    expect(formatTokenCount(636_000)).toBe("636K")
    expect(formatTokenCount(1_000_000)).toBe("1M")
    expect(formatTokenCount(1_240_000)).toBe("1.2M")
  })

  test("promotes counts that would round to four digits", () => {
    expect(formatTokenCount(949_000)).toBe("949K")
    expect(formatTokenCount(950_000)).toBe("1M")
    expect(formatTokenCount(999_499)).toBe("1M")
  })
})

describe("formatContextUsage", () => {
  test("renders the current window and its limit", () => {
    expect(formatContextUsage(636_000, 1_000_000)).toBe("636K / 1M")
  })

  test("falls back to the raw count without a limit", () => {
    expect(formatContextUsage(636_000, undefined)).toBe("636K")
    expect(formatContextUsage(636_000, 0)).toBe("636K")
  })

  test("hides sessions without a completed step", () => {
    expect(formatContextUsage(undefined, 1_000_000)).toBeUndefined()
    expect(formatContextUsage(0, 1_000_000)).toBeUndefined()
  })
})

describe("contextUsagePercent", () => {
  test("reports the share of the context window", () => {
    expect(contextUsagePercent(636_000, 1_000_000)).toBe(64)
  })

  test("stays undefined without a limit", () => {
    expect(contextUsagePercent(636_000, undefined)).toBeUndefined()
    expect(contextUsagePercent(undefined, 1_000_000)).toBeUndefined()
  })
})
