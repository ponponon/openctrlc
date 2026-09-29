import type { AssistantMessage, Message } from "@openctrlc/sdk/v2/client"
import { assistantStatistics } from "@openctrlc/session-ui/message-statistics"

export const CHART_METRICS = [
  "rate",
  "genRate",
  "total",
  "input",
  "output",
  "reasoning",
  "cacheRead",
  "cacheWrite",
  "cost",
  "cumCost",
  "cumTokens",
  "duration",
  "genDuration",
  "ttft",
] as const
export type ChartMetric = (typeof CHART_METRICS)[number]

export type ChartMetricKind = "rate" | "tokens" | "cost" | "seconds"
export type ChartMetricDef = {
  kind: ChartMetricKind
  additive: boolean
  fractionDigits: number
}

export const METRIC_DEFS: Record<ChartMetric, ChartMetricDef> = {
  rate: { kind: "rate", additive: false, fractionDigits: 1 },
  genRate: { kind: "rate", additive: false, fractionDigits: 1 },
  total: { kind: "tokens", additive: true, fractionDigits: 0 },
  input: { kind: "tokens", additive: true, fractionDigits: 0 },
  output: { kind: "tokens", additive: true, fractionDigits: 0 },
  reasoning: { kind: "tokens", additive: true, fractionDigits: 0 },
  cacheRead: { kind: "tokens", additive: true, fractionDigits: 0 },
  cacheWrite: { kind: "tokens", additive: true, fractionDigits: 0 },
  cost: { kind: "cost", additive: true, fractionDigits: 3 },
  cumCost: { kind: "cost", additive: false, fractionDigits: 3 },
  cumTokens: { kind: "tokens", additive: false, fractionDigits: 0 },
  duration: { kind: "seconds", additive: false, fractionDigits: 1 },
  genDuration: { kind: "seconds", additive: false, fractionDigits: 1 },
  ttft: { kind: "seconds", additive: false, fractionDigits: 2 },
}

export type ChartRange = "all" | "20" | "50" | "100"
export type ChartPlotMode = "line" | "bar" | "area"
export type ChartGroupMode = "overlay" | "facet"
export type ChartXAxisMode = "sequence" | "time"
export type ChartSmoothMode = "off" | "3" | "5"

export type ChartEntry = {
  message: AssistantMessage
  sequence: number
  modelKey: string
  modelLabel: string
  output: number
  input: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
  cost: number
  cumCost: number
  cumTokens: number
  durationMs?: number
  generationMs?: number
  ttftMs?: number
  rate?: number
  genRate?: number
}

export type ModelSummary = {
  key: string
  label: string
  color: string
  count: number
  average: number | undefined
  median: number | undefined
  peak: number | undefined
  peakMessageID: string | undefined
  tokenTotal: number
  costTotal: number
  durationAverage: number | undefined
}

export type ChartSummary = {
  count: number
  sum: number | undefined
  average: number | undefined
  median: number | undefined
  p90: number | undefined
  maximum: number | undefined
  peakMessageID: string | undefined
}

export const modelKeyOf = (message: AssistantMessage) => `${message.providerID}/${message.modelID}`
const tokenCount = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0)

const finite = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined

export function buildChartEntries(
  messages: Message[],
  modelLabel: (message: AssistantMessage) => string,
): ChartEntry[] {
  let cumCost = 0
  let cumTokens = 0
  return messages
    .filter((message): message is AssistantMessage => message.role === "assistant")
    .map((message, index) => {
      const output = tokenCount(message.tokens.output)
      const input = tokenCount(message.tokens.input)
      const reasoning = tokenCount(message.tokens.reasoning)
      const cacheRead = tokenCount(message.tokens.cache.read)
      const cacheWrite = tokenCount(message.tokens.cache.write)
      const durationMs =
        typeof message.time.completed === "number" &&
        Number.isFinite(message.time.completed) &&
        Number.isFinite(message.time.created)
          ? Math.max(0, message.time.completed - message.time.created)
          : undefined
      const generationMs = finite(message.time.generationDuration)
      const ttftMs =
        finite(message.time.firstGenerated) === undefined
          ? undefined
          : Math.max(0, (message.time.firstGenerated ?? 0) - message.time.created)
      const produced = output + reasoning
      const total = input + output + reasoning + cacheRead + cacheWrite
      const cost = tokenCount(message.cost)
      cumCost += cost
      cumTokens += total

      return {
        message,
        sequence: index + 1,
        modelKey: modelKeyOf(message),
        modelLabel: modelLabel(message),
        output,
        input,
        reasoning,
        cacheRead,
        cacheWrite,
        total,
        cost,
        cumCost,
        cumTokens,
        durationMs,
        generationMs,
        ttftMs,
        rate: assistantStatistics({
          output,
          reasoning,
          created: message.time.created,
          completed: message.time.completed,
        })?.tokensPerSecond,
        genRate:
          generationMs !== undefined && generationMs > 0 && produced > 0 ? (produced / generationMs) * 1000 : undefined,
      }
    })
}

export function metricValue(entry: ChartEntry, metric: ChartMetric) {
  if (metric === "cumCost") return entry.cumCost
  if (metric === "cumTokens") return entry.cumTokens
  if (entry.message.time.completed === undefined) return
  if (metric === "rate") return entry.rate
  if (metric === "genRate") return entry.genRate
  if (metric === "duration") return entry.durationMs === undefined ? undefined : entry.durationMs / 1000
  if (metric === "genDuration") return entry.generationMs === undefined ? undefined : entry.generationMs / 1000
  if (metric === "ttft") return entry.ttftMs === undefined ? undefined : entry.ttftMs / 1000
  if (metric === "total") return entry.total
  if (metric === "input") return entry.input
  if (metric === "output") return entry.output
  if (metric === "reasoning") return entry.reasoning
  if (metric === "cacheRead") return entry.cacheRead
  if (metric === "cacheWrite") return entry.cacheWrite
  if (metric === "cost") return entry.cost
}

export function formatMetric(value: number, metric: ChartMetric, locale: string) {
  const fractionDigits = METRIC_DEFS[metric].fractionDigits
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: metric === "cost" ? 3 : 0,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatCompact(value: number, metric: ChartMetric, locale: string) {
  const abs = Math.abs(value)
  if (METRIC_DEFS[metric].kind === "tokens" && abs >= 10_000)
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value)
  return formatMetric(value, metric, locale)
}

export function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

export function applyRange(entries: ChartEntry[], range: ChartRange) {
  if (range === "all") return entries
  return entries.slice(-Number(range))
}

export function movingAverage(values: (number | undefined)[], window: number) {
  if (window <= 1) return values.map((value) => value)
  return values.map((_, index) => {
    const slice = values
      .slice(Math.max(0, index - window + 1), index + 1)
      .filter((value): value is number => value !== undefined)
    if (slice.length === 0) return undefined
    return slice.reduce((sum, value) => sum + value, 0) / slice.length
  })
}

export function summarize(values: number[], messageIDs: string[]): ChartSummary {
  const sorted = [...values].sort((a, b) => a - b)
  const count = sorted.length
  if (count === 0)
    return {
      count: 0,
      sum: undefined,
      average: undefined,
      median: undefined,
      p90: undefined,
      maximum: undefined,
      peakMessageID: undefined,
    }
  const maximum = sorted[count - 1]
  const middle = Math.floor(count / 2)
  return {
    count,
    sum: sorted.reduce((sum, value) => sum + value, 0),
    average: sorted.reduce((sum, value) => sum + value, 0) / count,
    median: count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p90: sorted[Math.max(0, Math.ceil(count * 0.9) - 1)],
    maximum,
    peakMessageID: messageIDs[values.indexOf(maximum)],
  }
}

export function summarizeMetric(points: { entry: ChartEntry; value: number }[]): ChartSummary {
  return summarize(
    points.map((point) => point.value),
    points.map((point) => point.entry.message.id),
  )
}

export function modelList(entries: ChartEntry[], colors: string[]) {
  const groups = new Map<string, { label: string; count: number; entries: ChartEntry[] }>()
  for (const entry of entries) {
    const current = groups.get(entry.modelKey)
    if (current) {
      current.count++
      current.entries.push(entry)
    } else {
      groups.set(entry.modelKey, { label: entry.modelLabel, count: 1, entries: [entry] })
    }
  }
  return [...groups].map(([key, value], index) => ({
    key,
    label: value.label,
    count: value.count,
    entries: value.entries,
    color: colors[index % colors.length],
  }))
}

export function modelSummaries(entries: ChartEntry[], colors: string[], metric: ChartMetric): ModelSummary[] {
  return modelList(entries, colors).map((model) => {
    const points = model.entries
      .map((entry) => ({ entry, value: metricValue(entry, metric) }))
      .filter((point): point is { entry: ChartEntry; value: number } => point.value !== undefined)
    const summary = summarizeMetric(points)
    return {
      key: model.key,
      label: model.label,
      color: model.color,
      count: model.count,
      average: summary.average,
      median: summary.median,
      peak: summary.maximum,
      peakMessageID: summary.peakMessageID,
      tokenTotal: model.entries.reduce((sum, entry) => sum + entry.total, 0),
      costTotal: model.entries.reduce((sum, entry) => sum + entry.cost, 0),
      durationAverage: (() => {
        const durations = model.entries
          .map((entry) => entry.durationMs)
          .filter((value): value is number => value !== undefined)
        return durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length / 1000 : undefined
      })(),
    }
  })
}

export function chartCSV(
  entries: ChartEntry[],
  metric: ChartMetric,
  metricLabel: string,
  compareMetric: ChartMetric | undefined,
  compareLabel: string | undefined,
) {
  const headers = [
    "sequence",
    "created_at",
    "model",
    metricLabel,
    ...(compareMetric && compareLabel ? [compareLabel] : []),
    "duration_s",
    "generation_s",
    "ttft_s",
    "input_tokens",
    "output_tokens",
    "reasoning_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "total_tokens",
    "cost_usd",
    "cum_cost_usd",
    "cum_tokens",
  ]
  const rows = entries.map((entry) => {
    const created = new Date(entry.message.time.created).toISOString()
    const row = [
      String(entry.sequence),
      created,
      entry.modelLabel,
      metricValue(entry, metric)?.toFixed(METRIC_DEFS[metric].fractionDigits) ?? "",
      ...(compareMetric && compareLabel
        ? [metricValue(entry, compareMetric)?.toFixed(METRIC_DEFS[compareMetric].fractionDigits) ?? ""]
        : []),
      entry.durationMs === undefined ? "" : (entry.durationMs / 1000).toFixed(1),
      entry.generationMs === undefined ? "" : (entry.generationMs / 1000).toFixed(1),
      entry.ttftMs === undefined ? "" : (entry.ttftMs / 1000).toFixed(2),
      String(entry.input),
      String(entry.output),
      String(entry.reasoning),
      String(entry.cacheRead),
      String(entry.cacheWrite),
      String(entry.total),
      entry.cost.toFixed(3),
      entry.cumCost.toFixed(3),
      String(entry.cumTokens),
    ]
    return row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(",")
  })
  return [
    headers.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(","),
    ...rows,
  ].join("\n")
}

export function downloadTextFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([`﻿${content}`], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export type HistogramBin = {
  start: number
  end: number
  count: number
  byModel: Record<string, number>
}

export type BoxStats = {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  count: number
  outliers: number[]
}

export function percentileOf(sorted: number[], p: number) {
  if (sorted.length === 0) return undefined
  if (sorted.length === 1) return sorted[0]
  const rank = (p / 100) * (sorted.length - 1)
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  if (low === high) return sorted[low]
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low)
}

export function histogram(points: { value: number; modelKey: string }[], binCount = 12): HistogramBin[] {
  if (points.length === 0) return []
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const count = Math.max(1, Math.min(binCount, values.length))
  if (max === min) {
    const byModel: Record<string, number> = {}
    for (const point of points) byModel[point.modelKey] = (byModel[point.modelKey] ?? 0) + 1
    return [{ start: min, end: max, count: points.length, byModel }]
  }
  const width = (max - min) / count
  const bins: HistogramBin[] = Array.from({ length: count }, (_, index) => ({
    start: min + index * width,
    end: index === count - 1 ? max : min + (index + 1) * width,
    count: 0,
    byModel: {},
  }))
  for (const point of points) {
    const raw = Math.floor((point.value - min) / width)
    const index = Math.max(0, Math.min(count - 1, raw))
    bins[index].count++
    bins[index].byModel[point.modelKey] = (bins[index].byModel[point.modelKey] ?? 0) + 1
  }
  return bins
}

export function boxStats(values: number[]): BoxStats | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = percentileOf(sorted, 25) ?? sorted[0]
  const median = percentileOf(sorted, 50) ?? sorted[0]
  const q3 = percentileOf(sorted, 75) ?? sorted[0]
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence)
  const outliers = sorted.filter((value) => value < lowerFence || value > upperFence)
  return {
    min: inliers[0] ?? sorted[0],
    q1,
    median,
    q3,
    max: inliers[inliers.length - 1] ?? sorted[sorted.length - 1],
    count: sorted.length,
    outliers,
  }
}
