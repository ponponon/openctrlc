import {
  createMemo,
  createEffect,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
  For,
  Show,
  type Accessor,
} from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { createVirtualizer } from "@tanstack/solid-virtual"
import { useSync } from "@/context/sync"
import { checksum } from "@openctrlc/core/util/encode"
import { same } from "@/utils/same"
import { Icon } from "@openctrlc/ui/icon"
import { Button } from "@openctrlc/ui/button"
import { DropdownMenu } from "@openctrlc/ui/dropdown-menu"
import { Accordion } from "@openctrlc/ui/accordion"
import { StickyAccordionHeader } from "@openctrlc/ui/sticky-accordion-header"
import { useDialog } from "@openctrlc/ui/context/dialog"
import { File } from "@openctrlc/session-ui/file"
import { Markdown } from "@openctrlc/session-ui/markdown"
import { ScrollView } from "@openctrlc/ui/scroll-view"
import { observeVirtualScrollRect } from "@/components/virtual-scroll-element"
import type { AssistantMessage, Message, Part, UserMessage } from "@openctrlc/sdk/v2/client"
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
  getMessageTokenTotal,
  getSessionContext,
  isMessageInFlight,
} from "./session-context-metrics"
import { estimateSessionContextBreakdown, type SessionContextBreakdownKey } from "./session-context-breakdown"
import { createSessionContextFormatter } from "./session-context-format"
import { getSessionSystemPrompt } from "./session-context-system-prompt"
import { DialogSessionMetricChart, SessionTokenSpeedChart } from "./session-context-chart"
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
    <Accordion.Item value={props.message.id} id={`session-context-message-${props.message.id}`}>
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

const emptyMessages: Message[] = []
const emptyUserMessages: UserMessage[] = []

export function SessionContextTab(props: { sessionID: Accessor<string | undefined>; active: Accessor<boolean> }) {
  const sync = useSync()
  const language = useLanguage()
  const platform = usePlatform()
  const sdk = useSDK()
  const dialog = useDialog()
  const providers = useProviders(() => sdk().directory)
  const { view } = useSessionLayout()
  const info = createMemo(() => {
    const id = props.sessionID()
    return id ? sync().session.get(id) : undefined
  })

  // Snapshot is write-once on the session; do not key off time.updated or any
  // message-driven revision — that refetches under Suspense and flashes the panel.
  const systemPromptSnapshotCache = new Map<string, Promise<{ sessionID: string; snapshot?: string }>>()
  const [systemPromptSnapshot] = createResource(
    () => props.sessionID(),
    (sessionID) => {
      if (!sessionID) return undefined
      const cached = systemPromptSnapshotCache.get(sessionID)
      if (cached) return cached
      const request = sdk()
        .client.v2.session.systemPromptSnapshot({ sessionID })
        .then(
          (result) => ({ sessionID, snapshot: result.data?.data?.snapshot }),
          () => {
            systemPromptSnapshotCache.delete(sessionID)
            return { sessionID, snapshot: undefined }
          },
        )
      systemPromptSnapshotCache.set(sessionID, request)
      if (systemPromptSnapshotCache.size > 16) {
        const oldest = systemPromptSnapshotCache.keys().next().value
        if (oldest) systemPromptSnapshotCache.delete(oldest)
      }
      return request
    },
  )

  const [lastMessages, setLastMessages] = createSignal(emptyMessages, { equals: same })
  const messages = createMemo(
    () => {
      const id = props.sessionID()
      if (!id) return emptyMessages
      if (!props.active()) return lastMessages()
      return (sync().data.message[id] ?? []) as Message[]
    },
    emptyMessages,
    { equals: same },
  )
  createEffect(() => {
    if (!props.active()) return
    setLastMessages(messages())
  })

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
  const [rawMessageAccordionState, setRawMessageAccordionState] = createStore({ value: [] as string[] })
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

  const messageTokenDeltas = createMemo(() => {
    let previousTotal: number | undefined
    return messages().map((message) => {
      const total = getMessageTokenTotal(message)
      if (total === undefined) return undefined
      const delta = previousTotal === undefined ? total : Math.max(0, total - previousTotal)
      previousTotal = total
      if (isMessageInFlight(message) && delta === 0) return undefined
      return delta
    })
  })

  const messageTokenDelta = (index: number) => {
    const delta = messageTokenDeltas()[index]
    if (delta !== undefined) return formatter().number(delta)
    const message = messages()[index]
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
  const systemPrompt = createMemo(() => {
    const snapshot = systemPromptSnapshot.latest
    return getSessionSystemPrompt(
      visibleUserMessages(),
      snapshot && snapshot.sessionID === props.sessionID() ? snapshot.snapshot : undefined,
    )
  })
  const [systemPromptState, setSystemPromptState] = createStore({ expanded: false })

  const systemPromptNeedsExpansion = createMemo(() => (systemPrompt()?.length ?? 0) > 800)
  const systemPromptPreviewCollapsed = createMemo(() => systemPromptNeedsExpansion() && !systemPromptState.expanded)
  const toggleSystemPrompt = () => setSystemPromptState("expanded", (value) => !value)

  createEffect(
    on(
      () => [props.sessionID(), systemPrompt()],
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
    { label: "context.stats.session", value: () => info()?.title ?? props.sessionID() ?? "—" },
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
    const sessionID = props.sessionID()
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
    const sessionID = props.sessionID()
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

  const [scroll, setScroll] = createSignal<HTMLDivElement>()
  const [messageListRoot, setMessageListRoot] = createSignal<HTMLDivElement>()
  let frame: number | undefined
  let pending: { x: number; y: number } | undefined
  const getParts = (id: string) => (sync().data.part[id] ?? []) as Part[]
  const scrollMargin = () => {
    const viewport = scroll()
    const list = messageListRoot()
    if (!viewport || !list) return 0
    return list.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
  }
  const messageVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return messages().length
    },
    getScrollElement: () => scroll() ?? null,
    observeElementRect: observeVirtualScrollRect,
    initialRect: { width: 0, height: 600 },
    estimateSize: () => 32,
    overscan: 10,
    get scrollMargin() {
      return scrollMargin()
    },
    get getItemKey() {
      const all = messages()
      return (index: number) => all[index]?.id ?? index
    },
  })
  const messageByID = createMemo(() => new Map(messages().map((message) => [message.id, message] as const)))
  const virtualItemByKey = createMemo(
    () =>
      new Map(
        messageVirtualizer
          .getVirtualItems()
          .map((item) => [item.key, { index: item.index, start: item.start }] as const),
      ),
  )
  const virtualRowKeys = createMemo(() =>
    messageVirtualizer
      .getVirtualItems()
      .filter((item) => messageByID().has(String(item.key)))
      .map((item) => item.key),
  )
  const virtualRowsHeight = createMemo(() => Math.max(0, messageVirtualizer.getTotalSize() - scrollMargin()))

  const restoreScroll = () => {
    const el = scroll()
    if (!el) return

    const s = view().scroll("context")
    if (!s) return

    if (el.scrollTop !== s.y) el.scrollTop = s.y
    if (el.scrollLeft !== s.x) el.scrollLeft = s.x
  }

  const selectRawMessage = (messageID: string) => {
    setRawMessageAccordionState("value", (value) => (value.includes(messageID) ? value : [...value, messageID]))
    const index = messages().findIndex((message) => message.id === messageID)
    if (index < 0) return
    messageVirtualizer.scrollToIndex(index, { align: "center", behavior: "smooth" })
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.getElementById("session-context-message-" + messageID)?.scrollIntoView({ block: "center" }),
      ),
    )
  }

  const messageModelLabel = (message: AssistantMessage) => {
    const provider = providers.all().get(message.providerID)
    return `${provider?.models[message.modelID]?.name ?? message.modelID} · ${provider?.name ?? message.providerID}`
  }
  const expandChart = () =>
    dialog.show(() => (
      <DialogSessionMetricChart
        messages={messages()}
        modelLabel={messageModelLabel}
        onSelectMessage={selectRawMessage}
      />
    ))

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
      () => [props.sessionID(), messages().length],
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
        setScroll(el)
        restoreScroll()
      }}
      onScroll={handleScroll}
    >
      <div class="px-6 pt-4 pb-10 flex flex-col gap-10">
        <Show when={props.sessionID()}>
          <div class="flex items-center justify-between gap-3 rounded-md border border-border-weak-base bg-surface-panel px-3 py-2">
            <div class="min-w-0 flex flex-col gap-1">
              <div class="text-12-regular text-text-weak">{language.t("context.stats.sessionID")}</div>
              <div class="truncate text-12-medium text-text-strong" title={props.sessionID()}>
                {props.sessionID()}
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
              <SessionTokenSpeedChart
                messages={messages()}
                modelLabel={messageModelLabel}
                onSelectMessage={selectRawMessage}
                onExpand={expandChart}
              />
            </div>
          </Show>
          <div ref={setMessageListRoot} classList={{ "min-w-max": rawMessageExtraColumns().length > 0 }}>
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
              value={rawMessageAccordionState.value}
              onChange={(value) => setRawMessageAccordionState("value", value)}
              class="w-full"
              classList={{ "min-w-max": rawMessageExtraColumns().length > 0 }}
              style={{ position: "relative", height: virtualRowsHeight() + "px" }}
            >
              <For each={virtualRowKeys()}>
                {(key) => {
                  const item = createMemo(() => virtualItemByKey().get(key))
                  const message = createMemo(() => messageByID().get(String(key)))
                  let element: HTMLDivElement | undefined

                  onMount(() => {
                    if (element) messageVirtualizer.measureElement(element)
                  })
                  createEffect(
                    on(
                      () => item()?.index,
                      (index) => {
                        if (index === undefined || !element) return
                        element.dataset.index = String(index)
                        messageVirtualizer.measureElement(element)
                      },
                      { defer: true },
                    ),
                  )

                  return (
                    // Keyed Show passes the stable ID value, not a branch-scoped accessor that becomes stale on scroll.
                    <Show when={item() && message() ? String(key) : undefined} keyed>
                      {(messageID) => (
                        <div
                          data-index={item()?.index ?? -1}
                          ref={(el) => (element = el)}
                          data-message-id={messageID}
                          style={{
                            position: "absolute",
                            top: "0",
                            left: "0",
                            width: "100%",
                            transform: "translateY(" + ((item()?.start ?? 0) - scrollMargin()) + "px)",
                          }}
                        >
                          <RawMessage
                            message={message()!}
                            getParts={getParts}
                            onRendered={restoreScroll}
                            time={formatter().time}
                            activity={getMessageActivity(message()!, getParts(message()!.id))}
                            duration={messageDuration(message()!)}
                            tokenDelta={messageTokenDelta(item()?.index ?? -1)}
                            extraColumns={rawMessageExtraColumns()}
                            extraColumnValue={extraColumnValue}
                            gridStyle={rawMessageGridStyle()}
                          />
                        </div>
                      )}
                    </Show>
                  )
                }}
              </For>
            </Accordion>
          </div>
        </div>
      </div>
    </ScrollView>
  )
}
