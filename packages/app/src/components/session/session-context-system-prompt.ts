import type { UserMessage } from "@openctrlc/sdk/v2/client"

export function getSessionSystemPrompt(messages: readonly UserMessage[], snapshot?: string) {
  const sessionSnapshot = snapshot?.trim()
  if (sessionSnapshot) return sessionSnapshot
  const effective = messages.find((message) => Boolean(message.systemPrompt?.trim()))?.systemPrompt
  const fallback = messages.find((message) => Boolean(message.system?.trim()))?.system
  return effective?.trim() || fallback?.trim()
}
