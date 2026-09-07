import { findLast } from "@openctrlc/core/util/array"
import type { UserMessage } from "@openctrlc/sdk/v2/client"

export function getSessionSystemPrompt(messages: readonly UserMessage[]) {
  const effective = findLast(messages, (message) => Boolean(message.systemPrompt?.trim()))?.systemPrompt
  const fallback = findLast(messages, (message) => Boolean(message.system?.trim()))?.system
  return effective?.trim() || fallback?.trim()
}
