import type { Message, Part } from "@openctrlc/sdk/v2/client"

export type SessionSearchScope = "conversation" | "all"
export type SessionSearchDocument = { messageID: string; text: string }
export type SessionSearchMatch = { messageID: string; start: number; end: number }

const MAX_SEARCH_DOCUMENT_LENGTH = 100_000
const activeHydrations = new WeakMap<
  (sessionID: string) => Promise<void>,
  Map<string, Promise<void>>
>()

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
    const text = document.text.toLocaleLowerCase()
    const matches: SessionSearchMatch[] = []
    let start = 0
    while (start < text.length) {
      const index = text.indexOf(needle, start)
      if (index < 0) break
      matches.push({ messageID: document.messageID, start: index, end: index + query.length })
      start = index + needle.length
    }
    return matches
  })
}

export function nextSessionSearchMatchIndex(current: number, count: number, direction: -1 | 1) {
  if (count <= 0) return 0
  return (current + direction + count) % count
}

export function hydrateSessionSearchHistory(input: {
  sessionID: () => string | undefined
  more: () => boolean
  loading: () => boolean
  loadMore: (sessionID: string) => Promise<void>
}): Promise<void> {
  if (input.loading() || !input.more()) return Promise.resolve()

  const sessionID = input.sessionID()
  if (!sessionID) return Promise.resolve()

  const activeForLoader = activeHydrations.get(input.loadMore) ?? new Map<string, Promise<void>>()
  const existing = activeForLoader.get(sessionID)
  if (existing) return existing

  const hydration = (async () => {
    while (input.more()) {
      if (input.loading()) return
      await input.loadMore(sessionID)
    }
  })().finally(() => {
    activeForLoader.delete(sessionID)
  })
  activeForLoader.set(sessionID, hydration)
  activeHydrations.set(input.loadMore, activeForLoader)
  return hydration
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
