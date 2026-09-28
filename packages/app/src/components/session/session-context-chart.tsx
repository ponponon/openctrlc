import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { AssistantMessage, Message } from "@openctrlc/sdk/v2/client"
import { Button } from "@openctrlc/ui/button"
import { Dialog } from "@openctrlc/ui/dialog"
import { DropdownMenu } from "@openctrlc/ui/dropdown-menu"
import { Icon } from "@openctrlc/ui/icon"
import { useDialog } from "@openctrlc/ui/context/dialog"
import { useLanguage } from "@/context/language"
import { createSessionContextFormatter } from "./session-context-format"
import {
  applyRange,
  buildChartEntries,
  chartCSV,
  downloadTextFile,
  formatCount,
  formatMetric,
  METRIC_DEFS,
  metricValue,
  modelList,
  modelSummaries,
  summarizeMetric,
  type ChartEntry,
  type ChartGroupMode,
  type ChartMetric,
  type ChartPlotMode,
  type ChartRange,
  type ChartSmoothMode,
  type ChartXAxisMode,
  CHART_METRICS,
} from "./session-context-chart-data"
import {
  MetricChartPlot,
  metricDescription,
  metricLabel,
  MODEL_COLORS,
  type PlotPoint,
} from "./session-context-chart-plot"
import "./session-context-chart.css"

export type { PlotPoint }

const PLOT_MODES = ["line", "bar", "area"] as const
const GROUP_MODES = ["overlay", "facet"] as const
const X_AXIS_MODES = ["sequence", "time"] as const
const SMOOTH_MODES = ["off", "3", "5"] as const

type TableSortKey = "sequence" | "time" | "metric" | "duration" | "total" | "cost"

export function SessionTokenSpeedChart(props: {
  messages: Message[]
  modelLabel: (message: AssistantMessage) => string
  onSelectMessage: (messageID: string) => void
  onExpand: () => void
}) {
  const language = useLanguage()
  const entries = createMemo(() => buildChartEntries(props.messages, props.modelLabel))
  const models = createMemo(() => modelList(entries(), MODEL_COLORS))
  const summary = createMemo(() =>
    summarizeMetric(
      entries()
        .map((entry) => ({ entry, value: metricValue(entry, "rate") }))
        .filter((point): point is { entry: ChartEntry; value: number } => point.value !== undefined),
    ),
  )

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
      <div class="rounded-sm">
        <MetricChartPlot
          entries={entries}
          metric="rate"
          range="all"
          summary={summary}
          onSelectMessage={props.onSelectMessage}
        />
      </div>
      <Show when={models().length > 0}>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pt-1">
          <For each={models()}>
            {(model) => (
              <div class="flex items-center gap-1.5 text-11-regular text-text-weak" title={model.label}>
                <span class="size-2 shrink-0 rounded-full" style={{ "background-color": model.color }} />
                <span>{model.label}</span>
                <span class="text-text-weaker">{model.count}</span>
              </div>
            )}
          </For>
          <Show when={summary().average !== undefined}>
            <div class="flex items-center gap-1.5 text-11-regular text-text-weak">
              <span class="h-0 w-4 border-t-2 border-dashed border-text-weak" aria-hidden="true" />
              <span>
                {language.t("context.rawMessages.chart.summary.average")} ·{" "}
                {formatMetric(summary().average ?? 0, "rate", language.intl())}
              </span>
            </div>
          </Show>
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
  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))
  const entries = createMemo(() => buildChartEntries(props.messages, props.modelLabel))
  const models = createMemo(() => modelList(entries(), MODEL_COLORS))
  const [state, setState] = createStore({
    metric: "rate" as ChartMetric,
    compareMetric: undefined as ChartMetric | undefined,
    plotMode: "line" as ChartPlotMode,
    groupMode: "overlay" as ChartGroupMode,
    xAxis: "sequence" as ChartXAxisMode,
    smooth: "off" as ChartSmoothMode,
    range: "all" as ChartRange,
    selectedModels: [...new Set(entries().map((entry) => entry.modelKey))],
    bottomTab: "detail" as "detail" | "models" | "table",
    tableSort: "sequence" as TableSortKey,
    tableDesc: false,
    copyState: "idle" as "idle" | "done",
  })
  const knownModels = new Set(models().map((model) => model.key))
  createEffect(() => {
    const fresh = models().filter((model) => !knownModels.has(model.key))
    if (fresh.length === 0) return
    fresh.forEach((model) => knownModels.add(model.key))
    setState("selectedModels", (current) => [...current, ...fresh.map((model) => model.key)])
  })
  const [activePoint, setActivePoint] = createSignal<PlotPoint>()
  const visibleEntries = createMemo(() =>
    applyRange(entries(), state.range).filter((entry) => state.selectedModels.includes(entry.modelKey)),
  )
  const selectedPoints = createMemo(() =>
    visibleEntries()
      .map((entry) => ({ entry, value: metricValue(entry, state.metric) }))
      .filter((point): point is { entry: ChartEntry; value: number } => point.value !== undefined),
  )
  const summary = createMemo(() => summarizeMetric(selectedPoints()))
  const compareSummary = createMemo(() =>
    state.compareMetric === undefined
      ? undefined
      : summarizeMetric(
          visibleEntries()
            .map((entry) => ({ entry, value: metricValue(entry, state.compareMetric as ChartMetric) }))
            .filter((point): point is { entry: ChartEntry; value: number } => point.value !== undefined),
        ),
  )
  const modelStats = createMemo(() => modelSummaries(visibleEntries(), MODEL_COLORS, state.metric))
  const facetModels = createMemo(() =>
    modelStats().filter((model) => state.selectedModels.includes(model.key)),
  )

  const setMetric = (metric: ChartMetric) => {
    setState("metric", metric)
    setActivePoint(undefined)
  }
  const setCompareMetric = (metric: ChartMetric | undefined) => {
    if (metric === state.metric) return
    setState("compareMetric", metric)
    setActivePoint(undefined)
  }
  const toggleModel = (key: string, checked: boolean) => {
    setActivePoint(undefined)
    setState("selectedModels", (current) =>
      checked ? (current.includes(key) ? current : [...current, key]) : current.filter((item) => item !== key),
    )
  }
  const selectedRange = () =>
    language.t(`context.rawMessages.chart.range.${state.range}` as Parameters<typeof language.t>[0])
  const selectMessage = (messageID: string) => {
    dialog.close()
    window.setTimeout(() => props.onSelectMessage(messageID), 120)
  }
  const activeDuration = (entry: ChartEntry) =>
    entry.durationMs === undefined ? "—" : formatMetric(entry.durationMs / 1000, "duration", language.intl())
  const activeCost = (entry: ChartEntry) => formatMetric(entry.cost, "cost", language.intl())
  const metricText = (value: number | undefined, metric: ChartMetric) =>
    value === undefined ? "—" : formatMetric(value, metric, language.intl())
  const secondsText = (ms: number | undefined, metric: ChartMetric) =>
    ms === undefined ? "—" : formatMetric(ms / 1000, metric, language.intl())

  const tableRows = createMemo(() => {
    const rows = visibleEntries().map((entry) => ({
      entry,
      metric: metricValue(entry, state.metric),
      duration: entry.durationMs === undefined ? undefined : entry.durationMs / 1000,
    }))
    const key = state.tableSort
    const direction = state.tableDesc ? -1 : 1
    return [...rows].sort((a, b) => {
      const pick = (row: (typeof rows)[number]) => {
        if (key === "sequence") return row.entry.sequence
        if (key === "time") return row.entry.message.time.created
        if (key === "duration") return row.duration ?? -1
        if (key === "total") return row.entry.total
        if (key === "cost") return row.entry.cost
        return row.metric ?? -1
      }
      return (pick(a) - pick(b)) * direction
    })
  })

  const sortTable = (key: TableSortKey) => {
    if (state.tableSort === key) {
      setState("tableDesc", !state.tableDesc)
      return
    }
    setState("tableSort", key)
    setState("tableDesc", key === "time" || key === "metric" || key === "cost" || key === "duration")
  }

  const exportCSV = (scope: "visible" | "all") => {
    const source = scope === "visible" ? visibleEntries() : entries()
    const csv = chartCSV(
      source,
      state.metric,
      metricLabel(language, state.metric),
      state.compareMetric,
      state.compareMetric ? metricLabel(language, state.compareMetric) : undefined,
    )
    downloadTextFile(`session-chart-${state.metric}.csv`, csv)
  }

  const summaryText = () => {
    const lines = [
      language.t("context.rawMessages.chart.dialogTitle"),
      `${language.t("context.rawMessages.chart.metrics")}: ${metricLabel(language, state.metric)}`,
      `${language.t("context.rawMessages.chart.rangeLabel")}: ${selectedRange()}`,
      `${language.t("context.rawMessages.chart.summary.samples")}: ${summary().count}`,
      `${language.t("context.rawMessages.chart.summary.average")}: ${metricText(summary().average, state.metric)}`,
      `${language.t("context.rawMessages.chart.summary.median")}: ${metricText(summary().median, state.metric)}`,
      `${language.t("context.rawMessages.chart.summary.p90")}: ${metricText(summary().p90, state.metric)}`,
      `${language.t("context.rawMessages.chart.summary.peak")}: ${metricText(summary().maximum, state.metric)}`,
    ]
    if (METRIC_DEFS[state.metric].additive && summary().sum !== undefined)
      lines.push(`${language.t("context.rawMessages.chart.summary.sum")}: ${metricText(summary().sum, state.metric)}`)
    for (const model of modelStats()) {
      lines.push(
        `${model.label}: ${language.t("context.rawMessages.chart.summary.average")} ${
          model.average === undefined ? "—" : formatMetric(model.average, state.metric, language.intl())
        } · ${model.count}`,
      )
    }
    return lines.join("\n")
  }

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText())
      setState("copyState", "done")
      window.setTimeout(() => setState("copyState", "idle"), 1600)
    } catch {
      setState("copyState", "idle")
    }
  }

  return (
    <Dialog
      size="x-large"
      transition
      title={language.t("context.rawMessages.chart.dialogTitle")}
      description={language.t("context.rawMessages.chart.dialogDescription")}
      class="session-context-chart-dialog h-full min-h-0 overflow-hidden"
    >
      <div class="@container flex h-full min-h-0 flex-col gap-3 px-5 pb-5">
        <div class="flex flex-none flex-col gap-2.5">
          <div
            class="flex min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-md bg-surface-raised-base p-1"
            role="group"
            aria-label={language.t("context.rawMessages.chart.metrics")}
          >
            <For each={CHART_METRICS}>
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

          <div class="flex flex-wrap items-center gap-1.5">
            <DropdownMenu placement="bottom-start" gutter={4}>
              <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                <Icon name="dash" size="small" />
                <span>
                  {language.t("context.rawMessages.chart.compareLabel")}
                  {`: ${
                    state.compareMetric
                      ? metricLabel(language, state.compareMetric)
                      : language.t("context.rawMessages.chart.compare.none")
                  }`}
                </span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.RadioGroup
                    value={state.compareMetric ?? "none"}
                    onChange={(value) => {
                      if (typeof value !== "string") return
                      setCompareMetric(value === "none" ? undefined : (value as ChartMetric))
                    }}
                  >
                    <DropdownMenu.RadioItem value="none">
                      <DropdownMenu.ItemLabel>
                        {language.t("context.rawMessages.chart.compare.none")}
                      </DropdownMenu.ItemLabel>
                      <DropdownMenu.ItemIndicator>
                        <Icon name="check-small" size="small" class="text-icon-weak" />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                    <For each={CHART_METRICS}>
                      {(metric) => (
                        <DropdownMenu.RadioItem value={metric} disabled={metric === state.metric}>
                          <DropdownMenu.ItemLabel>{metricLabel(language, metric)}</DropdownMenu.ItemLabel>
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

            <DropdownMenu placement="bottom-start" gutter={4}>
              <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                <Icon name="bullet-list" size="small" />
                <span>
                  {language.t(`context.rawMessages.chart.plot.${state.plotMode}` as Parameters<typeof language.t>[0])}
                </span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.RadioGroup
                    value={state.plotMode}
                    onChange={(value) => {
                      if (typeof value === "string") setState("plotMode", value as ChartPlotMode)
                    }}
                  >
                    <For each={PLOT_MODES}>
                      {(mode) => (
                        <DropdownMenu.RadioItem value={mode}>
                          <DropdownMenu.ItemLabel>
                            {language.t(`context.rawMessages.chart.plot.${mode}` as Parameters<typeof language.t>[0])}
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

            <DropdownMenu placement="bottom-start" gutter={4}>
              <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                <Icon name="layout-bottom" size="small" />
                <span>
                  {language.t(`context.rawMessages.chart.group.${state.groupMode}` as Parameters<typeof language.t>[0])}
                </span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.RadioGroup
                    value={state.groupMode}
                    onChange={(value) => {
                      if (typeof value === "string") setState("groupMode", value as ChartGroupMode)
                    }}
                  >
                    <For each={GROUP_MODES}>
                      {(mode) => (
                        <DropdownMenu.RadioItem value={mode}>
                          <DropdownMenu.ItemLabel>
                            {language.t(`context.rawMessages.chart.group.${mode}` as Parameters<typeof language.t>[0])}
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

            <DropdownMenu placement="bottom-start" gutter={4}>
              <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                <Icon name="bullet-list" size="small" />
                <span>{selectedRange()}</span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.RadioGroup
                    value={state.range}
                    onChange={(value) => {
                      if (typeof value === "string") {
                        setState("range", value as ChartRange)
                        setActivePoint(undefined)
                      }
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

            <DropdownMenu placement="bottom-start" gutter={4}>
              <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                <Icon name="align-right" size="small" />
                <span>
                  {language.t(`context.rawMessages.chart.xAxis.${state.xAxis}` as Parameters<typeof language.t>[0])}
                </span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.RadioGroup
                    value={state.xAxis}
                    onChange={(value) => {
                      if (typeof value === "string") setState("xAxis", value as ChartXAxisMode)
                    }}
                  >
                    <For each={X_AXIS_MODES}>
                      {(mode) => (
                        <DropdownMenu.RadioItem value={mode}>
                          <DropdownMenu.ItemLabel>
                            {language.t(`context.rawMessages.chart.xAxis.${mode}` as Parameters<typeof language.t>[0])}
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

            <DropdownMenu placement="bottom-start" gutter={4}>
              <DropdownMenu.Trigger
                as={Button}
                size="small"
                variant="secondary"
                class="gap-1.5 px-2"
                disabled={state.plotMode === "bar"}
              >
                <Icon name="sliders" size="small" />
                <span>
                  {language.t(`context.rawMessages.chart.smooth.${state.smooth}` as Parameters<typeof language.t>[0])}
                </span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.RadioGroup
                    value={state.smooth}
                    onChange={(value) => {
                      if (typeof value === "string") setState("smooth", value as ChartSmoothMode)
                    }}
                  >
                    <For each={SMOOTH_MODES}>
                      {(mode) => (
                        <DropdownMenu.RadioItem value={mode}>
                          <DropdownMenu.ItemLabel>
                            {language.t(`context.rawMessages.chart.smooth.${mode}` as Parameters<typeof language.t>[0])}
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

            <DropdownMenu placement="bottom-end" gutter={4}>
              <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                <Icon name="models" size="small" />
                <span>
                  {language.t("context.rawMessages.chart.models")}
                  {` ${state.selectedModels.length}/${models().length}`}
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
                          <span class="mr-2 size-2 shrink-0 rounded-full" style={{ "background-color": model.color }} />
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
              <DropdownMenu.Trigger as={Button} size="small" variant="secondary" class="gap-1.5 px-2">
                <Icon name="download" size="small" />
                <span>{language.t("context.rawMessages.chart.export")}</span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.Item onSelect={() => exportCSV("visible")}>
                    <DropdownMenu.ItemLabel>
                      {language.t("context.rawMessages.chart.exportCsv")}
                    </DropdownMenu.ItemLabel>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => exportCSV("all")}>
                    <DropdownMenu.ItemLabel>
                      {language.t("context.rawMessages.chart.exportCsvAll")}
                    </DropdownMenu.ItemLabel>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => void copySummary()}>
                    <DropdownMenu.ItemLabel>
                      {state.copyState === "done"
                        ? language.t("context.rawMessages.chart.copySummaryDone")
                        : language.t("context.rawMessages.chart.copySummary")}
                    </DropdownMenu.ItemLabel>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          </div>

          <div class="text-11-regular text-text-weak">
            {metricDescription(language, state.metric)}
            <Show when={state.compareMetric}>
              {" · "}
              {language.t("context.rawMessages.chart.compareHint", {
                metric: metricLabel(language, state.compareMetric as ChartMetric),
              })}
            </Show>
          </div>
        </div>

        <div class="grid flex-none grid-cols-2 gap-2 @[48rem]:grid-cols-6">
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.samples")}
            value={formatCount(summary().count, language.intl())}
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.average")}
            value={metricText(summary().average, state.metric)}
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.median")}
            value={metricText(summary().median, state.metric)}
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.p90")}
            value={metricText(summary().p90, state.metric)}
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.peak")}
            value={metricText(summary().maximum, state.metric)}
          />
          <ChartStat
            label={language.t("context.rawMessages.chart.summary.sum")}
            value={METRIC_DEFS[state.metric].additive ? metricText(summary().sum, state.metric) : "—"}
          />
        </div>

        <div class="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-md border border-border-base bg-surface-base p-3">
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

          <div class="min-h-0 flex-1 overflow-auto">
            <Show
              when={state.groupMode === "overlay"}
              fallback={
                <div class="grid gap-3 @[64rem]:grid-cols-2">
                  <For each={facetModels()}>
                    {(model) => (
                      <div class="rounded-md border border-border-weak-base bg-surface-raised-base p-2">
                        <div class="mb-1 flex items-center gap-2 text-11-medium text-text-base">
                          <span class="size-2 rounded-full" style={{ "background-color": model.color }} />
                          <span class="truncate" title={model.label}>
                            {model.label}
                          </span>
                          <span class="ml-auto text-11-regular text-text-weaker">{model.count}</span>
                        </div>
                        <MetricChartPlot
                          facet
                          entries={() => entries().filter((entry) => entry.modelKey === model.key)}
                          metric={state.metric}
                          plotMode={state.plotMode}
                          xAxis={state.xAxis}
                          smooth={state.smooth}
                          range={state.range}
                          selectedModels={[model.key]}
                          activeMessageID={activePoint()?.message.id}
                          onSelectMessage={selectMessage}
                          onActivatePoint={setActivePoint}
                          onActivePoint={setActivePoint}
                        />
                      </div>
                    )}
                  </For>
                  <Show when={facetModels().length === 0}>
                    <div class="col-span-full flex h-40 items-center justify-center text-12-regular text-text-weak">
                      {language.t("context.rawMessages.chart.noModelSelected")}
                    </div>
                  </Show>
                </div>
              }
            >
              <MetricChartPlot
                entries={entries}
                metric={state.metric}
                compareMetric={state.compareMetric}
                plotMode={state.plotMode}
                xAxis={state.xAxis}
                smooth={state.smooth}
                range={state.range}
                selectedModels={state.selectedModels}
                expanded
                summary={summary}
                activeMessageID={activePoint()?.message.id}
                onSelectMessage={selectMessage}
                onActivatePoint={setActivePoint}
                onActivePoint={setActivePoint}
              />
            </Show>
          </div>

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

        <div class="flex flex-none items-center gap-1">
          <For each={["detail", "models", "table"] as const}>
            {(tab) => (
              <Button
                size="small"
                variant="ghost"
                aria-pressed={state.bottomTab === tab}
                class="px-2"
                classList={{
                  "bg-surface-raised-base text-text-strong": state.bottomTab === tab,
                  "text-text-weak": state.bottomTab !== tab,
                }}
                onClick={() => setState("bottomTab", tab)}
              >
                {language.t(`context.rawMessages.chart.tab.${tab}` as Parameters<typeof language.t>[0])}
              </Button>
            )}
          </For>
        </div>

        <div class="min-h-[140px] flex-none overflow-auto rounded-md border border-border-base bg-surface-base px-3 py-2.5">
          <Show
            when={state.bottomTab === "detail"}
            fallback={
              <Show
                when={state.bottomTab === "models"}
                fallback={
                  <div class="overflow-x-auto">
                    <table class="w-full min-w-[720px] text-11-regular">
                      <thead>
                        <tr class="text-text-weak">
                          <TableHead
                            label={language.t("context.rawMessages.chart.column.sequence")}
                            active={state.tableSort === "sequence"}
                            desc={state.tableDesc}
                            onClick={() => sortTable("sequence")}
                          />
                          <TableHead
                            label={language.t("context.rawMessages.chart.column.time")}
                            active={state.tableSort === "time"}
                            desc={state.tableDesc}
                            onClick={() => sortTable("time")}
                          />
                          <TableHead
                            label={language.t("context.rawMessages.chart.column.model")}
                            active={false}
                            desc={false}
                            onClick={() => {}}
                          />
                          <TableHead
                            label={metricLabel(language, state.metric)}
                            active={state.tableSort === "metric"}
                            desc={state.tableDesc}
                            onClick={() => sortTable("metric")}
                          />
                          <TableHead
                            label={language.t("context.rawMessages.chart.column.duration")}
                            active={state.tableSort === "duration"}
                            desc={state.tableDesc}
                            onClick={() => sortTable("duration")}
                          />
                          <TableHead
                            label={language.t("context.rawMessages.chart.column.total")}
                            active={state.tableSort === "total"}
                            desc={state.tableDesc}
                            onClick={() => sortTable("total")}
                          />
                          <TableHead
                            label={language.t("context.rawMessages.chart.column.cost")}
                            active={state.tableSort === "cost"}
                            desc={state.tableDesc}
                            onClick={() => sortTable("cost")}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        <For each={tableRows()}>
                          {(row) => (
                            <tr
                              class="border-t border-border-weak-base text-text-base hover:bg-surface-raised-base-hover"
                              classList={{ "bg-surface-raised-base": activePoint()?.message.id === row.entry.message.id }}
                            >
                              <td class="px-2 py-1.5 tabular-nums">{row.entry.sequence}</td>
                              <td class="px-2 py-1.5 tabular-nums">{formatter().time(row.entry.message.time.created)}</td>
                              <td class="max-w-[180px] truncate px-2 py-1.5" title={row.entry.modelLabel}>
                                {row.entry.modelLabel}
                              </td>
                              <td class="px-2 py-1.5 text-right tabular-nums">
                                {row.metric === undefined ? "—" : formatMetric(row.metric, state.metric, language.intl())}
                              </td>
                              <td class="px-2 py-1.5 text-right tabular-nums">
                                {row.duration === undefined ? "—" : formatMetric(row.duration, "duration", language.intl())}
                              </td>
                              <td class="px-2 py-1.5 text-right tabular-nums">{formatCount(row.entry.total, language.intl())}</td>
                              <td class="px-2 py-1.5 text-right tabular-nums">{formatMetric(row.entry.cost, "cost", language.intl())}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                }
              >
                <div class="grid grid-cols-1 gap-2 @[52rem]:grid-cols-2 @[80rem]:grid-cols-3">
                  <For each={modelStats()}>
                    {(model) => (
                      <button
                        type="button"
                        class="rounded-md border border-border-weak-base px-3 py-2 text-left hover:bg-surface-raised-base-hover"
                        onClick={() => toggleModel(model.key, !state.selectedModels.includes(model.key))}
                      >
                        <div class="mb-1.5 flex items-center gap-2">
                          <span class="size-2 rounded-full" style={{ "background-color": model.color }} />
                          <span class="truncate text-12-medium text-text-strong" title={model.label}>
                            {model.label}
                          </span>
                          <span class="ml-auto text-11-regular text-text-weaker">
                            {language.t("context.rawMessages.chart.modelStats.messages")}: {model.count}
                          </span>
                        </div>
                        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-11-regular">
                          <Detail
                            label={language.t("context.rawMessages.chart.modelStats.avg")}
                            value={
                              model.average === undefined
                                ? "—"
                                : formatMetric(model.average, state.metric, language.intl())
                            }
                          />
                          <Detail
                            label={language.t("context.rawMessages.chart.modelStats.median")}
                            value={
                              model.median === undefined
                                ? "—"
                                : formatMetric(model.median, state.metric, language.intl())
                            }
                          />
                          <Detail
                            label={language.t("context.rawMessages.chart.modelStats.peak")}
                            value={
                              model.peak === undefined ? "—" : formatMetric(model.peak, state.metric, language.intl())
                            }
                          />
                          <Detail
                            label={language.t("context.rawMessages.chart.modelStats.tokens")}
                            value={formatCount(model.tokenTotal, language.intl())}
                          />
                          <Detail
                            label={language.t("context.rawMessages.chart.modelStats.cost")}
                            value={formatMetric(model.costTotal, "cost", language.intl())}
                          />
                          <Detail
                            label={language.t("context.rawMessages.chart.modelStats.duration")}
                            value={
                              model.durationAverage === undefined
                                ? "—"
                                : formatMetric(model.durationAverage, "duration", language.intl())
                            }
                          />
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            }
          >
            <Show
              when={activePoint()}
              fallback={
                <div class="text-11-regular text-text-weaker">{language.t("context.rawMessages.chart.pointHint")}</div>
              }
            >
              {(point) => (
                <div>
                  <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-12-medium text-text-strong">
                        {language.t("context.rawMessages.chart.pointTitle", { index: point().sequence })}
                        {` · ${formatter().time(point().message.time.created)}`}
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
                    <Show when={state.compareMetric}>
                      <Detail
                        label={metricLabel(language, state.compareMetric as ChartMetric)}
                        value={formatMetric(
                          metricValue(point(), state.compareMetric as ChartMetric) ?? 0,
                          state.compareMetric as ChartMetric,
                          language.intl(),
                        )}
                      />
                    </Show>
                    <Detail label={language.t("context.rawMessages.duration")} value={activeDuration(point())} />
                    <Detail
                      label={language.t("context.rawMessages.chart.metric.genDuration")}
                      value={secondsText(point().generationMs, "genDuration")}
                    />
                    <Detail
                      label={language.t("context.rawMessages.chart.metric.ttft")}
                      value={secondsText(point().ttftMs, "ttft")}
                    />
                    <Detail
                      label={language.t("context.stats.inputTokens")}
                      value={formatCount(point().input, language.intl())}
                    />
                    <Detail
                      label={language.t("context.stats.outputTokens")}
                      value={formatCount(point().output, language.intl())}
                    />
                    <Detail
                      label={language.t("context.stats.reasoningTokens")}
                      value={formatCount(point().reasoning, language.intl())}
                    />
                    <Detail
                      label={language.t("context.stats.cacheTokens")}
                      value={`${formatCount(point().cacheRead, language.intl())} / ${formatCount(
                        point().cacheWrite,
                        language.intl(),
                      )}`}
                    />
                    <Detail label={language.t("context.rawMessages.costHeader")} value={activeCost(point())} />
                    <Detail
                      label={language.t("context.rawMessages.chart.totalTokens")}
                      value={formatCount(point().total, language.intl())}
                    />
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </div>
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

function TableHead(props: { label: string; active: boolean; desc: boolean; onClick: () => void }) {
  return (
    <th class="px-2 py-1.5 text-left font-medium">
      <button
        type="button"
        class="inline-flex items-center gap-1 hover:text-text-base"
        classList={{ "text-text-strong": props.active }}
        onClick={props.onClick}
      >
        <span>{props.label}</span>
        <Show when={props.active}>
          <span aria-hidden="true">{props.desc ? "↓" : "↑"}</span>
        </Show>
      </button>
    </th>
  )
}
