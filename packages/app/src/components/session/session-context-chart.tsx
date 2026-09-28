import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { AssistantMessage, Message } from "@openctrlc/sdk/v2/client"
import { Button } from "@openctrlc/ui/button"
import { Dialog } from "@openctrlc/ui/dialog"
import { DropdownMenu } from "@openctrlc/ui/dropdown-menu"
import { Icon } from "@openctrlc/ui/icon"
import { useDialog } from "@openctrlc/ui/context/dialog"
import { assistantStatistics } from "@openctrlc/session-ui/message-statistics"
import { useLanguage } from "@/context/language"
import { createSessionContextFormatter } from "./session-context-format"
import "./session-context-chart.css"

const METRICS = [
  "rate",
  "total",
  "input",
  "output",
  "reasoning",
  "cacheRead",
  "cacheWrite",
  "cost",
  "duration",
] as const
type ChartMetric = (typeof METRICS)[number]
type ChartRange = "all" | "20" | "50" | "100"

const MODEL_COLORS = [
  "var(--syntax-info)",
  "var(--syntax-success)",
  "var(--syntax-warning)",
  "var(--syntax-property)",
  "var(--syntax-comment)",
]

type ChartEntry = {
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
  durationMs?: number
  rate?: number
}

type PlotPoint = ChartEntry & { x: number; value?: number }
type ChartSummary = {
  count: number
  average: number | undefined
  median: number | undefined
  maximum: number | undefined
  peakMessageID: string | undefined
}
type ChartReferenceLine = {
  value: number
  label: "average" | "median"
  color: string
  dash: string
}

const modelKey = (message: AssistantMessage) => `${message.providerID}/${message.modelID}`
const tokenCount = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0)

function buildChartEntries(messages: Message[], modelLabel: (message: AssistantMessage) => string) {
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

      return {
        message,
        sequence: index + 1,
        modelKey: modelKey(message),
        modelLabel: modelLabel(message),
        output,
        input,
        reasoning,
        cacheRead,
        cacheWrite,
        total: input + output + reasoning + cacheRead + cacheWrite,
        cost: tokenCount(message.cost),
        durationMs,
        rate: assistantStatistics({
          output,
          reasoning,
          created: message.time.created,
          completed: message.time.completed,
        })?.tokensPerSecond,
      }
    })
}

function metricValue(entry: ChartEntry, metric: ChartMetric) {
  if (entry.message.time.completed === undefined) return
  if (metric === "rate") return entry.rate
  if (metric === "duration") return entry.durationMs === undefined ? undefined : entry.durationMs / 1000
  if (metric === "total") return entry.total
  if (metric === "input") return entry.input
  if (metric === "output") return entry.output
  if (metric === "reasoning") return entry.reasoning
  if (metric === "cacheRead") return entry.cacheRead
  if (metric === "cacheWrite") return entry.cacheWrite
  if (metric === "cost") return entry.cost
}

function metricLabel(language: ReturnType<typeof useLanguage>, metric: ChartMetric) {
  return language.t(`context.rawMessages.chart.metric.${metric}` as Parameters<typeof language.t>[0])
}

function metricDescription(language: ReturnType<typeof useLanguage>, metric: ChartMetric) {
  return language.t(`context.rawMessages.chart.description.${metric}` as Parameters<typeof language.t>[0])
}

function formatMetric(value: number, metric: ChartMetric, locale: string) {
  const fractionDigits = metric === "cost" ? 3 : metric === "rate" || metric === "duration" ? 1 : 0
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: metric === "cost" ? 3 : 0,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

function modelList(entries: ChartEntry[]) {
  const groups = new Map<string, { label: string; count: number }>()
  for (const entry of entries) {
    const current = groups.get(entry.modelKey)
    if (current) current.count++
    else groups.set(entry.modelKey, { label: entry.modelLabel, count: 1 })
  }
  return [...groups].map(([key, value], index) => ({ ...value, key, color: MODEL_COLORS[index % MODEL_COLORS.length] }))
}

function MetricChartPlot(props: {
  entries: () => ChartEntry[]
  metric: ChartMetric
  range: ChartRange
  selectedModels?: string[]
  expanded?: boolean
  activeMessageID?: string
  summary?: () => ChartSummary
  onSelectMessage: (messageID: string) => void
  onActivatePoint?: (point: PlotPoint) => void
  onActivePoint?: (point: PlotPoint) => void
}) {
  const language = useLanguage()
  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))
  const allEntries = createMemo(() => props.entries())
  const rangeEntries = createMemo(() => {
    const entries = allEntries()
    if (props.range === "all") return entries
    return entries.slice(-Number(props.range))
  })
  const points = createMemo(() => {
    const entries = rangeEntries()
    const layout = props.expanded
      ? { left: 94, top: 22, width: 1080, height: 364 }
      : { left: 66, top: 18, width: 900, height: 196 }
    return entries.map((entry, index) => ({
      ...entry,
      x: layout.left + (entries.length <= 1 ? layout.width / 2 : (index / (entries.length - 1)) * layout.width),
      value: metricValue(entry, props.metric),
    }))
  })
  const visiblePoints = createMemo(() =>
    points().filter((point) => props.selectedModels === undefined || props.selectedModels.includes(point.modelKey)),
  )
  const chartPoints = createMemo(() =>
    visiblePoints().filter((point): point is PlotPoint & { value: number } => point.value !== undefined),
  )
  const maximum = createMemo(() => visiblePoints().reduce((value, point) => Math.max(value, point.value ?? 0), 0))
  const chartMaximum = createMemo(() => {
    const value = maximum() * 1.2
    if (value <= 0) return 1
    const magnitude = 10 ** Math.floor(Math.log10(value))
    return Math.ceil(value / magnitude) * magnitude
  })
  const layout = () =>
    props.expanded
      ? { left: 94, top: 22, width: 1080, height: 364, viewWidth: 1200, viewHeight: 470, axisY: 448 }
      : { left: 66, top: 18, width: 900, height: 196, viewWidth: 1000, viewHeight: 284, axisY: 274 }
  const yTicks = createMemo(() =>
    [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: chartMaximum() * ratio,
      y: layout().top + (1 - ratio) * layout().height,
    })),
  )
  const xTicks = createMemo(() => {
    const entries = rangeEntries()
    const count = Math.min(entries.length, 5)
    return Array.from({ length: count }, (_, tick) => {
      const index = entries.length <= 5 ? tick : Math.round((entries.length - 1) * (tick / (count - 1)))
      const point = points()[index]
      return { sequence: point?.sequence ?? 0, x: point?.x ?? layout().left }
    })
  })
  const models = createMemo(() => modelList(allEntries()))
  const selectedSeries = createMemo(() =>
    models().filter((model) => props.selectedModels === undefined || props.selectedModels.includes(model.key)),
  )
  const paths = createMemo(() =>
    selectedSeries().map((model) => {
      const series = visiblePoints().filter((point) => point.modelKey === model.key)
      let path = ""
      let drawing = false
      for (const point of series) {
        if (point.value === undefined) {
          drawing = false
          continue
        }
        const y = layout().top + (1 - point.value / chartMaximum()) * layout().height
        path += `${drawing ? "L" : "M"}${point.x} ${y} `
        drawing = true
      }
      return { ...model, path }
    }),
  )
  const axisNumber = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        maximumFractionDigits:
          props.metric === "cost" ? 3 : props.metric === "duration" || props.metric === "rate" ? 1 : 0,
      }),
  )
  const referenceLines = createMemo<ChartReferenceLine[]>(() => {
    if (!props.expanded || !props.summary) return []
    const summary = props.summary()
    const lines: ChartReferenceLine[] = []
    if (summary.average !== undefined)
      lines.push({ value: summary.average, label: "average", color: "var(--text-weak)", dash: "7 5" })
    if (summary.median !== undefined && summary.median !== summary.average)
      lines.push({ value: summary.median, label: "median", color: "var(--text-weaker)", dash: "2 4" })
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
    const x =
      point.x + labelWidth + 10 <= layout().left + layout().width ? point.x + 10 : point.x - labelWidth - 10
    const pointY = layout().top + (1 - point.value / chartMaximum()) * layout().height
    const y = pointY <= layout().top + 32 ? pointY + 11 : pointY - 28
    return {
      point,
      label,
      x,
      y,
      width: labelWidth,
      pointY,
      color: models().find((model) => model.key === point.modelKey)?.color ?? MODEL_COLORS[0],
    }
  })
  const tooltip = (point: PlotPoint) =>
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
  const hasData = createMemo(() => chartPoints().length > 0)
  const top = () => (props.expanded ? "0 0 1200 470" : "0 0 1000 284")

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
      <div class="overflow-x-auto overflow-y-hidden">
        <svg
          viewBox={top()}
          class="block w-full min-w-[560px]"
          style={{ height: props.expanded ? "min(48vh, 470px)" : "220px" }}
          role="group"
          aria-label={`${metricLabel(language, props.metric)}. ${metricDescription(language, props.metric)}`}
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
                <text x={layout().left - 12} y={tick.y + 4} fill="var(--text-weak)" font-size="12" text-anchor="end">
                  {axisNumber().format(tick.value)}
                </text>
              </>
            )}
          </For>
          <For each={referenceLines()}>
            {(line) => {
              const y = layout().top + (1 - line.value / chartMaximum()) * layout().height
              return (
                <line
                  x1={layout().left}
                  y1={y}
                  x2={layout().left + layout().width}
                  y2={y}
                  stroke={line.color}
                  stroke-dasharray={line.dash}
                  stroke-width="1.5"
                  pointer-events="none"
                />
              )
            }}
          </For>
          <For each={paths()}>
            {(series) => (
              <path
                d={series.path}
                fill="none"
                stroke={series.color}
                stroke-width={props.expanded ? "2.5" : "2"}
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            )}
          </For>
          <For each={chartPoints()}>
            {(point, index) => (
              <>
                <Show when={props.expanded && peakPoint()?.message.id === point.message.id}>
                  <circle
                    cx={point.x}
                    cy={layout().top + (1 - point.value / chartMaximum()) * layout().height}
                    r="9"
                    fill="var(--surface-base)"
                    stroke={models().find((model) => model.key === point.modelKey)?.color ?? MODEL_COLORS[0]}
                    stroke-width="2"
                    pointer-events="none"
                  />
                </Show>
                <Show when={props.expanded && props.activeMessageID === point.message.id}>
                  <circle
                    cx={point.x}
                    cy={layout().top + (1 - point.value / chartMaximum()) * layout().height}
                    r="9"
                    fill="none"
                    stroke="var(--text-strong)"
                    stroke-width="2"
                    pointer-events="none"
                  />
                </Show>
                <circle
                  cx={point.x}
                  cy={layout().top + (1 - point.value / chartMaximum()) * layout().height}
                  r={props.expanded ? "5" : "4.5"}
                  fill={models().find((model) => model.key === point.modelKey)?.color ?? MODEL_COLORS[0]}
                  role="button"
                  tabindex={index() === 0 ? 0 : -1}
                  data-chart-point=""
                  aria-label={tooltip(point)}
                  stroke="transparent"
                  stroke-width={props.expanded ? "12" : "8"}
                  class="cursor-pointer outline-none focus-visible:stroke-text-strong focus-visible:stroke-[3px]"
                  onMouseEnter={() => props.onActivePoint?.(point)}
                  onFocus={() => props.onActivePoint?.(point)}
                  onClick={() => activatePoint(point)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault()
                      const points = Array.from(
                        event.currentTarget.ownerSVGElement?.querySelectorAll<SVGCircleElement>("[data-chart-point]") ??
                          [],
                      )
                      const index = points.indexOf(event.currentTarget)
                      points[index + (event.key === "ArrowRight" ? 1 : -1)]?.focus()
                      return
                    }
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    activatePoint(point)
                  }}
                >
                  <title>{tooltip(point)}</title>
                </circle>
              </>
            )}
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
                <text
                  x={callout().x + 8}
                  y={callout().y + 14}
                  fill="var(--text-strong)"
                  font-size="11"
                  font-weight="600"
                >
                  {callout().label}
                </text>
              </g>
            )}
          </Show>
          <For each={xTicks()}>
            {(tick) => (
              <text
                x={tick.x}
                y={layout().top + layout().height + 25}
                fill="var(--text-weak)"
                font-size="12"
                text-anchor="middle"
              >
                {tick.sequence}
              </text>
            )}
          </For>
          <text
            x={layout().left + layout().width / 2}
            y={layout().axisY}
            fill="var(--text-weak)"
            font-size="12"
            text-anchor="middle"
          >
            {language.t("context.rawMessages.speedChart.axis")}
          </text>
        </svg>
      </div>
    </Show>
  )
}

export function SessionTokenSpeedChart(props: {
  messages: Message[]
  modelLabel: (message: AssistantMessage) => string
  onSelectMessage: (messageID: string) => void
  onExpand: () => void
}) {
  const language = useLanguage()
  const entries = createMemo(() => buildChartEntries(props.messages, props.modelLabel))
  const models = createMemo(() => modelList(entries()))

  return (
    <div class="rounded-md border border-border-base bg-surface-base p-3">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <div class="text-12-medium text-text-base">{language.t("context.rawMessages.speedChart.title")}</div>
          <div class="text-11-regular text-text-weak">{language.t("context.rawMessages.chart.inlineDescription")}</div>
        </div>
        <Button
          size="small"
          variant="ghost"
          class="gap-1.5 px-2 text-text-weak hover:text-text-base"
          onClick={props.onExpand}
        >
          <Icon name="expand" size="small" />
          <span>{language.t("context.rawMessages.chart.expand")}</span>
        </Button>
      </div>
      <MetricChartPlot entries={entries} metric="rate" range="all" onSelectMessage={props.onSelectMessage} />
      <Show when={models().length > 1}>
        <div class="flex flex-wrap gap-x-4 gap-y-2 px-2 pt-1">
          <For each={models()}>
            {(model) => (
              <div class="flex items-center gap-1.5 text-11-regular text-text-weak" title={model.label}>
                <span class="size-2 shrink-0 rounded-full" style={{ "background-color": model.color }} />
                <span>{model.label}</span>
                <span class="text-text-weaker">{model.count}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

export function DialogSessionMetricChart(props: {
  messages: Message[]
  modelLabel: (message: AssistantMessage) => string
  onSelectMessage: (messageID: string) => void
}) {
  const language = useLanguage()
  const dialog = useDialog()
  const entries = createMemo(() => buildChartEntries(props.messages, props.modelLabel))
  const models = createMemo(() => modelList(entries()))
  const [state, setState] = createStore({
    metric: "rate" as ChartMetric,
    range: "all" as ChartRange,
    selectedModels: [...new Set(entries().map((entry) => entry.modelKey))],
  })
  const knownModels = new Set(models().map((model) => model.key))
  createEffect(() => {
    const newModels = models().filter((model) => !knownModels.has(model.key))
    if (newModels.length === 0) return
    newModels.forEach((model) => knownModels.add(model.key))
    setState("selectedModels", (current) => [...current, ...newModels.map((model) => model.key)])
  })
  const [activePoint, setActivePoint] = createSignal<PlotPoint>()
  const visibleEntries = createMemo(() => {
    const count = state.range === "all" ? entries().length : Number(state.range)
    return entries().slice(-count)
  })
  const selectedPoints = createMemo(() =>
    visibleEntries()
      .filter((entry) => state.selectedModels.includes(entry.modelKey))
      .flatMap((entry) => {
        const value = metricValue(entry, state.metric)
        return value === undefined ? [] : [{ entry, value }]
      }),
  )
  const summary = createMemo(() => {
    const points = selectedPoints()
    const sorted = points.map((point) => point.value).sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    const maximum = sorted.at(-1)
    return {
      count: sorted.length,
      average: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : undefined,
      median: sorted.length
        ? sorted.length % 2
          ? sorted[middle]
          : (sorted[middle - 1] + sorted[middle]) / 2
        : undefined,
      maximum,
      peakMessageID: points.find((point) => point.value === maximum)?.entry.message.id,
    }
  })
  const selectedModelCount = () => state.selectedModels.length
  const toggleModel = (key: string, checked: boolean) => {
    setActivePoint(undefined)
    setState("selectedModels", (current) =>
      checked ? (current.includes(key) ? current : [...current, key]) : current.filter((item) => item !== key),
    )
  }
  const setMetric = (metric: ChartMetric) => {
    setState("metric", metric)
    setActivePoint(undefined)
  }
  const setRange = (value: string) => {
    if (value !== "all" && value !== "20" && value !== "50" && value !== "100") return
    setState("range", value)
    setActivePoint(undefined)
  }
  const selectedRange = () =>
    language.t(`context.rawMessages.chart.range.${state.range}` as Parameters<typeof language.t>[0])
  const selectMessage = (messageID: string) => {
    dialog.close()
    window.setTimeout(() => props.onSelectMessage(messageID), 120)
  }
  const active = createMemo(() => activePoint())
  const activeDuration = (entry: ChartEntry) =>
    entry.durationMs === undefined ? "—" : formatMetric(entry.durationMs / 1000, "duration", language.intl())
  const activeCost = (entry: ChartEntry) => formatMetric(entry.cost, "cost", language.intl())

  return (
    <Dialog
      size="x-large"
      transition
      title={language.t("context.rawMessages.chart.dialogTitle")}
      description={language.t("context.rawMessages.chart.dialogDescription")}
      class="session-context-chart-dialog h-full min-h-0 overflow-hidden"
    >
      <div class="@container flex min-h-0 flex-1 flex-col gap-4 px-5 pb-5">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div
              class="flex min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-md bg-surface-raised-base p-1"
              role="group"
              aria-label={language.t("context.rawMessages.chart.metrics")}
            >
              <For each={METRICS}>
                {(metric) => (
                  <Button
                    size="small"
                    variant="ghost"
                    aria-pressed={state.metric === metric}
                    class="shrink-0 px-2"
                    classList={{
                      "bg-surface-base text-text-strong shadow-sm": state.metric === metric,
                      "text-text-weak": state.metric !== metric,
                    }}
                    onClick={() => setMetric(metric)}
                  >
                    {metricLabel(language, metric)}
                  </Button>
                )}
              </For>
            </div>
            <div class="flex items-center gap-1">
              <DropdownMenu placement="bottom-end" gutter={4}>
                <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                  <Icon name="models" size="small" />
                  <span>
                    {language.t("context.rawMessages.chart.models")}
                    {` ${selectedModelCount()}/${models().length}`}
                  </span>
                  <Icon name="chevron-down" size="small" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content>
                    <DropdownMenu.Group>
                      <DropdownMenu.GroupLabel>
                        {language.t("context.rawMessages.chart.models")}
                      </DropdownMenu.GroupLabel>
                      <For each={models()}>
                        {(model) => (
                          <DropdownMenu.CheckboxItem
                            checked={state.selectedModels.includes(model.key)}
                            onChange={(checked) => toggleModel(model.key, checked)}
                          >
                            <span
                              class="mr-2 size-2 shrink-0 rounded-full"
                              style={{ "background-color": model.color }}
                            />
                            <DropdownMenu.ItemLabel>{`${model.label} (${model.count})`}</DropdownMenu.ItemLabel>
                            <DropdownMenu.ItemIndicator>
                              <Icon name="check-small" size="small" class="text-icon-weak" />
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.CheckboxItem>
                        )}
                      </For>
                    </DropdownMenu.Group>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                      onSelect={() =>
                        setState(
                          "selectedModels",
                          models().map((model) => model.key),
                        )
                      }
                    >
                      <DropdownMenu.ItemLabel>
                        {language.t("context.rawMessages.chart.selectAllModels")}
                      </DropdownMenu.ItemLabel>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
              <DropdownMenu placement="bottom-end" gutter={4}>
                <DropdownMenu.Trigger
                  as={Button}
                  size="small"
                  variant="secondary"
                  class="gap-1.5 px-2"
                  aria-label={`${language.t("context.rawMessages.chart.rangeLabel")}: ${selectedRange()}`}
                >
                  <Icon name="bullet-list" size="small" />
                  <span>{selectedRange()}</span>
                  <Icon name="chevron-down" size="small" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content>
                    <DropdownMenu.RadioGroup
                      value={state.range}
                      onChange={(value) => {
                        if (typeof value === "string") setRange(value)
                      }}
                    >
                      <For each={["all", "100", "50", "20"] as const}>
                        {(range) => (
                          <DropdownMenu.RadioItem value={range}>
                            <DropdownMenu.ItemLabel>
                              {language.t(
                                `context.rawMessages.chart.range.${range}` as Parameters<typeof language.t>[0],
                              )}
                            </DropdownMenu.ItemLabel>
                            <DropdownMenu.ItemIndicator>
                              <Icon name="check-small" size="small" class="text-icon-weak" />
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        )}
                      </For>
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
            </div>
          </div>
          <div class="text-11-regular text-text-weak">{metricDescription(language, state.metric)}</div>
        </div>

        <div class="grid grid-cols-2 gap-2 @[48rem]:grid-cols-4">
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.samples")}
            value={numberOf(summary().count, language.intl())}
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.average")}
            value={
              summary().average === undefined
                ? "—"
                : formatMetric(summary().average ?? 0, state.metric, language.intl())
            }
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.median")}
            value={
              summary().median === undefined ? "—" : formatMetric(summary().median ?? 0, state.metric, language.intl())
            }
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.peak")}
            value={
              summary().maximum === undefined
                ? "—"
                : formatMetric(summary().maximum ?? 0, state.metric, language.intl())
            }
          />
        </div>

        <div class="flex min-h-0 flex-1 flex-col rounded-md border border-border-base bg-surface-base p-3">
          <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div class="text-12-medium text-text-base">{metricLabel(language, state.metric)}</div>
            <div class="flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1 text-11-regular text-text-weak">
              <span>{language.t("context.rawMessages.chart.sampleCount", { count: summary().count })}</span>
              <Show when={summary().average !== undefined}>
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-0 w-4 border-t-2 border-dashed border-text-weak" aria-hidden="true" />
                  <span>
                    {language.t("context.rawMessages.chart.summary.average")} ·{" "}
                    {formatMetric(summary().average ?? 0, state.metric, language.intl())}
                  </span>
                </span>
              </Show>
              <Show when={summary().median !== undefined}>
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-0 w-4 border-t-2 border-dotted border-text-weaker" aria-hidden="true" />
                  <span>
                    {language.t("context.rawMessages.chart.summary.median")} ·{" "}
                    {formatMetric(summary().median ?? 0, state.metric, language.intl())}
                  </span>
                </span>
              </Show>
            </div>
          </div>
          <MetricChartPlot
            entries={entries}
            metric={state.metric}
            range={state.range}
            selectedModels={state.selectedModels}
            expanded
            summary={summary}
            activeMessageID={activePoint()?.message.id}
            onSelectMessage={selectMessage}
            onActivatePoint={setActivePoint}
            onActivePoint={setActivePoint}
          />
          <div class="flex flex-wrap gap-x-4 gap-y-2 px-2 pt-1">
            <For each={models()}>
              {(model) => (
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded px-1.5 py-1 text-11-regular text-text-weak hover:bg-surface-raised-base-hover"
                  classList={{ "opacity-45": !state.selectedModels.includes(model.key) }}
                  aria-pressed={state.selectedModels.includes(model.key)}
                  onClick={() => toggleModel(model.key, !state.selectedModels.includes(model.key))}
                >
                  <span class="size-2 shrink-0 rounded-full" style={{ "background-color": model.color }} />
                  <span>{model.label}</span>
                  <span class="text-text-weaker">{model.count}</span>
                </button>
              )}
            </For>
          </div>
        </div>

        <Show
          when={active()}
          fallback={
            <div class="text-11-regular text-text-weaker">{language.t("context.rawMessages.chart.pointHint")}</div>
          }
        >
          {(point) => (
            <div class="rounded-md border border-border-base bg-surface-base px-3 py-2.5">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-12-medium text-text-strong">
                    {language.t("context.rawMessages.chart.pointTitle", { index: point().sequence })}
                    {` · ${formatterTime(point().message.time.created, language.intl())}`}
                  </div>
                  <div class="truncate text-11-regular text-text-weak" title={point().modelLabel}>
                    {point().modelLabel}
                  </div>
                </div>
                <Button
                  size="small"
                  variant="secondary"
                  class="gap-1.5 px-2"
                  onClick={() => selectMessage(point().message.id)}
                >
                  <Icon name="arrow-down-to-line" size="small" />
                  <span>{language.t("context.rawMessages.chart.openMessage")}</span>
                </Button>
              </div>
              <div class="grid grid-cols-2 gap-x-5 gap-y-2 text-11-regular @[48rem]:grid-cols-4">
                <Detail
                  label={metricLabel(language, state.metric)}
                  value={formatMetric(metricValue(point(), state.metric) ?? 0, state.metric, language.intl())}
                />
                <Detail label={language.t("context.rawMessages.duration")} value={activeDuration(point())} />
                <Detail
                  label={language.t("context.stats.inputTokens")}
                  value={numberOf(point().input, language.intl())}
                />
                <Detail
                  label={language.t("context.stats.outputTokens")}
                  value={numberOf(point().output, language.intl())}
                />
                <Detail
                  label={language.t("context.stats.reasoningTokens")}
                  value={numberOf(point().reasoning, language.intl())}
                />
                <Detail
                  label={language.t("context.stats.cacheTokens")}
                  value={`${numberOf(point().cacheRead, language.intl())} / ${numberOf(point().cacheWrite, language.intl())}`}
                />
                <Detail label={language.t("context.rawMessages.costHeader")} value={activeCost(point())} />
                <Detail
                  label={language.t("context.rawMessages.chart.totalTokens")}
                  value={numberOf(point().total, language.intl())}
                />
              </div>
            </div>
          )}
        </Show>
      </div>
    </Dialog>
  )
}

function ChartStat(props: { label: string; value: string }) {
  return (
    <div class="flex min-w-0 flex-col gap-1 rounded-md border border-border-base bg-surface-base px-3 py-2">
      <div class="text-11-regular text-text-weak">{props.label}</div>
      <div class="truncate text-12-medium text-text-strong tabular-nums" title={props.value}>
        {props.value}
      </div>
    </div>
  )
}

function Detail(props: { label: string; value: string }) {
  return (
    <div class="flex min-w-0 flex-col gap-0.5">
      <div class="text-text-weak">{props.label}</div>
      <div class="truncate text-text-strong tabular-nums" title={props.value}>
        {props.value}
      </div>
    </div>
  )
}

function numberOf(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

function formatterTime(value: number, locale: string) {
  return createSessionContextFormatter(locale).time(value)
}
