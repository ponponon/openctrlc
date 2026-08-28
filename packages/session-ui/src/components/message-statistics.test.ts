import { describe, expect, test } from "bun:test"
import { assistantStatistics } from "./message-statistics"

describe("assistantStatistics", () => {
  test("calculates output tokens, duration, and tokens per second", () => {
    expect(assistantStatistics({ output: 800, created: 1_000, completed: 3_000 })).toEqual({
      output: 800,
      durationMs: 2_000,
      tokensPerSecond: 400,
    })
  })

  test("accepts fractional rates", () => {
    expect(assistantStatistics({ output: 408, created: 0, completed: 2_600 })?.tokensPerSecond).toBeCloseTo(156.9230769)
  })

  test.each([
    { output: 0, created: 1_000, completed: 2_000 },
    { output: undefined, created: 1_000, completed: 2_000 },
    { output: 100, created: undefined, completed: 2_000 },
    { output: 100, created: 1_000, completed: undefined },
    { output: 100, created: 2_000, completed: 1_000 },
    { output: 100, created: 1_000, completed: 1_000 },
    { output: Number.NaN, created: 1_000, completed: 2_000 },
    { output: 100, created: Number.POSITIVE_INFINITY, completed: 2_000 },
  ])("rejects invalid input %#", (input) => {
    expect(assistantStatistics(input)).toBeUndefined()
  })
})
