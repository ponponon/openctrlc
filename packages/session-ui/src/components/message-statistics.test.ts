import { describe, expect, test } from "bun:test"
import { assistantStatistics } from "./message-statistics"

describe("assistantStatistics", () => {
  test("calculates total generated tokens, duration, and tokens per second", () => {
    expect(assistantStatistics({ output: 800, reasoning: 200, created: 1_000, completed: 3_000 })).toEqual({
      output: 800,
      reasoning: 200,
      total: 1_000,
      durationMs: 2_000,
      tokensPerSecond: 500,
    })
  })

  test("accepts fractional rates", () => {
    expect(assistantStatistics({ output: 408, created: 0, completed: 2_600 })?.tokensPerSecond).toBeCloseTo(156.9230769)
  })

  test("includes reasoning tokens and excludes post-generation time from the stream rate", () => {
    expect(
      assistantStatistics({
        output: 300,
        reasoning: 700,
        created: 100,
        completed: 5_000,
        requestStarted: 200,
        firstGenerated: 1_000,
        lastGenerated: 5_000,
        generationDuration: 2_000,
        providerCompleted: 6_000,
      }),
    ).toEqual({
      output: 300,
      reasoning: 700,
      total: 1_000,
      durationMs: 2_000,
      tokensPerSecond: 500,
    })
  })

  test("supports reasoning-only responses", () => {
    expect(
      assistantStatistics({
        output: 0,
        reasoning: 500,
        created: 1_000,
        completed: 3_000,
      })?.total,
    ).toBe(500)
  })

  test("rejects finite timestamps whose duration overflows", () => {
    expect(
      assistantStatistics({
        output: 100,
        created: -Number.MAX_VALUE,
        completed: Number.MAX_VALUE,
      }),
    ).toBeUndefined()
  })

  test.each([
    { output: 0, reasoning: 0, created: 1_000, completed: 2_000 },
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
