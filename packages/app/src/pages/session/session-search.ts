import type { Message, Part } from "@openctrlc/sdk/v2/client"

export type SessionSearchScope = "conversation" | "all"
export type SessionSearchDocument = { messageID: string; text: string }
export type SessionSearchMatch = { messageID: string; start: number; end: number }

export function isActiveSearchMessage(messageID: string, activeSearchMessageID: string | undefined) {
  return messageID === activeSearchMessageID
}

const MAX_SEARCH_DOCUMENT_LENGTH = 100_000
const MAX_READABLE_DEPTH = 32
const MAX_READABLE_NODES = 10_000
const activeHydrations = new WeakMap<object, Map<string, { token: symbol; promise: Promise<void> }>>()
export function searchableText(input: { message: Message; parts: Part[]; scope: SessionSearchScope }) {
  const values: string[] = []
  let length = 0
  const seen = new WeakSet<object>()
  const nodes = { value: 0 }
  const remaining = () => MAX_SEARCH_DOCUMENT_LENGTH - length - (values.length === 0 ? 0 : 1)
  const append = (value: string | undefined) => {
    if (!value || length >= MAX_SEARCH_DOCUMENT_LENGTH) return
    const prefix = values.length === 0 ? "" : "\n"
    const available = MAX_SEARCH_DOCUMENT_LENGTH - length - prefix.length
    if (available <= 0) return
    const next = `${prefix}${value.slice(0, available)}`
    values.push(next)
    length += next.length
  }

  for (const part of input.parts) {
    for (const value of partText(part, input.scope, remaining, seen, nodes)) append(value)
    if (length >= MAX_SEARCH_DOCUMENT_LENGTH) break
  }
  if (
    input.scope === "all" &&
    input.message.role === "assistant" &&
    input.message.error &&
    length < MAX_SEARCH_DOCUMENT_LENGTH
  ) {
    append(input.message.error.name)
    for (const value of readableStrings(input.message.error.data, remaining, seen, nodes)) {
      append(value)
      if (length >= MAX_SEARCH_DOCUMENT_LENGTH) break
    }
  }
  return values.join("")
}

export function createSessionSearchIndex(input: {
  messages: Message[]
  parts: (messageID: string) => Part[]
  scope: SessionSearchScope
  open: boolean
  query: string
}) {
  if (!input.open || !input.query) return []
  return createSessionSearchDocuments(input)
}

export function createSessionSearchDocuments(input: {
  messages: Message[]
  parts: (messageID: string) => Part[]
  scope: SessionSearchScope
}) {
  return input.messages.map((message) => ({
    messageID: message.id,
    text: searchableText({ message, parts: input.parts(message.id), scope: input.scope }),
  }))
}

export function findSessionSearchMatches(documents: SessionSearchDocument[], query: string) {
  if (!query) return []
  const needle = query.toLocaleLowerCase()
  if (!needle) return []

  return documents.flatMap((document) =>
    findTextMatches(document.text, needle).map((match) => ({ messageID: document.messageID, ...match })),
  )
}

// 在单段文本里找出 query 的全部命中（needle 为 toLocaleLowerCase 后的关键词，偏移映射回原始码点位置）
export function findTextMatches(text: string, needle: string) {
  const matches: { start: number; end: number }[] = []
  if (!needle) return matches
  const normalized = normalizeWithOffsets(text)
  let start = 0
  while (start < normalized.text.length) {
    const index = normalized.text.indexOf(needle, start)
    if (index < 0) break
    const first = normalized.offsets[index]
    const last = normalized.offsets[index + needle.length - 1]
    if (first && last) matches.push({ start: first.start, end: last.end })
    start = index + needle.length
  }
  return matches
}

// 复算某个 text part 在搜索文档（searchableText 拼接结果）里的偏移区间，
// 用于把文档级命中偏移换算成该 part 文本内的局部偏移。
// 拼接规则必须与 searchableText 完全一致：贡献值之间用 "\n" 连接，且受同一长度上限约束。
export function sessionSearchTextPartRange(input: { parts: Part[]; scope: SessionSearchScope; partID: string }) {
  const seen = new WeakSet<object>()
  const nodes = { value: 0 }
  let length = 0
  let first = true
  for (const part of input.parts) {
    const remaining = () => MAX_SEARCH_DOCUMENT_LENGTH - length - (first ? 0 : 1)
    for (const value of partText(part, input.scope, remaining, seen, nodes)) {
      const prefix = first ? 0 : 1
      const available = MAX_SEARCH_DOCUMENT_LENGTH - length - prefix
      if (available <= 0) return undefined
      const appended = value.slice(0, available)
      const start = length + prefix
      const end = start + appended.length
      if ((part.type === "text" || part.type === "reasoning") && part.id === input.partID) return { start, end }
      length = end
      first = false
    }
    if (length >= MAX_SEARCH_DOCUMENT_LENGTH) break
  }
  return undefined
}

export type SessionTextHit = { start: number; end: number; active?: boolean }

// 计算某个文本 part 里的词级命中；active 标记当前正在查看的那一处命中。
// 命中偏移来自完整搜索文档，因此这里先换算成 part 内的局部偏移。
export function sessionSearchPartHits(input: {
  parts: Part[]
  scope: SessionSearchScope
  query: string
  partID: string
  active?: { start: number; end: number }
}): SessionTextHit[] {
  const target = input.parts.find((part) => part.id === input.partID)
  if (!target || (target.type !== "text" && target.type !== "reasoning") || !input.query) return []
  const range = sessionSearchTextPartRange({ parts: input.parts, scope: input.scope, partID: input.partID })
  if (!range || range.end <= range.start) return []
  const activeStart = input.active ? input.active.start - range.start : -1
  const activeEnd = input.active ? input.active.end - range.start : -1
  return findTextMatches(target.text, input.query.toLocaleLowerCase()).map((hit) => ({
    ...hit,
    active: hit.start === activeStart && hit.end === activeEnd,
  }))
}

// 计算一条用户消息"可见气泡文本"里的词级命中；active 标记当前正在查看的那一处命中。
export function sessionSearchUserMessageHits(input: {
  parts: Part[]
  scope: SessionSearchScope
  query: string
  textPartID: string
  active?: { start: number; end: number }
}): SessionTextHit[] {
  return sessionSearchPartHits({ ...input, partID: input.textPartID })
}

export function nextSessionSearchMatchIndex(current: number, count: number, direction: -1 | 1) {
  if (count <= 0) return 0
  return (current + direction + count) % count
}

// VS Code find 的初始定位语义：锚点是当前阅读位置，
// 取锚点消息之后（含锚点本身）的第一个命中；锚点之后没有命中时，回退到锚点之前最近的命中。
// matches 保持文档顺序（时间序），rowIndexOf 给出用户消息在时间线上的序号。
export function nearestSessionSearchMatchIndex(input: {
  matches: SessionSearchMatch[]
  anchorRowID: string | undefined
  rowIndexOf: (rowID: string) => number
  rowMessageID: (messageID: string) => string
}) {
  if (input.matches.length === 0) return 0
  if (!input.anchorRowID) return 0
  const anchorIndex = input.rowIndexOf(input.anchorRowID)
  if (anchorIndex < 0) return 0
  for (let index = 0; index < input.matches.length; index++) {
    const rowIndex = input.rowIndexOf(input.rowMessageID(input.matches[index].messageID))
    if (rowIndex >= anchorIndex) return index
  }
  for (let index = input.matches.length - 1; index >= 0; index--) {
    const rowIndex = input.rowIndexOf(input.rowMessageID(input.matches[index].messageID))
    if (rowIndex < anchorIndex) return index
  }
  return 0
}

export function preserveSessionSearchActiveIndex(
  previous: SessionSearchMatch | undefined,
  matches: SessionSearchMatch[],
  fallback: number,
) {
  if (matches.length === 0) return 0
  if (previous) {
    const exact = matches.findIndex(
      (match) => match.messageID === previous.messageID && match.start === previous.start && match.end === previous.end,
    )
    if (exact >= 0) return exact
  }
  return Math.min(Math.max(fallback, 0), matches.length - 1)
}

export function hydrateSessionSearchHistory(input: {
  sessionID: () => string | undefined
  ready?: () => boolean
  more: () => boolean
  loading: () => boolean
  loadMore: (sessionID: string, token?: symbol) => Promise<void>
}): Promise<void> {
  const ready = input.ready ?? (() => true)
  const sessionID = input.sessionID()
  if (!sessionID) return Promise.resolve()
  const active = activeHydrations.get(input) ?? new Map<string, { token: symbol; promise: Promise<void> }>()
  const existing = active.get(sessionID)
  if (existing) return existing.promise
  const token = Symbol()
  const promise = createSessionSearchHydrator({ ...input, ready })
    .hydrate(sessionID)
    .finally(() => {
      if (active.get(sessionID)?.token === token) active.delete(sessionID)
    })
  active.set(sessionID, { token, promise })
  activeHydrations.set(input, active)
  return promise
}

export function createSessionSearchHydrator(input: {
  sessionID: () => string | undefined
  ready?: () => boolean
  more: () => boolean
  loading: () => boolean
  loadMore: (sessionID: string, token?: symbol) => Promise<void>
  beforeLoad?: (
    sessionID: string,
  ) => ((done: boolean) => void) | { restore: (done: boolean) => void; cancel: () => void } | undefined
  onRunStart?: (token: symbol) => (() => void) | undefined
  setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (timer: ReturnType<typeof setTimeout>) => void
}) {
  const setTimer = input.setTimeout ?? setTimeout
  const clearTimer = input.clearTimeout ?? clearTimeout
  const runs = new Map<string, { token: symbol; promise: Promise<void> }>()
  const timers = new Map<ReturnType<typeof setTimeout>, () => void>()
  const activeAnchors = new Set<{ cancel: () => void }>()
  let generation = 0
  let disposed = false
  const ready = input.ready ?? (() => true)

  const isCurrent = (sessionID: string, runGeneration = generation) =>
    !disposed && generation === runGeneration && input.sessionID() === sessionID

  const waitForState = () =>
    new Promise<void>((resolve) => {
      const timer = setTimer(() => {
        timers.delete(timer)
        resolve()
      }, 10)
      timers.set(timer, resolve)
    })

  const hydrateRun = (sessionID: string) => {
    if (disposed || input.sessionID() !== sessionID) return { token: Symbol(), promise: Promise.resolve() }
    const existing = runs.get(sessionID)
    if (existing) return existing

    const runGeneration = generation
    const token = Symbol()
    const releaseRun = input.onRunStart?.(token)
    const promise = (async () => {
      try {
        while (isCurrent(sessionID, runGeneration) && (!ready() || input.loading())) await waitForState()
        while (isCurrent(sessionID, runGeneration) && input.more()) {
          while (isCurrent(sessionID, runGeneration) && input.loading()) await waitForState()
          if (!isCurrent(sessionID, runGeneration) || !input.more()) return

          const anchor = input.beforeLoad?.(sessionID)
          const restore = typeof anchor === "function" ? anchor : anchor?.restore
          if (anchor && typeof anchor !== "function") activeAnchors.add(anchor)
          try {
            await input.loadMore(sessionID, token)
          } catch (error) {
            if (isCurrent(sessionID, runGeneration)) restore?.(true)
            throw error
          } finally {
            if (anchor && typeof anchor !== "function") activeAnchors.delete(anchor)
          }
          if (!isCurrent(sessionID, runGeneration)) return
          restore?.(true)
        }
      } finally {
        releaseRun?.()
      }
    })().finally(() => {
      if (runs.get(sessionID)?.token === token) runs.delete(sessionID)
    })
    const run = { token, promise }
    runs.set(sessionID, run)
    return run
  }

  const hydrate = (sessionID: string) => hydrateRun(sessionID).promise

  const invalidate = () => {
    generation += 1
    for (const anchor of activeAnchors) {
      anchor.cancel()
      activeAnchors.delete(anchor)
    }
    runs.clear()
    for (const [timer, resolve] of timers) {
      clearTimer(timer)
      timers.delete(timer)
      resolve()
    }
  }

  return {
    hydrate,
    hydrateRun,
    isCurrent,
    invalidate,
    dispose() {
      disposed = true
      invalidate()
    },
  }
}

export function createSessionSearchRunGate() {
  const active = new Map<string, Set<symbol>>()
  return {
    add(owner: string, token: symbol) {
      const tokens = active.get(owner) ?? new Set<symbol>()
      tokens.add(token)
      active.set(owner, tokens)
      return () => {
        const current = active.get(owner)
        if (!current) return
        current.delete(token)
        if (current.size === 0) active.delete(owner)
      }
    },
    has(owner: string) {
      return active.has(owner)
    },
    remove(owner: string, token: symbol) {
      const tokens = active.get(owner)
      if (!tokens) return
      tokens.delete(token)
      if (tokens.size === 0) active.delete(owner)
    },
  }
}

function normalizeWithOffsets(text: string) {
  const codePoints = Array.from(text)
  const normalized = text.toLocaleLowerCase()
  const offsets: { start: number; end: number }[] = []
  let originalOffset = 0
  let normalizedOffset = 0

  codePoints.forEach((character) => {
    const start = originalOffset
    originalOffset += character.length
    const value = character.toLocaleLowerCase()
    offsets.push(...Array.from({ length: value.length }, () => ({ start, end: originalOffset })))
    normalizedOffset += value.length
  })

  if (normalizedOffset < normalized.length) {
    const last = offsets.at(-1)
    if (last) offsets.push(...Array.from({ length: normalized.length - normalizedOffset }, () => last))
  }

  return { text: normalized, offsets }
}

function* partText(
  part: Part,
  scope: SessionSearchScope,
  remaining: () => number,
  seen: WeakSet<object>,
  nodes: { value: number },
) {
  if (part.type === "text") yield part.text
  if (scope === "conversation") return
  if (part.type === "reasoning") yield part.text
  if (part.type === "subtask") {
    if (remaining() <= 0) return
    yield part.prompt
    if (remaining() <= 0) return
    yield part.description
    if (remaining() <= 0) return
    yield part.agent
  }
  if (part.type === "tool") {
    yield* readableStrings(part.state.input, remaining, seen, nodes)
    if (remaining() <= 0) return
    if (part.state.status === "pending") yield part.state.raw
    if (part.state.status === "completed") {
      if (remaining() <= 0) return
      yield part.state.output
      if (remaining() <= 0) return
      yield part.state.title
    }
    if (part.state.status === "error") {
      if (remaining() <= 0) return
      yield part.state.error
    }
  }
  if (part.type === "step-finish") {
    if (remaining() <= 0) return
    yield part.reason
  }
  if (part.type === "agent") {
    if (remaining() <= 0) return
    yield part.name
    if (remaining() <= 0) return
    if (part.source) yield part.source.value
  }
  if (part.type === "patch") {
    if (remaining() <= 0) return
    const files = part.files
    for (let index = 0; remaining() > 0 && index < files.length; index += 1) {
      yield files[index]
    }
  }
  if (part.type === "retry") yield* readableStrings(part.error.data, remaining, seen, nodes)
  if (part.type === "file" && part.source && remaining() > 0) yield part.source.text.value
}

function* readableStrings(
  value: unknown,
  remaining: () => number,
  seen: WeakSet<object>,
  nodes: { value: number },
  depth = 0,
): Generator<string> {
  if (remaining() <= 0) return
  if (depth > MAX_READABLE_DEPTH || nodes.value >= MAX_READABLE_NODES) return
  if (typeof value === "string") {
    yield value.slice(0, remaining())
    return
  }
  if (!value || typeof value !== "object") return
  if (seen.has(value)) return
  seen.add(value)
  nodes.value += 1
  if (Array.isArray(value)) {
    for (const item of value) {
      yield* readableStrings(item, remaining, seen, nodes, depth + 1)
      if (remaining() <= 0) return
    }
    return
  }
  for (const key of Object.keys(value)) {
    if (remaining() <= 0 || nodes.value >= MAX_READABLE_NODES) return
    yield* readableStrings(value[key as keyof typeof value], remaining, seen, nodes, depth + 1)
    if (remaining() <= 0) return
  }
}
