import type { Message, Part } from "@openctrlc/sdk/v2/client"

export type SessionSearchScope = "conversation" | "all"
export type SessionSearchDocument = { messageID: string; text: string }
export type SessionSearchMatch = { messageID: string; start: number; end: number }

export function isActiveSearchMessage(messageID: string, activeSearchMessageID: string | undefined) {
  return messageID === activeSearchMessageID
}

const MAX_SEARCH_DOCUMENT_LENGTH = 100_000
const activeHydrations = new WeakMap<object, Map<string, { token: symbol; promise: Promise<void> }>>()
export function searchableText(input: { message: Message; parts: Part[]; scope: SessionSearchScope }) {
  const values = input.parts.flatMap((part) => partText(part, input.scope))
  if (input.scope === "all" && input.message.role === "assistant" && input.message.error) {
    values.push(input.message.error.name, ...readableStrings(input.message.error.data))
  }
  return values.join("\n").slice(0, MAX_SEARCH_DOCUMENT_LENGTH)
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

  return documents.flatMap((document) => {
    const normalized = normalizeWithOffsets(document.text)
    const text = normalized.text
    const matches: SessionSearchMatch[] = []
    let start = 0
    while (start < text.length) {
      const index = text.indexOf(needle, start)
      if (index < 0) break
      const first = normalized.offsets[index]
      const last = normalized.offsets[index + needle.length - 1]
      if (first && last) matches.push({ messageID: document.messageID, start: first.start, end: last.end })
      start = index + needle.length
    }
    return matches
  })
}

export function nextSessionSearchMatchIndex(current: number, count: number, direction: -1 | 1) {
  if (count <= 0) return 0
  return (current + direction + count) % count
}

export function preserveSessionSearchActiveIndex(
  previous: SessionSearchMatch | undefined,
  matches: SessionSearchMatch[],
  fallback: number,
) {
  if (matches.length === 0) return 0
  if (previous) {
    const exact = matches.findIndex(
      (match) =>
        match.messageID === previous.messageID && match.start === previous.start && match.end === previous.end,
    )
    if (exact >= 0) return exact
  }
  return Math.min(Math.max(fallback, 0), matches.length - 1)
}

export function hydrateSessionSearchHistory(input: {
  sessionID: () => string | undefined
  more: () => boolean
  loading: () => boolean
  loadMore: (sessionID: string, token?: symbol) => Promise<void>
}): Promise<void> {
  const sessionID = input.sessionID()
  if (!sessionID || !input.more()) return Promise.resolve()
  const active = activeHydrations.get(input) ?? new Map<string, { token: symbol; promise: Promise<void> }>()
  const existing = active.get(sessionID)
  if (existing) return existing.promise
  const token = Symbol()
  const promise = createSessionSearchHydrator(input).hydrate(sessionID).finally(() => {
    if (active.get(sessionID)?.token === token) active.delete(sessionID)
  })
  active.set(sessionID, { token, promise })
  activeHydrations.set(input, active)
  return promise
}

export function createSessionSearchHydrator(input: {
  sessionID: () => string | undefined
  more: () => boolean
  loading: () => boolean
  loadMore: (sessionID: string, token?: symbol) => Promise<void>
  beforeLoad?: (sessionID: string) =>
    | ((done: boolean) => void)
    | { restore: (done: boolean) => void; cancel: () => void }
    | undefined
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
    if (disposed || input.sessionID() !== sessionID || !input.more()) return { token: Symbol(), promise: Promise.resolve() }
    const existing = runs.get(sessionID)
    if (existing) return existing

    const runGeneration = generation
    const token = Symbol()
    const releaseRun = input.onRunStart?.(token)
    const promise = (async () => {
      try {
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

function partText(part: Part, scope: SessionSearchScope) {
  if (part.type === "text") return [part.text]
  if (scope === "conversation") return []
  if (part.type === "reasoning") return [part.text]
  if (part.type === "subtask") return [part.prompt, part.description, part.agent]
  if (part.type === "tool") {
    const values = readableStrings(part.state.input)
    if (part.state.status === "pending") values.push(part.state.raw)
    if (part.state.status === "completed") values.push(part.state.output, part.state.title)
    if (part.state.status === "error") values.push(part.state.error)
    return values
  }
  if (part.type === "step-finish") return [part.reason]
  if (part.type === "agent") return [part.name, ...(part.source ? [part.source.value] : [])]
  if (part.type === "patch") return part.files
  if (part.type === "retry") return readableStrings(part.error.data)
  if (part.type === "file" && part.source) return [part.source.text.value]
  return []
}

function readableStrings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (!value || typeof value !== "object") return []
  if (Array.isArray(value)) return value.flatMap(readableStrings)
  return Object.values(value).flatMap(readableStrings)
}
