import type { Message } from "@openctrlc/sdk/v2/client"

export type ForkBoundary =
  | { found: false }
  | {
      found: true
      messageID: string | undefined
    }

export function forkBoundaryAfterMessage(messages: readonly Pick<Message, "id">[], messageID: string): ForkBoundary {
  const index = messages.findIndex((message) => message.id === messageID)
  if (index < 0) return { found: false }
  return { found: true, messageID: messages[index + 1]?.id }
}
