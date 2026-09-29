import { describe, expect, test } from "bun:test"
import type { AssistantMessage } from "@openctrlc/sdk/v2/client"
import {
  applyRange,
  boxStats,
  buildChartEntries,
  chartCSV,
  histogram,
  METRIC_DEFS,
  metricValue,
  modelSummaries,
  movingAverage,
  percentileOf,
  summarize,
  summarizeMetric,
} from "./session-context-chart-data"

function message(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    id: overrides.id ?? "m1",
    sessionID: "s1",
    role: "assistant",
    time: {
      created: 1_000,
      completed: 3_000,
      ...(overrides.time ?? {}),
    },
    parentID: "",
    modelID: overrides.modelID ?? "model-a",
    providerID: overrides.providerID ?? "prov",
    mode: "build",
    agent: "build",
    path: { cwd: "/", root: "/" },
    cost: overrides.cost ?? 0.25,
    tokens: {
      input: 100,
      output: 200,
      reasoning: 50,
      cache: { read: 10, write: 5 },
      ...(overrides.tokens ?? {}),
    },
  } as AssistantMessage
}

describe("chart data", () => {
  test("builds entries with rate and optional generation metrics", () => {
    const entries = buildChartEntries(
      [
        message({
          id: "a",
          time: {
            created: 0,
            completed: 2_000,
            firstGenerated: 400,
            generationDuration: 1_000,
          } as AssistantMessage["time"],
        }),
        { role: "user", id: "u" } as never,
      ],
      () => "Model · Provider",
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].sequence).toBe(1)
    expect(entries[0].total).toBe(365)
    expect(entries[0].rate).toBeCloseTo(250 / 2)
    expect(entries[0].genRate).toBeCloseTo(250)
    expect(entries[0].ttftMs).toBe(400)
    expect(entries[0].generationMs).toBe(1_000)
  })

  test("metricValue matches definition families", () => {
    const [entry] = buildChartEntries([message({ id: "a" })], () => "m")
    expect(metricValue(entry, "input")).toBe(100)
    expect(metricValue(entry, "cost")).toBe(0.25)
    expect(metricValue(entry, "duration")).toBe(2)
    expect(metricValue(entry, "genRate")).toBeUndefined()
    expect(metricValue(entry, "ttft")).toBeUndefined()
  })

  test("summarize exposes p90 and peak message", () => {
    const summary = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ["a", "b", "c", "d", "e", "f", "g", "h", "i", "peak"])
    expect(summary.count).toBe(10)
    expect(summary.average).toBe(5.5)
    expect(summary.median).toBe(5.5)
    expect(summary.p90).toBe(9)
    expect(summary.maximum).toBe(10)
    expect(summary.peakMessageID).toBe("peak")
  })

  test("summarizeMetric is stable with empty input", () => {
    expect(summarizeMetric([]).count).toBe(0)
  })

  test("moving average trails over available values", () => {
    expect(movingAverage([1, 2, 3, 4], 3)).toEqual([1, 1.5, 2, 3])
    expect(movingAverage([1, undefined, 3], 3)).toEqual([1, 1, 2])
    expect(movingAverage([1, 2], 1)).toEqual([1, 2])
  })

  test("applyRange keeps tail messages", () => {
    const entries = buildChartEntries(
      Array.from({ length: 5 }, (_, index) => message({ id: `m${index}` })),
      () => "m",
    )
    expect(applyRange(entries, "20")).toHaveLength(5)
    expect(applyRange(entries, "20").map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5])
  })

  test("modelSummaries aggregates per model", () => {
    const entries = buildChartEntries(
      [
        message({ id: "a", providerID: "p1", modelID: "m1" }),
        message({ id: "b", providerID: "p1", modelID: "m1", cost: 0.5 }),
        message({ id: "c", providerID: "p2", modelID: "m2" }),
      ],
      (item) => `${item.providerID}/${item.modelID}`,
    )
    const summaries = modelSummaries(entries, ["red", "blue"], "cost")
    expect(summaries).toHaveLength(2)
    expect(summaries[0].count).toBe(2)
    expect(summaries[0].costTotal).toBe(0.75)
    expect(summaries[1].count).toBe(1)
  })

  test("chartCSV escapes labels and includes optional compare column", () => {
    const entries = buildChartEntries([message({ id: "a" })], () => 'Model, "quoted"')
    const csv = chartCSV(entries, "cost", "成本", "rate", "速率")
    const lines = csv.split("\n")
    expect(lines[0]).toContain("成本")
    expect(lines[0]).toContain("速率")
    expect(lines[1]).toContain('"Model, ""quoted"""')
  })

  test("metric defs cover rate, cost, and second families", () => {
    expect(METRIC_DEFS.rate.additive).toBe(false)
    expect(METRIC_DEFS.cost.additive).toBe(true)
    expect(METRIC_DEFS.cumCost.additive).toBe(false)
    expect(METRIC_DEFS.ttft.fractionDigits).toBe(2)
    expect(Object.keys(METRIC_DEFS)).toHaveLength(14)
  })

  test("cumulative metrics track running totals", () => {
    const entries = buildChartEntries([message({ id: "a", cost: 0.1 }), message({ id: "b", cost: 0.25 })], () => "m")
    expect(entries[0].cumCost).toBeCloseTo(0.1)
    expect(entries[1].cumCost).toBeCloseTo(0.35)
    expect(metricValue(entries[1], "cumCost")).toBeCloseTo(0.35)
    expect(metricValue(entries[0], "cumTokens")).toBe(365)
  })
})

describe("distribution helpers", () => {
  test("histogram buckets values and tracks models", () => {
    const bins = histogram(
      [
        { value: 1, modelKey: "a" },
        { value: 2, modelKey: "a" },
        { value: 10, modelKey: "b" },
        { value: 11, modelKey: "b" },
      ],
      2,
    )
    expect(bins).toHaveLength(2)
    expect(bins[0].count + bins[1].count).toBe(4)
    expect(bins[0].byModel.a).toBe(2)
    expect(bins[1].byModel.b).toBe(2)
  })

  test("histogram collapses identical values into one bin", () => {
    const bins = histogram(
      [
        { value: 5, modelKey: "a" },
        { value: 5, modelKey: "b" },
      ],
      8,
    )
    expect(bins).toHaveLength(1)
    expect(bins[0].count).toBe(2)
  })

  test("boxStats fences outliers", () => {
    const stats = boxStats([1, 2, 3, 4, 5, 100])
    expect(stats?.median).toBe(3.5)
    expect(stats?.outliers).toEqual([100])
    expect(stats?.count).toBe(6)
  })

  test("percentileOf interpolates", () => {
    expect(percentileOf([0, 10], 50)).toBe(5)
    expect(percentileOf([4], 90)).toBe(4)
    expect(percentileOf([], 50)).toBeUndefined()
  })
})
