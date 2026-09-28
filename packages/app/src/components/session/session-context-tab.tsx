import { createMemo, createEffect, createResource, on, onCleanup, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { useSync } from "@/context/sync"
import { checksum } from "@openctrlc/core/util/encode"
import { same } from "@/utils/same"
import { Icon } from "@openctrlc/ui/icon"
import { Button } from "@openctrlc/ui/button"
import { DropdownMenu } from "@openctrlc/ui/dropdown-menu"
import { Accordion } from "@openctrlc/ui/accordion"
import { StickyAccordionHeader } from "@openctrlc/ui/sticky-accordion-header"
import { File } from "@openctrlc/session-ui/file"
import { Markdown } from "@openctrlc/session-ui/markdown"
import { assistantStatistics } from "@openctrlc/session-ui/message-statistics"
import { ScrollView } from "@openctrlc/ui/scroll-view"
import type { Message, Part, UserMessage } from "@openctrlc/sdk/v2/client"
import { showToast } from "@/utils/toast"
import {
  downloadSessionExport,
  fetchSessionExport,
  sessionExportActions,
  sessionExportFilename,
  type SessionExportFormat,
} from "@/utils/session-export"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useProviders } from "@/hooks/use-providers"
import { useSDK } from "@/context/sdk"
import { useSessionLayout } from "@/pages/session/session-layout"
import {
  EMPTY_DISPLAY,
  IN_PROGRESS_DISPLAY,
  getMessageActivity,
  getMessageDurationDisplay,
  getMessageTokenDeltaDisplay,
  getSessionContext,
  isMessageInFlight,
} from "./session-context-metrics"
import { estimateSessionContextBreakdown, type SessionContextBreakdownKey } from "./session-context-breakdown"
import { createSessionContextFormatter } from "./session-context-format"
import { getSessionSystemPrompt } from "./session-context-system-prompt"
import { copySessionID, copyText } from "./session-id-copy"

const BREAKDOWN_COLOR: Record<SessionContextBreakdownKey, string> = {
  system: "var(--syntax-info)",
  user: "var(--syntax-success)",
  assistant: "var(--syntax-property)",
  tool: "var(--syntax-warning)",
  other: "var(--syntax-comment)",
}

const RAW_MESSAGE_GRID = "grid items-center gap-3 w-full"
const RAW_MESSAGE_EXTRA_COLUMNS = [
  { key: "cost", label: "context.rawMessages.costHeader", width: "7rem" },
  { key: "input", label: "context.stats.inputTokens", width: "8rem" },
  { key: "output", label: "context.stats.outputTokens", width: "8rem" },
  { key: "reasoning", label: "context.stats.reasoningTokens", width: "9rem" },
  { key: "cache", label: "context.stats.cacheTokens", width: "11rem" },
] as const

type RawMessageExtraColumnKey = (typeof RAW_MESSAGE_EXTRA_COLUMNS)[number]["key"]

function Stat(props: { label: string; value: JSX.Element }) {
  return (
    <div class="flex flex-col gap-1">
      <div class="text-12-regular text-text-weak">{props.label}</div>
      <div class="text-12-medium text-text-strong">{props.value}</div>
    </div>
  )
}

function RawMessageContent(props: { message: Message; getParts: (id: string) => Part[]; onRendered: () => void }) {
  const file = createMemo(() => {
    const parts = props.getParts(props.message.id)
    const contents = JSON.stringify({ message: props.message, parts }, null, 2)
    return {
      name: `${props.message.role}-${props.message.id}.json`,
      contents,
      cacheKey: checksum(contents),
    }
  })

  return (
    <File
      mode="text"
      file={file()}
      overflow="wrap"
      class="select-text"
      onRendered={() => requestAnimationFrame(props.onRendered)}
    />
  )
}

function RawMessage(props: {
  message: Message
  getParts: (id: string) => Part[]
  onRendered: () => void
  time: (value: number | undefined) => string
  activity: string
  duration: string
  tokenDelta: string
  extraColumns: (typeof RAW_MESSAGE_EXTRA_COLUMNS)[number][]
  extraColumnValue: (message: Message, column: RawMessageExtraColumnKey) => string
  gridStyle: JSX.CSSProperties
}) {
  return (
    <Accordion.Item value={props.message.id}>
      <StickyAccordionHeader>
        <Accordion.Trigger>
          <div
            class={RAW_MESSAGE_GRID}
            classList={{ "min-w-max": props.extraColumns.length > 0 }}
            style={props.gridStyle}
          >
            <div class="shrink-0 text-left">{props.message.role}</div>
            <div class="min-w-0 truncate text-left text-text-weak" title={props.activity}>
              {props.activity}
            </div>
            <div class="min-w-0 text-right text-text-base tabular-nums">{props.duration}</div>
            <div class="min-w-0 text-right text-text-base tabular-nums">{props.tokenDelta}</div>
            <For each={props.extraColumns}>
              {(column) => (
                <div
                  class="min-w-0 truncate text-right text-text-base tabular-nums"
                  title={props.extraColumnValue(props.message, column.key)}
                >
                  {props.extraColumnValue(props.message, column.key)}
                </div>
              )}
            </For>
            <div class="flex items-center justify-end gap-3">
              <div class="shrink-0 text-12-regular text-text-weak">{props.time(props.message.time.created)}</div>
              <Icon name="chevron-grabber-vertical" size="small" class="shrink-0 text-text-weak" />
            </div>
          </div>
        </Accordion.Trigger>
      </StickyAccordionHeader>
      <Accordion.Content class="bg-background-base">
        <div class="p-3">
          <RawMessageContent message={props.message} getParts={props.getParts} onRendered={props.onRendered} />
        </div>
      </Accordion.Content>
    </Accordion.Item>
  )
}

function SessionTokenSpeedChart(props: { messages: Message[] }) {
  const language = useLanguage()
  const entries = createMemo(() =>
    props.messages.flatMap((message) => {
      if (message.role !== "assistant") return []
      return [
        {
          message,
          statistics: assistantStatistics({
            output: message.tokens?.output,
            reasoning: message.tokens?.reasoning,
            created: message.time?.created,
            completed: message.time?.completed,
            requestStarted: message.time?.requestStarted,
            firstGenerated: message.time?.firstGenerated,
            lastGenerated: message.time?.lastGenerated,
            generationDuration: message.time?.generationDuration,
            providerCompleted: message.time?.providerCompleted,
          }),
        },
      ]
    }),
  )
  const maximum = createMemo(() =>
    entries().reduce((value, entry) => Math.max(value, entry.statistics?.tokensPerSecond ?? 0), 0),
  )
  const chartMaximum = createMemo(() => {
    const value = maximum() * 1.1
    if (value <= 0) return 1
    const magnitude = 10 ** Math.floor(Math.log10(value))
    return Math.ceil(value / magnitude) * magnitude
  })
  const layout = { left: 58, top: 12, width: 882, height: 184 }
  const points = createMemo(() => {
    const all = entries()
    const max = chartMaximum()
    return all.map((entry, index) => ({
      ...entry,
      index: index + 1,
      x: layout.left + (all.length <= 1 ? layout.width / 2 : (index / (all.length - 1)) * layout.width),
      y: layout.top + (1 - (entry.statistics?.tokensPerSecond ?? 0) / max) * layout.height,
    }))
  })
  const yTicks = createMemo(() =>
    [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: chartMaximum() * ratio,
      y: layout.top + (1 - ratio) * layout.height,
    })),
  )
  const xTicks = createMemo(() => {
    const count = entries().length
    const length = Math.min(count, 5)
    return Array.from({ length }, (_, tick) => {
      const index = count <= 5 ? tick : Math.round((count - 1) * (tick / (length - 1)))
      return { index, x: points()[index]?.x ?? layout.left }
    })
  })
  const line = createMemo(() =>
    points().reduce((path, point, index, all) => {
      if (!point.statistics) return path
      return `${path}${all[index - 1]?.statistics ? "L" : "M"}${point.x} ${point.y} `
    }, ""),
  )
  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))
  const rate = createMemo(() => new Intl.NumberFormat(language.intl(), { maximumFractionDigits: 1 }))
  const hasData = createMemo(() => entries().some((entry) => entry.statistics !== undefined))

  return (
    <div class="rounded-md border border-border-base bg-surface-base p-3">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div class="text-12-medium text-text-base">{language.t("context.rawMessages.speedChart.title")}</div>
        <div class="text-11-regular text-text-weak">
          {language.t("context.rawMessages.speedChart.description")}
        </div>
      </div>
      <Show
        when={hasData()}
        fallback={
          <div class="flex h-40 items-center justify-center text-12-regular text-text-weak">
            {language.t("context.rawMessages.speedChart.empty")}
          </div>
        }
      >
        <div class="overflow-x-auto">
          <svg
            viewBox="0 0 960 238"
            class="block h-52 w-full min-w-[560px]"
            role="img"
            aria-label={`${language.t("context.rawMessages.speedChart.title")}. ${language.t("context.rawMessages.speedChart.description")}`}
          >
            <For each={yTicks()}>
              {(tick) => (
                <>
                  <line
                    x1={layout.left}
                    y1={tick.y}
                    x2={layout.left + layout.width}
                    y2={tick.y}
                    stroke="var(--border-weak-base)"
                    stroke-dasharray="3 4"
                  />
                  <text
                    x={layout.left - 10}
                    y={tick.y + 4}
                    fill="var(--text-weak)"
                    font-size="11"
                    text-anchor="end"
                  >
                    {rate().format(tick.value)}
                  </text>
                </>
              )}
            </For>
            <path
              d={line()}
              fill="none"
              stroke="var(--syntax-info)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <For each={points()}>
              {(point) => (
                <Show when={point.statistics}>
                  {(statistics) => (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="var(--syntax-info)"
                      tabindex="0"
                      class="cursor-help"
                    >
                      <title>
                        {language.t("context.rawMessages.speedChart.tooltip", {
                          index: point.index,
                          time: formatter().time(point.message.time.created),
                          speed: rate().format(statistics().tokensPerSecond),
                          tokens: formatter().number(statistics().total),
                          duration: (statistics().durationMs / 1000).toLocaleString(language.intl(), {
                            maximumFractionDigits: 1,
                          }),
                        })}
                      </title>
                    </circle>
                  )}
                </Show>
              )}
            </For>
            <For each={xTicks()}>
              {(tick) => (
                <text
                  x={tick.x}
                  y="220"
                  fill="var(--text-weak)"
                  font-size="11"
                  text-anchor="middle"
                >
                  {tick.index + 1}
                </text>
              )}
            </For>
            <text
              x={layout.left + layout.width / 2}
              y="236"
              fill="var(--text-weak)"
              font-size="11"
              text-anchor="middle"
            >
              {language.t("context.rawMessages.speedChart.axis")}
            </text>
          </svg>
        </div>
      </Show>
    </div>
  )
}

const emptyMessages: Message[] = []
const emptyUserMessages: UserMessage[] = []

export function SessionContextTab() {
  const sync = useSync()
  const language = useLanguage()
  const platform = usePlatform()
  const sdk = useSDK()
  const providers = useProviders(() => sdk().directory)
  const { params, view } = useSessionLayout()
  const info = createMemo(() => (params.id ? sync().session.get(params.id) : undefined))

  // Snapshot is write-once on the session; do not key off time.updated or any
  // message-driven revision — that refetches under Suspense and flashes the panel.
  const [systemPromptSnapshot] = createResource(
    () => params.id,
    (sessionID) =>
      sdk()
        .client.v2.session.systemPromptSnapshot({ sessionID })
        .then(
          (result) => result.data?.data?.snapshot,
          () => undefined,
        ),
  )

  const messages = createMemo(
    () => {
      const id = params.id
      if (!id) return emptyMessages
      return (sync().data.message[id] ?? []) as Message[]
    },
    emptyMessages,
    { equals: same },
  )

  const userMessages = createMemo(
    () => messages().filter((m) => m.role === "user") as UserMessage[],
    emptyUserMessages,
    { equals: same },
  )

  const visibleUserMessages = createMemo(
    () => {
      const revert = info()?.revert?.messageID
      if (!revert) return userMessages()
      const boundary = userMessages().findIndex((message) => message.id === revert)
      return boundary < 0 ? userMessages() : userMessages().slice(0, boundary)
    },
    emptyUserMessages,
    { equals: same },
  )

  const usd = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        style: "currency",
        currency: "USD",
      }),
  )
  const rawMessageCost = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
  )

  const ctx = createMemo(() => getSessionContext(messages(), [...providers.all().values()]))
  const formatter = createMemo(() => createSessionContextFormatter(language.intl()))
  const [rawMessageColumnState, setRawMessageColumnState] = createStore({
    cost: false,
    input: false,
    output: false,
    reasoning: false,
    cache: false,
  })
  const [rawMessageChartState, setRawMessageChartState] = createStore({ speed: false })
  const rawMessageExtraColumns = createMemo(() =>
    RAW_MESSAGE_EXTRA_COLUMNS.filter((column) => rawMessageColumnState[column.key]),
  )
  const rawMessageGridStyle = createMemo(() => ({
    "grid-template-columns": [
      "5.5rem",
      rawMessageExtraColumns().length > 0 ? "minmax(10rem,1fr)" : "minmax(0,1fr)",
      "4.5rem",
      "8rem",
      ...rawMessageExtraColumns().map((column) => column.width),
      "12.5rem",
    ].join(" "),
  }))

  const messageTokenDelta = (messages: Message[], index: number) => {
    const delta = getMessageTokenDeltaDisplay(messages, index)
    if (delta !== undefined) return formatter().number(delta)
    const message = messages[index]
    if (message && isMessageInFlight(message)) return IN_PROGRESS_DISPLAY
    return EMPTY_DISPLAY
  }

  const messageDuration = (message: Message) => {
    const display = getMessageDurationDisplay(message)
    if (display !== undefined) return display
    if (isMessageInFlight(message)) return IN_PROGRESS_DISPLAY
    return EMPTY_DISPLAY
  }

  const extraColumnValue = (message: Message, column: RawMessageExtraColumnKey) => {
    if (message.role !== "assistant") return EMPTY_DISPLAY
    if (isMessageInFlight(message)) return IN_PROGRESS_DISPLAY
    if (column === "cost") return rawMessageCost().format(message.cost)

    const format = formatter()
    if (column === "input") return format.number(message.tokens.input)
    if (column === "output") return format.number(message.tokens.output)
    if (column === "reasoning") return format.number(message.tokens.reasoning)
    return `${format.number(message.tokens.cache.read)} / ${format.number(message.tokens.cache.write)}`
  }

  const cost = createMemo(() => {
    return usd().format(info()?.cost ?? 0)
  })

  const counts = createMemo(() => {
    const all = messages()
    const user = all.reduce((count, x) => count + (x.role === "user" ? 1 : 0), 0)
    const assistant = all.reduce((count, x) => count + (x.role === "assistant" ? 1 : 0), 0)
    return {
      all: all.length,
      user,
      assistant,
    }
  })

  // Prefer .latest so an in-flight refetch never re-enters Suspense while resolved.
  const systemPrompt = createMemo(() => getSessionSystemPrompt(visibleUserMessages(), systemPromptSnapshot.latest))
  const [systemPromptState, setSystemPromptState] = createStore({ expanded: false })

  const systemPromptNeedsExpansion = createMemo(() => (systemPrompt()?.length ?? 0) > 800)
  const systemPromptPreviewCollapsed = createMemo(() => systemPromptNeedsExpansion() && !systemPromptState.expanded)
  const toggleSystemPrompt = () => setSystemPromptState("expanded", (value) => !value)

  createEffect(
    on(
      () => [params.id, systemPrompt()],
      () => setSystemPromptState("expanded", false),
      { defer: true },
    ),
  )

  const providerLabel = createMemo(() => {
    const c = ctx()
    if (!c) return "—"
    return c.providerLabel
  })

  const modelLabel = createMemo(() => {
    const c = ctx()
    if (!c) return "—"
    return c.modelLabel
  })

  const breakdown = createMemo(
    on(
      () => [ctx()?.message.id, ctx()?.input, messages().length, systemPrompt()],
      () => {
        const c = ctx()
        if (!c?.input) return []
        return estimateSessionContextBreakdown({
          messages: messages(),
          parts: sync().data.part as Record<string, Part[] | undefined>,
          input: c.input,
          systemPrompt: systemPrompt(),
        })
      },
    ),
  )

  const breakdownLabel = (key: SessionContextBreakdownKey) => {
    if (key === "system") return language.t("context.breakdown.system")
    if (key === "user") return language.t("context.breakdown.user")
    if (key === "assistant") return language.t("context.breakdown.assistant")
    if (key === "tool") return language.t("context.breakdown.tool")
    return language.t("context.breakdown.other")
  }

  const stats = [
    { label: "context.stats.session", value: () => info()?.title ?? params.id ?? "—" },
    { label: "context.stats.messages", value: () => counts().all.toLocaleString(language.intl()) },
    { label: "context.stats.provider", value: providerLabel },
    { label: "context.stats.model", value: modelLabel },
    { label: "context.stats.limit", value: () => formatter().number(ctx()?.limit) },
    { label: "context.stats.totalTokens", value: () => formatter().number(ctx()?.total) },
    { label: "context.stats.usage", value: () => formatter().percent(ctx()?.usage) },
    { label: "context.stats.inputTokens", value: () => formatter().number(ctx()?.input) },
    { label: "context.stats.outputTokens", value: () => formatter().number(ctx()?.message.tokens.output) },
    { label: "context.stats.reasoningTokens", value: () => formatter().number(ctx()?.message.tokens.reasoning) },
    {
      label: "context.stats.cacheTokens",
      value: () =>
        `${formatter().number(ctx()?.message.tokens.cache.read)} / ${formatter().number(ctx()?.message.tokens.cache.write)}`,
    },
    { label: "context.stats.userMessages", value: () => counts().user.toLocaleString(language.intl()) },
    { label: "context.stats.assistantMessages", value: () => counts().assistant.toLocaleString(language.intl()) },
    { label: "context.stats.totalCost", value: cost },
    { label: "context.stats.sessionCreated", value: () => formatter().time(info()?.time.created) },
    { label: "context.stats.lastActivity", value: () => formatter().time(ctx()?.message.time.created) },
  ] satisfies { label: string; value: () => JSX.Element }[]

  const exportSession = async (format: SessionExportFormat = "json") => {
    const sessionID = params.id
    if (!sessionID) return
    try {
      const data = await fetchSessionExport({
        sessionID,
        client: sdk().client,
      })
      const filename = sessionExportFilename(data.info, format)
      downloadSessionExport(filename, data, format)
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("toast.session.export.success.title"),
        description: language.t("toast.session.export.success.description", { filename }),
        actions: sessionExportActions(platform, language),
      })
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("toast.session.export.failed.title"),
        description: err instanceof Error ? err.message : language.t("toast.session.export.failed.description"),
      })
    }
  }

  const copySessionIDToClipboard = async () => {
    const sessionID = params.id
    if (!sessionID) return

    try {
      await copySessionID(
        sessionID,
        platform.writeClipboardText ? { writeText: platform.writeClipboardText } : undefined,
      )
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("context.sessionID.copied"),
        description: sessionID,
      })
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("context.sessionID.copyFailed"),
        description: err instanceof Error ? err.message : language.t("common.requestFailed"),
      })
    }
  }

  const copySystemPromptToClipboard = async () => {
    const prompt = systemPrompt()
    if (!prompt) return

    try {
      const copied = await copyText(
        prompt,
        platform.writeClipboardText ? { writeText: platform.writeClipboardText } : undefined,
      )
      if (!copied) {
        showToast({
          variant: "error",
          title: language.t("context.systemPrompt.copyFailed"),
          description: language.t("common.requestFailed"),
        })
        return
      }

      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("session.share.copy.copied"),
      })
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("context.systemPrompt.copyFailed"),
        description: err instanceof Error ? err.message : language.t("common.requestFailed"),
      })
    }
  }

  let scroll: HTMLDivElement | undefined
  let frame: number | undefined
  let pending: { x: number; y: number } | undefined
  const getParts = (id: string) => (sync().data.part[id] ?? []) as Part[]

  const restoreScroll = () => {
    const el = scroll
    if (!el) return

    const s = view().scroll("context")
    if (!s) return

    if (el.scrollTop !== s.y) el.scrollTop = s.y
    if (el.scrollLeft !== s.x) el.scrollLeft = s.x
  }

  const handleScroll = (event: Event & { currentTarget: HTMLDivElement }) => {
    pending = {
      x: event.currentTarget.scrollLeft,
      y: event.currentTarget.scrollTop,
    }
    if (frame !== undefined) return

    frame = requestAnimationFrame(() => {
      frame = undefined

      const next = pending
      pending = undefined
      if (!next) return

      view().setScroll("context", next)
    })
  }

  createEffect(
    on(
      () => messages().length,
      () => {
        requestAnimationFrame(restoreScroll)
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    if (frame === undefined) return
    cancelAnimationFrame(frame)
  })

  return (
    <ScrollView
      class="@container h-full"
      viewportRef={(el) => {
        scroll = el
        restoreScroll()
      }}
      onScroll={handleScroll}
    >
      <div class="px-6 pt-4 pb-10 flex flex-col gap-10">
        <Show when={params.id}>
          <div class="flex items-center justify-between gap-3 rounded-md border border-border-weak-base bg-surface-panel px-3 py-2">
            <div class="min-w-0 flex flex-col gap-1">
              <div class="text-12-regular text-text-weak">{language.t("context.stats.sessionID")}</div>
              <div class="truncate text-12-medium text-text-strong" title={params.id}>
                {params.id}
              </div>
            </div>
            <Button
              size="small"
              variant="ghost"
              class="shrink-0 px-2 text-text-weak hover:text-text-base"
              onClick={copySessionIDToClipboard}
              aria-label={language.t("context.sessionID.copy")}
            >
              <Icon name="copy" size="small" />
            </Button>
          </div>
        </Show>

        <div class="grid grid-cols-1 @[32rem]:grid-cols-2 gap-4">
          <For each={stats}>
            {(stat) => <Stat label={language.t(stat.label as Parameters<typeof language.t>[0])} value={stat.value()} />}
          </For>
        </div>

        <Show when={breakdown().length > 0}>
          <div class="flex flex-col gap-2">
            <div class="text-12-regular text-text-weak">{language.t("context.breakdown.title")}</div>
            <div class="h-2 w-full rounded-full bg-surface-base overflow-hidden flex">
              <For each={breakdown()}>
                {(segment) => (
                  <div
                    class="h-full"
                    style={{
                      width: `${segment.width}%`,
                      "background-color": BREAKDOWN_COLOR[segment.key],
                    }}
                  />
                )}
              </For>
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <For each={breakdown()}>
                {(segment) => (
                  <div class="flex items-center gap-1 text-11-regular text-text-weak">
                    <div class="size-2 rounded-sm" style={{ "background-color": BREAKDOWN_COLOR[segment.key] }} />
                    <div>{breakdownLabel(segment.key)}</div>
                    <div class="text-text-weaker">{segment.percent.toLocaleString(language.intl())}%</div>
                  </div>
                )}
              </For>
            </div>
            <div class="hidden text-11-regular text-text-weaker">{language.t("context.breakdown.note")}</div>
          </div>
        </Show>

        <Show when={systemPrompt()}>
          {(prompt) => (
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <div class="text-12-regular text-text-weak">{language.t("context.systemPrompt.title")}</div>
                  <div class="text-11-regular text-text-weaker">{language.t("context.systemPrompt.snapshotNote")}</div>
                </div>
                <div class="flex items-center gap-1">
                  <Button
                    size="small"
                    variant="ghost"
                    class="shrink-0 px-2 text-text-weak hover:text-text-base"
                    onClick={() => void copySystemPromptToClipboard()}
                    aria-label={language.t("context.systemPrompt.copy")}
                    title={language.t("context.systemPrompt.copy")}
                  >
                    <Icon name="copy" size="small" />
                  </Button>
                  <Show when={systemPromptNeedsExpansion()}>
                    <Button
                      size="small"
                      variant="ghost"
                      class="shrink-0 gap-1 px-2 text-text-weak hover:text-text-base"
                      onClick={toggleSystemPrompt}
                      aria-expanded={systemPromptState.expanded}
                    >
                      <span>
                        {language.t(systemPromptState.expanded ? "session.todo.collapse" : "session.todo.expand")}
                      </span>
                      <Icon
                        name="chevron-down"
                        size="small"
                        style={{ transform: `rotate(${systemPromptState.expanded ? 180 : 0}deg)` }}
                      />
                    </Button>
                  </Show>
                </div>
              </div>
              <div class="relative border border-border-base rounded-md bg-surface-base px-3 py-2">
                <div
                  classList={{
                    "max-h-[var(--app-viewport-height-60)] overflow-y-auto": systemPromptState.expanded,
                  }}
                >
                  <Markdown
                    text={prompt()}
                    class="text-12-regular"
                    style={{
                      display: systemPromptPreviewCollapsed() ? "-webkit-box" : undefined,
                      "-webkit-line-clamp": systemPromptPreviewCollapsed() ? "3" : undefined,
                      "-webkit-box-orient": systemPromptPreviewCollapsed() ? "vertical" : undefined,
                      overflow: systemPromptPreviewCollapsed() ? "hidden" : undefined,
                    }}
                  />
                </div>
                <Show when={systemPromptPreviewCollapsed()}>
                  <div
                    class="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-surface-base to-transparent"
                    aria-hidden="true"
                  />
                </Show>
              </div>
            </div>
          )}
        </Show>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-12-regular text-text-weak">{language.t("context.rawMessages.title")}</div>
            <div class="flex items-center gap-1">
              <DropdownMenu placement="bottom-end" gutter={4}>
                <DropdownMenu.Trigger
                  as={Button}
                  size="small"
                  variant="ghost"
                  class="gap-1.5 px-2 text-text-weak hover:text-text-base"
                >
                  <Icon name="sliders" size="small" />
                  <span>{language.t("context.rawMessages.columns")}</span>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content>
                    <DropdownMenu.Group>
                      <DropdownMenu.GroupLabel>{language.t("context.rawMessages.columns")}</DropdownMenu.GroupLabel>
                      <For each={RAW_MESSAGE_EXTRA_COLUMNS}>
                        {(column) => (
                          <DropdownMenu.CheckboxItem
                            checked={rawMessageColumnState[column.key]}
                            onChange={(checked) => setRawMessageColumnState(column.key, checked)}
                          >
                            <DropdownMenu.ItemLabel>{language.t(column.label)}</DropdownMenu.ItemLabel>
                            <DropdownMenu.ItemIndicator>
                              <Icon name="check-small" size="small" class="text-icon-weak" />
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.CheckboxItem>
                        )}
                      </For>
                    </DropdownMenu.Group>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
              <Button
                size="small"
                variant="ghost"
                class="gap-1.5 px-2 text-text-weak hover:text-text-base"
                onClick={() => setRawMessageChartState("speed", (value) => !value)}
                aria-expanded={rawMessageChartState.speed}
                aria-controls="session-token-speed-chart"
              >
                <span>{language.t("context.rawMessages.chart")}</span>
              </Button>
              <DropdownMenu placement="bottom-end" gutter={4}>
                <DropdownMenu.Trigger
                  as={Button}
                  size="small"
                  variant="ghost"
                  class="gap-1.5 px-2 text-text-weak hover:text-text-base"
                >
                  <Icon name="download" size="small" />
                  <span>{language.t("context.export.session")}</span>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item onSelect={() => void exportSession("json")}>
                      <DropdownMenu.ItemLabel>JSON</DropdownMenu.ItemLabel>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => void exportSession("markdown")}>
                      <DropdownMenu.ItemLabel>Markdown</DropdownMenu.ItemLabel>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => void exportSession("markdown-detailed")}>
                      <DropdownMenu.ItemLabel>Markdown (full)</DropdownMenu.ItemLabel>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
            </div>
          </div>
          <Show when={rawMessageChartState.speed}>
            <div id="session-token-speed-chart">
              <SessionTokenSpeedChart messages={messages()} />
            </div>
          </Show>
          <div classList={{ "min-w-max": rawMessageExtraColumns().length > 0 }}>
            <div
              class={`${RAW_MESSAGE_GRID} px-3 text-11-regular text-text-weak`}
              classList={{ "min-w-max": rawMessageExtraColumns().length > 0 }}
              style={rawMessageGridStyle()}
            >
              <div>Role</div>
              <div class="text-left">{language.t("context.stats.lastActivity")}</div>
              <div class="text-right">{language.t("context.rawMessages.duration")}</div>
              <div class="text-right">{language.t("context.rawMessages.tokenDelta")}</div>
              <For each={rawMessageExtraColumns()}>
                {(column) => <div class="text-right">{language.t(column.label)}</div>}
              </For>
              <div class="text-right">Time</div>
            </div>
            <Accordion
              multiple
              class="w-full"
              classList={{ "min-w-max": rawMessageExtraColumns().length > 0 }}
            >
              <For each={messages()}>
                {(message, index) => (
                  <RawMessage
                    message={message}
                    getParts={getParts}
                    onRendered={restoreScroll}
                    time={formatter().time}
                    activity={getMessageActivity(message, getParts(message.id))}
                    duration={messageDuration(message)}
                    tokenDelta={messageTokenDelta(messages(), index())}
                    extraColumns={rawMessageExtraColumns()}
                    extraColumnValue={extraColumnValue}
                    gridStyle={rawMessageGridStyle()}
                  />
                )}
              </For>
            </Accordion>
          </div>
        </div>
      </div>
    </ScrollView>
  )
}
