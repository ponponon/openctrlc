import type { Message, Part, PermissionRequest, QuestionRequest, SessionStatus } from "@openctrlc/sdk/v2/client"

export const SESSION_STALL_THRESHOLD_MS = 90_000
export const SESSION_STALL_CHECK_INTERVAL_MS = 30_000

type AssistantMessage = Extract<Message, { role: "assistant" }>
type ToolPart = Extract<Part, { type: "tool" }>

export type SessionStallDiagnosis = {
  sessionID: string
  messageID: string
  kind: "permission" | "question" | "tool" | "model"
  ageMs: number
  toolNames: string[]
  permissionCount: number
  questionCount: number
  key: string
}

export function diagnoseSessionStall(input: {
  sessionID: string
  status: SessionStatus
  messages: readonly Message[]
  parts: (messageID: string) => readonly Part[]
  permissions: readonly PermissionRequest[]
  questions: readonly QuestionRequest[]
  now: number
  thresholdMs?: number
}): SessionStallDiagnosis | undefined {
  if (input.status.type !== "busy") return undefined

  const latest = input.messages.findLast((message) => message.role === "assistant")
  if (!latest || latest.role !== "assistant" || latest.time.completed !== undefined || latest.error !== undefined)
    return undefined
  const assistant = latest

  const activeTools = input
    .parts(assistant.id)
    .filter(
      (part): part is ToolPart =>
        part.type === "tool" && (part.state.status === "pending" || part.state.status === "running"),
    )
  const activityTimes = activeTools.map((part) =>
    part.state.status === "running" ? part.state.time.start : assistant.time.created,
  )
  const lastActivityAt = Math.max(
    assistant.time.created,
    assistant.time.firstGenerated ?? 0,
    assistant.time.lastGenerated ?? 0,
    ...activityTimes,
  )
  const ageMs = Math.max(0, input.now - lastActivityAt)
  if (ageMs < (input.thresholdMs ?? SESSION_STALL_THRESHOLD_MS)) return undefined

  const kind =
    input.permissions.length > 0
      ? "permission"
      : input.questions.length > 0
        ? "question"
        : activeTools.length > 0
          ? "tool"
          : "model"
  const toolNames = activeTools.map((part) => part.tool)
  const key = [
    kind,
    assistant.id,
    ...input.permissions.map((request) => request.id),
    ...input.questions.map((request) => request.id),
    ...activeTools.map((part) => part.id),
  ].join(":")

  return {
    sessionID: input.sessionID,
    messageID: assistant.id,
    kind,
    ageMs,
    toolNames,
    permissionCount: input.permissions.length,
    questionCount: input.questions.length,
    key,
  }
}
