import type { AssistantMessage, Message, Part } from "@openctrlc/sdk/v2/client"

type Provider = {
  id: string
  name?: string
  models: Record<string, Model | undefined>
}

type Model = {
  name?: string
  limit: {
    context: number
  }
}

type Context = {
  message: AssistantMessage
  provider?: Provider
  model?: Model
  providerLabel: string
  modelLabel: string
  limit: number | undefined
  input: number
  total: number
  usage: number | null
}

const tokenTotal = (msg: AssistantMessage) => {
  return msg.tokens.input + msg.tokens.output + msg.tokens.reasoning + msg.tokens.cache.read + msg.tokens.cache.write
}

export const getMessageTokenTotal = (msg: Message) => {
  if (msg.role !== "assistant") return undefined
  return tokenTotal(msg)
}

export const getMessageTokenDelta = (messages: Message[], index: number) => {
  const message = messages[index]
  if (!message) return undefined

  const current = getMessageTokenTotal(message)
  if (current === undefined) return undefined

  const previous = messages.slice(0, index).findLast((item) => item.role === "assistant")
  const previousTotal = previous ? getMessageTokenTotal(previous) : undefined
  if (previousTotal === undefined) return current

  // Context compaction can make the next recorded total smaller; it is not negative consumption.
  return Math.max(0, current - previousTotal)
}

export const getMessageActivity = (message: Message, parts: Part[]) => {
  if (message.role !== "assistant") return "—"

  const tools = parts.filter((part): part is Extract<Part, { type: "tool" }> => part.type === "tool")
  if (tools.length > 0) {
    const status = ["error", "running", "pending"].find((status) =>
      tools.some((part) => part.state.status === status),
    )
    return `tool: ${[...new Set(tools.map((part) => part.tool))].join(", ")}${status ? ` (${status})` : ""}`
  }

  if (parts.some((part) => part.type === "compaction")) return "compaction"
  const subtask = parts.find((part): part is Extract<Part, { type: "subtask" }> => part.type === "subtask")
  if (subtask) return `subtask: ${subtask.agent}`
  const retry = parts.find((part): part is Extract<Part, { type: "retry" }> => part.type === "retry")
  if (retry) return `retry #${retry.attempt}`
  if (parts.some((part) => part.type === "reasoning")) return "reasoning"
  if (parts.some((part) => part.type === "patch")) return "patch"
  if (parts.some((part) => part.type === "file")) return "attachment"
  const agent = parts.find((part): part is Extract<Part, { type: "agent" }> => part.type === "agent")
  if (agent) return `agent: ${agent.name}`
  if (parts.some((part) => part.type === "text")) return "response"
  if (parts.some((part) => part.type === "step-finish")) return "step"
  return "—"
}

const lastAssistantWithTokens = (messages: Message[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== "assistant") continue
    if (tokenTotal(msg) <= 0) continue
    return msg
  }
}

const build = (messages: Message[] = [], providers: Provider[] = []): Context | undefined => {
  const message = lastAssistantWithTokens(messages)
  if (!message) return undefined

  const provider = providers.find((item) => item.id === message.providerID)
  const model = provider?.models[message.modelID]
  const limit = model?.limit.context
  const total = tokenTotal(message)

  return {
    message,
    provider,
    model,
    providerLabel: provider?.name ?? message.providerID,
    modelLabel: model?.name ?? message.modelID,
    limit,
    input: message.tokens.input,
    total,
    usage: limit ? Math.round((total / limit) * 100) : null,
  }
}

export function getSessionContext(messages: Message[] = [], providers: Provider[] = []) {
  return build(messages, providers)
}
