import { SessionV1 } from "@openctrlc/core/v1/session"

export const RESTART_INTERRUPTION_MESSAGE =
  "The session was interrupted because the OpenCtrlC process restarted before the operation completed."

export type RecoveryChange = {
  message: SessionV1.Assistant
  parts: SessionV1.ToolPart[]
}

export function recoverInterruptedMessages(messages: SessionV1.WithParts[], completed: number): RecoveryChange[] {
  return messages.flatMap((message) => {
    if (message.info.role !== "assistant" || message.info.time.completed !== undefined) return []

    const parts = message.parts.flatMap((part): SessionV1.ToolPart[] => {
      if (part.type !== "tool" || !["pending", "running"].includes(part.state.status)) return []

      const start = part.state.status === "running" ? part.state.time.start : completed
      const metadata = part.state.status === "running" ? part.state.metadata : undefined
      return [
        {
          ...part,
          state: {
            status: "error",
            error: RESTART_INTERRUPTION_MESSAGE,
            input: part.state.input,
            ...(metadata ? { metadata: { ...metadata, interrupted: true } } : { metadata: { interrupted: true } }),
            time: { start, end: completed },
          },
        },
      ]
    })

    if (message.info.finish && parts.length === 0) return []

    return [
      {
        message: {
          ...message.info,
          error: new SessionV1.AbortedError({ message: RESTART_INTERRUPTION_MESSAGE }).toObject(),
          finish: "unknown",
          time: { ...message.info.time, completed },
        },
        parts,
      },
    ]
  })
}

export * as SessionRecovery from "./recovery"
