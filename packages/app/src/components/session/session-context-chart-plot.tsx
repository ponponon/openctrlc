import { createMemo, createSignal, For, Show } from "solid-js"
import type { AssistantMessage } from "@openctrlc/sdk/v2/client"
import { useLanguage } from "@/context/language"
import { createSessionContextFormatter } from "./session-context-format"
import {
  applyRange,
  boxStats,
  formatCompact,
  formatMetric,
  histogram,
  metricValue,
  modelList,
  movingAverage,
  type BoxStats,
  type ChartEntry,
  type ChartGroupMode,
  type ChartMetric,
  type ChartPlotMode,
  type ChartRange,
  type ChartSmoothMode,
  type ChartSummary,
  type ChartXAxisMode,
} from "./session-context-chart-data"

export const MODEL_COLORS = [
  "var(--syntax-info)",
  "var(--syntax-success)",
  "var(--syntax-warning)",
  "var(--syntax-property)",
  "var(--syntax-comment)",
]

export type PlotPoint = ChartEntry & { x: number; value: number | undefined; compare: number | undefined }
type RankedPoint = ChartEntry & { x: number; value: number; compare: number | undefined }

type Layout = {
  left: number
  top: number
  width: number
  height: number
  viewWidth: number
  viewHeight: number
  axisY: number
}

const LAYOUTS = {
  expanded: { left: 96, top: 22, width: 1240, height: 250, viewWidth: 1400, viewHeight: 330, axisY: 310 },
  compact: { left: 66, top: 18, width: 900, height: 196, viewWidth: 1000, viewHeight: 284, axisY: 274 },
  facet: { left: 54, top: 18, width: 430, height: 168, viewWidth: 520, viewHeight: 230, axisY: 214 },
} as const

export function metricLabel(language: ReturnType<typeof useLanguage>, metric: ChartMetric) {
  return language.t(`context.rawMessages.chart.metric.${metric}` as Parameters<typeof language.t>[0])
}

export function metricDescription(language: ReturnType<typeof useLanguage>, metric: ChartMetric) {
  return language.t(`context.rawMessages.chart.description.${metric}` as Parameters<typeof language.t>[0])
}

function niceMaximum(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil((value * 1.15) / magnitude) * magnitude
}

function seriesPath(points: { x: number; value: number }[], layout: Layout, maximum: number, smooth: ChartSmoothMode) {
  const values = movingAverage(points.map((point) => point.value), smooth === "off" ? 1 : Number(smooth))
  let path = ""
  points.forEach((point, index) => {
    const value = values[index]
    if (value === undefined) return
    const y = layout.top + (1 - value / maximum) * layout.height
    path += `${index === 0 || values[index - 1] === undefined ? "M" : "L"}${point.x} ${y} `
  })
  return path.trim()
}

function areaPath(points: { x: number; value: number }[], layout: Layout, maximum: number, smooth: ChartSmoothMode) {
  const line = seriesPath(points, layout, maximum, smooth)
  if (!line) return ""
  const last = points.at(-1)
  const first = points[0]
  if (!last || !first) return line
  return `${line} L${last.x} ${layout.top + layout.height} L${first.x} ${layout.top + layout.height} Z`
}

export function MetricChartPlot(props: {
  entries: () => ChartEntry[]
  metric: ChartMetric
  compareMetric?: ChartMetric
  plotMode?: ChartPlotMode
  groupMode?: ChartGroupMode
  xAxis?: ChartXAxisMode
  smooth?: ChartSmoothMode
  range?: ChartRange
  selectedModels?: string[]
  expanded?: boolean
  facet?: boolean
  activeMessageID?: string
  summary?: () => ChartSummary
  brush?: () => { startSequence: number; endSequence: number } | undefined
  onSelectMessage: (messageID: string) => void
  onActivatePoint?: (point: PlotPoint) => void
  onActivePoint?: (point: PlotPoint) => void
  onBrush?: (range: { startSequence: number; endSequence: number } | undefined) => void
}) {
  const language = useLanguage()
  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))
  const plotMode = () => props.plotMode ?? "line"
  const xAxis = () => props.xAxis ?? "sequence"
  const smooth = () => props.smooth ?? "off"
  const layout = () => (props.facet ? LAYOUTS.facet : props.expanded ? LAYOUTS.expanded : LAYOUTS.compact)
  const allEntries = createMemo(() => props.entries())
  const rangeEntries = createMemo(() => applyRange(allEntries(), props.range ?? "all"))
  const visibleEntries = createMemo(() =>
    rangeEntries().filter((entry) => props.selectedModels === undefined || props.selectedModels.includes(entry.modelKey)),
  )
  const models = createMemo(() => modelList(allEntries(), MODEL_COLORS))
  const modelColor = createMemo(() => {
    const map = new Map<string, string>()
    for (const model of models()) map.set(model.key, model.color)
    return map
  })

  const points = createMemo(() => {
    const entries = visibleEntries()
    const box = layout()
    const timestamps = entries.map((entry) => entry.message.time.created)
    const minT = timestamps.length ? Math.min(...timestamps) : 0
    const maxT = timestamps.length ? Math.max(...timestamps) : 1
    const span = Math.max(1, maxT - minT)
    return entries.map((entry, index) => {
      const x =
        entries.length <= 1
          ? box.left + box.width / 2
          : xAxis() === "time"
            ? box.left + ((entry.message.time.created - minT) / span) * box.width
            : box.left + (index / (entries.length - 1)) * box.width
      return {
        ...entry,
        x,
        value: metricValue(entry, props.metric),
        compare: props.compareMetric ? metricValue(entry, props.compareMetric) : undefined,
      }
    })
  })

  const chartPoints = createMemo(() =>
    points().filter((point): point is RankedPoint => point.value !== undefined),
  )
  const comparePoints = createMemo(() =>
    props.compareMetric
      ? points().filter((point): point is PlotPoint & { compare: number } => point.compare !== undefined)
      : [],
  )
  const maximum = createMemo(() => chartPoints().reduce((value, point) => Math.max(value, point.value), 0))
  const chartMaximum = createMemo(() => niceMaximum(maximum()))
  const compareMaximum = createMemo(() =>
    niceMaximum(comparePoints().reduce((value, point) => Math.max(value, point.compare), 0)),
  )

  const yTicks = createMemo(() =>
    [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: chartMaximum() * ratio,
      y: layout().top + (1 - ratio) * layout().height,
    })),
  )
  const compareTicks = createMemo(() =>
    [0, 0.5, 1].map((ratio) => ({
      value: compareMaximum() * ratio,
      y: layout().top + (1 - ratio) * layout().height,
    })),
  )
  const xTicks = createMemo(() => {
    const list = points()
    const count = Math.min(list.length, props.facet ? 3 : 5)
    return Array.from({ length: count }, (_, tick) => {
      const index = list.length <= count ? tick : Math.round((list.length - 1) * (tick / Math.max(1, count - 1)))
      const point = list[index]
      return {
        x: point?.x ?? layout().left,
        label:
          xAxis() === "time"
            ? formatter().time(point?.message.time.created)
            : String(point?.sequence ?? ""),
      }
    })
  })

  const barWidth = createMemo(() => {
    const count = Math.max(1, chartPoints().length)
    return Math.min(props.facet ? 16 : 22, (layout().width / count) * 0.7)
  })

  const primarySeries = createMemo(() => {
    const series = chartPoints()
    if (props.facet) {
      const color = series[0] ? modelColor().get(series[0].modelKey) ?? MODEL_COLORS[0] : MODEL_COLORS[0]
      return [{ color, points: series }]
    }
    const byModel = new Map<string, RankedPoint[]>()
    for (const point of series) {
      const list = byModel.get(point.modelKey) ?? []
      list.push(point)
      byModel.set(point.modelKey, list)
    }
    return [...byModel.entries()].map(([key, list]) => ({
      color: modelColor().get(key) ?? MODEL_COLORS[0],
      points: list,
    }))
  })

  const referenceLines = createMemo(() => {
    if (!props.summary) return []
    const summary = props.summary()
    const lines: { value: number; color: string; dash: string; label: string }[] = []
    if (summary.average !== undefined)
      lines.push({
        value: summary.average,
        color: "var(--text-weak)",
        dash: "7 5",
        label: language.t("context.rawMessages.chart.summary.average"),
      })
    if (summary.median !== undefined && summary.median !== summary.average)
      lines.push({
        value: summary.median,
        color: "var(--text-weaker)",
        dash: "2 4",
        label: language.t("context.rawMessages.chart.summary.median"),
      })
    return lines
  })

  const peakPoint = createMemo(() => {
    const id = props.summary?.().peakMessageID
    return id ? chartPoints().find((point) => point.message.id === id) : undefined
  })

  const peakCallout = createMemo(() => {
    const point = peakPoint()
    if (!props.expanded || !point) return
    const label = language.t("context.rawMessages.chart.peakAnnotation", {
      value: formatMetric(point.value, props.metric, language.intl()),
      index: point.sequence,
    })
    const labelWidth = Math.min(layout().width - 16, Math.max(104, label.length * 7 + 16))
    const x = point.x + labelWidth + 10 <= layout().left + layout().width ? point.x + 10 : point.x - labelWidth - 10
    const pointY = layout().top + (1 - point.value / chartMaximum()) * layout().height
    const y = pointY <= layout().top + 32 ? pointY + 11 : pointY - 28
    return {
      point,
      label,
      x,
      y,
      width: labelWidth,
      pointY,
      color: modelColor().get(point.modelKey) ?? MODEL_COLORS[0],
    }
  })

  const [hover, setHover] = createSignal<{ point: PlotPoint; left: number; top: number } | undefined>()
  const [drag, setDrag] = createSignal<
    { kind: "new" | "start" | "end"; x0: number; x1: number; originX: number; moved: boolean } | undefined
  >()
  const tooltipText = (point: PlotPoint) =>
    language.t("context.rawMessages.chart.pointTooltip", {
      index: point.sequence,
      time: formatter().time(point.message.time.created),
      model: point.modelLabel,
      metric: metricLabel(language, props.metric),
      value: formatMetric(point.value ?? 0, props.metric, language.intl()),
    })
  const activatePoint = (point: PlotPoint) => {
    if (props.onActivatePoint) return props.onActivatePoint(point)
    props.onSelectMessage(point.message.id)
  }
  const toSvgX = (event: MouseEvent, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect()
    const viewWidth = svg.viewBox.baseVal.width || rect.width
    return ((event.clientX - rect.left) / Math.max(rect.width, 1)) * viewWidth
  }
  const brushWindow = createMemo(() => {
    const active = props.brush?.()
    const dragging = drag()
    const list = points()
    if (!list.length) return undefined
    if (dragging) {
      const x0 = dragging.kind === "end" ? dragging.x0 : Math.min(dragging.x0, dragging.x1)
      const x1 = dragging.kind === "start" ? dragging.x0 : Math.max(dragging.x0, dragging.x1)
      return { x0, x1 }
    }
    if (!active) return undefined
    const selected = list.filter(
      (point) => point.sequence >= active.startSequence && point.sequence <= active.endSequence,
    )
    if (!selected.length) return undefined
    return {
      x0: Math.min(...selected.map((point) => point.x)),
      x1: Math.max(...selected.map((point) => point.x)),
    }
  })
  const inBrush = (point: PlotPoint) => {
    const active = props.brush?.()
    if (!active) return true
    return point.sequence >= active.startSequence && point.sequence <= active.endSequence
  }
  const sequencesInXRange = (x0: number, x1: number) => {
    const lo = Math.min(x0, x1)
    const hi = Math.max(x0, x1)
    const selected = points()
      .filter((point) => point.x >= lo - 0.5 && point.x <= hi + 0.5)
      .map((point) => point.sequence)
    if (!selected.length) return undefined
    return {
      startSequence: Math.min(...selected),
      endSequence: Math.max(...selected),
    }
  }
  const hasData = createMemo(() => chartPoints().length > 0)
  const axisNumber = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        maximumFractionDigits: props.metric === "cost" ? 3 : props.metric === "ttft" ? 2 : props.metric === "duration" || props.metric === "genDuration" || props.metric === "rate" || props.metric === "genRate" ? 1 : 0,
      }),
  )

  return (
    <Show
      when={hasData()}
      fallback={
        <div class="flex h-52 items-center justify-center px-4 text-center text-12-regular text-text-weak">
          {props.selectedModels?.length === 0
            ? language.t("context.rawMessages.chart.noModelSelected")
            : props.expanded
              ? language.t("context.rawMessages.chart.noData")
              : language.t("context.rawMessages.speedChart.empty")}
        </div>
      }
    >
      <div class="relative shrink-0 overflow-x-auto overflow-y-hidden">
        <svg
          viewBox={`0 0 ${layout().viewWidth} ${layout().viewHeight}`}
          class="block w-full min-w-[560px]"
          preserveAspectRatio="xMidYMid meet"
          style={{ height: "auto", "min-height": props.expanded ? "260px" : undefined }}
          role="group"
          aria-label={`${metricLabel(language, props.metric)}. ${metricDescription(language, props.metric)}`}
          onMouseDown={(event) => {
            if (!props.onBrush || props.facet) return
            const target = event.target as Element | null
            if (target?.closest?.("[data-chart-point]")) return
            const svg = event.currentTarget
            const x = toSvgX(event, svg)
            const handle = target?.closest?.("[data-brush-handle]")?.getAttribute("data-brush-handle")
            const window = brushWindow()
            const kind: "new" | "start" | "end" =
              handle === "start" || handle === "end" ? handle : "new"
            if (kind === "start" && window) setDrag({ kind, x0: window.x1, x1: x, originX: x, moved: false })
            else if (kind === "end" && window) setDrag({ kind, x0: window.x0, x1: x, originX: x, moved: false })
            else setDrag({ kind, x0: x, x1: x, originX: x, moved: false })
            event.preventDefault()
          }}
          onMouseMove={(event) => {
            const current = drag()
            if (!current) return
            const x = toSvgX(event, event.currentTarget)
            setDrag({
              kind: current.kind,
              x0: current.x0,
              x1: x,
              originX: current.originX,
              moved: current.moved || Math.abs(x - current.originX) > 3,
            })
          }}
          onMouseUp={(event) => {
            const current = drag()
            setDrag(undefined)
            if (!current || !props.onBrush) return
            const x = toSvgX(event, event.currentTarget)
            const x0 = current.kind === "end" ? current.x0 : Math.min(current.x0, current.kind === "new" ? x : current.x1)
            const x1 = current.kind === "start" ? current.x0 : Math.max(current.x0, current.kind === "new" ? x : current.x1)
            if (current.kind === "new" && !current.moved) {
              props.onBrush(undefined)
              return
            }
            if (current.kind === "new" && x1 - x0 < 8) {
              props.onBrush(undefined)
              return
            }
            props.onBrush(sequencesInXRange(x0, x1))
          }}
          onMouseLeave={() => setDrag(undefined)}
        >
          <For each={yTicks()}>
            {(tick) => (
              <>
                <line
                  x1={layout().left}
                  y1={tick.y}
                  x2={layout().left + layout().width}
                  y2={tick.y}
                  stroke="var(--border-weak-base)"
                  stroke-dasharray="3 4"
                />
                <text x={layout().left - 12} y={tick.y + 4} fill="var(--text-weak)" font-size="11" text-anchor="end">
                  {formatCompact(tick.value, props.metric, language.intl())}
                </text>
              </>
            )}
          </For>
          <Show when={props.compareMetric && comparePoints().length > 0 && !props.facet}>
            <For each={compareTicks()}>
              {(tick) => (
                <text
                  x={layout().left + layout().width + 12}
                  y={tick.y + 4}
                  fill="var(--text-weaker)"
                  font-size="11"
                  text-anchor="start"
                >
                  {formatCompact(tick.value, props.compareMetric as ChartMetric, language.intl())}
                </text>
              )}
            </For>
          </Show>
          <For each={referenceLines()}>
            {(line) => {
              const y = layout().top + (1 - line.value / chartMaximum()) * layout().height
              return (
                <g pointer-events="none">
                  <line
                    x1={layout().left}
                    y1={y}
                    x2={layout().left + layout().width}
                    y2={y}
                    stroke={line.color}
                    stroke-dasharray={line.dash}
                    stroke-width="1.5"
                  />
                  <text x={layout().left + layout().width - 6} y={y - 6} fill={line.color} font-size="10" text-anchor="end">
                    {line.label}
                  </text>
                </g>
              )
            }}
          </For>

          <Show when={props.compareMetric && plotMode() !== "bar"}>
            <For each={comparePoints()}>
              {(point) => {
                const height = (point.compare / compareMaximum()) * layout().height
                return (
                  <rect
                    x={point.x - barWidth() / 2}
                    y={layout().top + layout().height - height}
                    width={barWidth()}
                    height={height}
                    rx="2"
                    fill="var(--syntax-comment)"
                    opacity="0.28"
                    pointer-events="none"
                  />
                )
              }}
            </For>
          </Show>

          <Show when={plotMode() === "bar"}>
            <For each={chartPoints()}>
              {(point) => {
                const height = (point.value / chartMaximum()) * layout().height
                return (
                  <rect
                    x={point.x - barWidth() / 2}
                    y={layout().top + layout().height - height}
                    width={barWidth()}
                    height={Math.max(height, 1)}
                    rx="2"
                    fill={modelColor().get(point.modelKey) ?? MODEL_COLORS[0]}
                    opacity={
                      !inBrush(point) ? 0.22 : props.activeMessageID && props.activeMessageID !== point.message.id ? 0.45 : 0.9
                    }
                    data-chart-bar=""
                  />
                )
              }}
            </For>
          </Show>

          <Show when={plotMode() !== "bar"}>
            <For each={primarySeries()}>
              {(series) => {
                const filtered = series.points
                return (
                  <>
                    <Show when={plotMode() === "area"}>
                      <path
                        d={areaPath(filtered, layout(), chartMaximum(), smooth())}
                        fill={series.color}
                        opacity="0.16"
                        stroke="none"
                      />
                    </Show>
                    <path
                      d={seriesPath(filtered, layout(), chartMaximum(), smooth())}
                      fill="none"
                      stroke={series.color}
                      stroke-width={props.expanded || props.facet ? "2.5" : "2"}
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </>
                )
              }}
            </For>
          </Show>

          <Show when={props.onBrush && !props.facet ? brushWindow() : undefined}>
            {(window) => (
              <>
                <rect
                  x={window().x0}
                  y={layout().top}
                  width={Math.max(2, window().x1 - window().x0)}
                  height={layout().height}
                  fill="var(--syntax-info)"
                  opacity="0.12"
                  stroke="var(--syntax-info)"
                  stroke-dasharray="4 3"
                  pointer-events="none"
                />
                <rect
                  data-brush-handle="start"
                  x={window().x0 - 4}
                  y={layout().top}
                  width="8"
                  height={layout().height}
                  fill="var(--syntax-info)"
                  opacity="0.85"
                  class="cursor-ew-resize"
                />
                <rect
                  data-brush-handle="end"
                  x={window().x1 - 4}
                  y={layout().top}
                  width="8"
                  height={layout().height}
                  fill="var(--syntax-info)"
                  opacity="0.85"
                  class="cursor-ew-resize"
                />
              </>
            )}
          </Show>

          <Show when={props.compareMetric && plotMode() === "bar" && comparePoints().length > 0 && !props.facet}>
            <path
              d={seriesPath(
                comparePoints().map((point) => ({ x: point.x, value: point.compare })),
                layout(),
                compareMaximum(),
                "off",
              )}
              fill="none"
              stroke="var(--syntax-comment)"
              stroke-width="2"
              stroke-dasharray="5 4"
              opacity="0.9"
            />
          </Show>

          <For each={chartPoints()}>
            {(point, index) => {
              const y = layout().top + (1 - point.value / chartMaximum()) * layout().height
              return (
                <>
                  <Show when={props.expanded && peakPoint()?.message.id === point.message.id}>
                    <circle
                      cx={point.x}
                      cy={y}
                      r="9"
                      fill="var(--surface-base)"
                      stroke={modelColor().get(point.modelKey) ?? MODEL_COLORS[0]}
                      stroke-width="2"
                      pointer-events="none"
                    />
                  </Show>
                  <Show when={props.activeMessageID === point.message.id}>
                    <circle
                      cx={point.x}
                      cy={y}
                      r="9"
                      fill="none"
                      stroke="var(--text-strong)"
                      stroke-width="2"
                      pointer-events="none"
                    />
                  </Show>
                  <Show when={plotMode() !== "bar" || props.expanded}>
                    <circle
                      cx={point.x}
                      cy={y}
                      r={props.expanded ? "5" : "4.5"}
                      fill={modelColor().get(point.modelKey) ?? MODEL_COLORS[0]}
                      opacity={inBrush(point) ? 1 : 0.28}
                      role="button"
                      tabindex={index() === 0 ? 0 : -1}
                      data-chart-point=""
                      aria-label={tooltipText(point)}
                      stroke="transparent"
                      stroke-width={props.expanded ? "12" : "8"}
                      class="cursor-pointer outline-none focus-visible:stroke-text-strong focus-visible:stroke-[3px]"
                      onMouseEnter={(event) => {
                        const host = event.currentTarget.ownerSVGElement?.parentElement
                        const rect = host?.getBoundingClientRect()
                        props.onActivePoint?.(point)
                        if (!rect) return
                        setHover({
                          point,
                          left: event.clientX - rect.left + 12,
                          top: event.clientY - rect.top - 12,
                        })
                      }}
                      onMouseLeave={() => setHover(undefined)}
                      onFocus={() => props.onActivePoint?.(point)}
                      onClick={() => activatePoint(point)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                          event.preventDefault()
                          const list = Array.from(
                            event.currentTarget.ownerSVGElement?.querySelectorAll<SVGCircleElement>("[data-chart-point]") ?? [],
                          )
                          const current = list.indexOf(event.currentTarget)
                          list[current + (event.key === "ArrowRight" ? 1 : -1)]?.focus()
                          return
                        }
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        activatePoint(point)
                      }}
                    >
                      <title>{tooltipText(point)}</title>
                    </circle>
                  </Show>
                </>
              )
            }}
          </For>

          <Show when={peakCallout()}>
            {(callout) => (
              <g pointer-events="none" role="img" aria-label={callout().label}>
                <line
                  x1={callout().point.x}
                  y1={callout().pointY}
                  x2={callout().x < callout().point.x ? callout().x + callout().width : callout().x}
                  y2={callout().y + 10}
                  stroke={callout().color}
                  stroke-width="1"
                  opacity="0.75"
                />
                <rect
                  x={callout().x}
                  y={callout().y}
                  width={callout().width}
                  height="20"
                  rx="5"
                  fill="var(--surface-base)"
                  stroke="var(--border-weak-base)"
                />
                <text x={callout().x + 8} y={callout().y + 14} fill="var(--text-strong)" font-size="11" font-weight="600">
                  {callout().label}
                </text>
              </g>
            )}
          </Show>

          <For each={xTicks()}>
            {(tick) => (
              <text
                x={tick.x}
                y={layout().top + layout().height + 22}
                fill="var(--text-weak)"
                font-size="11"
                text-anchor="middle"
              >
                {tick.label}
              </text>
            )}
          </For>
          <text
            x={layout().left + layout().width / 2}
            y={layout().axisY}
            fill="var(--text-weak)"
            font-size="11"
            text-anchor="middle"
          >
            {language.t(
              xAxis() === "time"
                ? "context.rawMessages.chart.xAxis.time"
                : "context.rawMessages.speedChart.axis",
            )}
          </text>
        </svg>
        <Show when={hover()}>
          {(tip) => {
            const point = tip().point
            return (
              <div
                class="pointer-events-none absolute z-10 min-w-[180px] rounded-md border border-border-base bg-surface-raised-base px-2.5 py-2 shadow-md"
                style={{
                  left: `${Math.max(8, tip().left)}px`,
                  top: `${Math.max(8, tip().top)}px`,
                }}
              >
                <div class="text-11-medium text-text-strong">
                  {language.t("context.rawMessages.chart.pointTitle", { index: point.sequence })}
                  {" · "}
                  {formatMetric(point.value ?? 0, props.metric, language.intl())}
                </div>
                <div class="mt-0.5 truncate text-11-regular text-text-weak" title={point.modelLabel}>
                  {point.modelLabel}
                </div>
                <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-11-regular text-text-weak">
                  <span>{formatter().time(point.message.time.created)}</span>
                  <span>
                    {language.t("context.rawMessages.duration")}:{" "}
                    {point.durationMs === undefined ? "—" : formatMetric(point.durationMs / 1000, "duration", language.intl())}
                  </span>
                  <span>
                    {language.t("context.rawMessages.chart.totalTokens")}: {formatMetric(point.total, "total", language.intl())}
                  </span>
                  <span>
                    {language.t("context.rawMessages.costHeader")}: {formatMetric(point.cost, "cost", language.intl())}
                  </span>
                </div>
              </div>
            )
          }}
        </Show>
      </div>
    </Show>
  )
}

export function HistogramPlot(props: {
  points: () => { value: number; modelKey: string; modelLabel: string }[]
  metric: ChartMetric
  colors: () => { key: string; color: string; label: string }[]
}) {
  const language = useLanguage()
  const bins = createMemo(() => histogram(props.points(), 12))
  const maxCount = createMemo(() => bins().reduce((value, bin) => Math.max(value, bin.count), 0) || 1)
  const colorOf = createMemo(() => {
    const map = new Map<string, string>()
    for (const item of props.colors()) map.set(item.key, item.color)
    return map
  })
  const layout = { left: 56, top: 16, width: 520, height: 180, viewWidth: 620, viewHeight: 230, axisY: 216 }

  return (
    <Show
      when={bins().length > 0}
      fallback={
        <div class="flex h-48 items-center justify-center text-12-regular text-text-weak">
          {language.t("context.rawMessages.chart.noData")}
        </div>
      }
    >
      <svg viewBox={`0 0 ${layout.viewWidth} ${layout.viewHeight}`} class="block w-full" style={{ height: "auto" }}>
        <For each={[0, 0.5, 1]}>
          {(ratio) => {
            const y = layout.top + (1 - ratio) * layout.height
            return (
              <>
                <line
                  x1={layout.left}
                  y1={y}
                  x2={layout.left + layout.width}
                  y2={y}
                  stroke="var(--border-weak-base)"
                  stroke-dasharray="3 4"
                />
                <text x={layout.left - 10} y={y + 4} fill="var(--text-weak)" font-size="11" text-anchor="end">
                  {Math.round(maxCount() * ratio)}
                </text>
              </>
            )
          }}
        </For>
        <For each={bins()}>
          {(bin, index) => {
            const slot = layout.width / Math.max(1, bins().length)
            const x = layout.left + index() * slot + 2
            const width = Math.max(2, slot - 4)
            const segments = Object.entries(bin.byModel)
            return (
              <g>
                <Show
                  when={segments.length > 0}
                  fallback={
                    <rect
                      x={x}
                      y={layout.top + layout.height}
                      width={width}
                      height={0}
                      fill="var(--syntax-comment)"
                    />
                  }
                >
                  <For each={segments}>
                    {([key, count], segmentIndex) => {
                      const height = (count / maxCount()) * layout.height
                      const stackedFrom = segments
                        .slice(0, segmentIndex())
                        .reduce((sum, [, value]) => sum + value, 0)
                      const yOffset = (stackedFrom / maxCount()) * layout.height
                      return (
                        <rect
                          x={x}
                          y={layout.top + layout.height - yOffset - height}
                          width={width}
                          height={Math.max(height, 1)}
                          rx="2"
                          fill={colorOf().get(key) ?? MODEL_COLORS[0]}
                          opacity="0.88"
                        >
                          <title>{`${bin.start.toFixed(1)}–${bin.end.toFixed(1)}: ${count}`}</title>
                        </rect>
                      )
                    }}
                  </For>
                </Show>
                <Show when={index() === 0 || index() === bins().length - 1 || bins().length <= 4}>
                  <text
                    x={x + width / 2}
                    y={layout.top + layout.height + 18}
                    fill="var(--text-weak)"
                    font-size="10"
                    text-anchor="middle"
                  >
                    {formatCompact(index() === 0 ? bin.start : bin.end, props.metric, language.intl())}
                  </text>
                </Show>
              </g>
            )
          }}
        </For>
        <text
          x={layout.left + layout.width / 2}
          y={layout.axisY}
          fill="var(--text-weak)"
          font-size="11"
          text-anchor="middle"
        >
          {metricLabel(language, props.metric)}
        </text>
      </svg>
    </Show>
  )
}

export function BoxPlot(props: {
  models: () => { key: string; label: string; color: string; values: number[] }[]
  metric: ChartMetric
}) {
  const language = useLanguage()
  const rows = createMemo(() =>
    props.models()
      .map((model) => ({ ...model, stats: boxStats(model.values) }))
      .filter((row): row is typeof row & { stats: BoxStats } => row.stats !== undefined),
  )
  const maxValue = createMemo(() => rows().reduce((value, row) => Math.max(value, row.stats.max, ...row.stats.outliers), 0) || 1)

  return (
    <Show
      when={rows().length > 0}
      fallback={
        <div class="flex h-48 items-center justify-center text-12-regular text-text-weak">
          {language.t("context.rawMessages.chart.noData")}
        </div>
      }
    >
      <div class="flex flex-col gap-2">
        <For each={rows()}>
          {(row) => {
            const scale = (value: number) => Math.max(0, Math.min(1, value / maxValue())) * 100
            return (
              <div class="flex items-center gap-2">
                <div class="w-28 truncate text-11-regular text-text-weak" title={row.label}>
                  {row.label}
                </div>
                <div class="relative h-8 flex-1">
                  <div
                    class="absolute top-1/2 h-0.5 -translate-y-1/2 bg-border-weak-base"
                    style={{ left: `${scale(row.stats.min)}%`, width: `${Math.max(scale(row.stats.max) - scale(row.stats.min), 0.5)}%` }}
                  />
                  <div
                    class="absolute top-1/2 h-4 -translate-y-1/2 rounded border"
                    style={{
                      left: `${scale(row.stats.q1)}%`,
                      width: `${Math.max(scale(row.stats.q3) - scale(row.stats.q1), 0.8)}%`,
                      "background-color": row.color,
                      opacity: "0.35",
                      "border-color": row.color,
                    }}
                  />
                  <div
                    class="absolute top-1/2 h-5 w-0.5 -translate-y-1/2"
                    style={{ left: `${scale(row.stats.median)}%`, "background-color": row.color }}
                  />
                  <For each={row.stats.outliers}>
                    {(outlier) => (
                      <span
                        class="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full"
                        style={{ left: `calc(${scale(outlier)}% - 3px)`, "background-color": row.color, opacity: "0.7" }}
                        title={formatMetric(outlier, props.metric, language.intl())}
                      />
                    )}
                  </For>
                </div>
                <div class="w-16 text-right text-11-regular tabular-nums text-text-weak">
                  {formatCompact(row.stats.median, props.metric, language.intl())}
                </div>
              </div>
            )
          }}
        </For>
        <div class="flex justify-between px-30 text-10-regular text-text-weaker">
          <span>
            {language.t("context.rawMessages.chart.box.min")} · {language.t("context.rawMessages.chart.box.q1")} ·{" "}
            {language.t("context.rawMessages.chart.summary.median")} · {language.t("context.rawMessages.chart.box.q3")} ·{" "}
            {language.t("context.rawMessages.chart.box.max")}
          </span>
          <span>{language.t("context.rawMessages.chart.box.medianLabel")}</span>
        </div>
      </div>
    </Show>
  )
}
