import type { SessionMessageInfo } from "@opencode-ai/client/promise"
import type { Part } from "@openctrlc/sdk/v2/client"

export type SessionSkillSummary = {
  id: string
  name: string
  count: number
}

export function summarizeSessionSkills(input: {
  messages: readonly SessionMessageInfo[]
  parts: readonly Part[]
}): SessionSkillSummary[] {
  const activated = input.messages
    .filter((message): message is Extract<SessionMessageInfo, { type: "skill" }> => message.type === "skill")
    .map((message) => ({ id: message.skill, name: message.name }))

  // Legacy sessions persist skill activation as a completed skill tool part instead
  // of a session.skill.activated message. Only use this fallback when the event
  // projection has no skill records, so a session is not counted twice.
  if (activated.length === 0) {
    activated.push(
      ...input.parts.flatMap((part) => {
        if (part.type !== "tool" || part.tool !== "skill" || part.state.status !== "completed") return []
        const name = readString(part.state.input.name) ?? readString(part.state.metadata?.name)
        if (!name) return []
        return [{ id: name, name }]
      }),
    )
  }

  return Array.from(
    activated
      .reduce((result, skill) => {
        const current = result.get(skill.id)
        result.set(skill.id, {
          id: skill.id,
          name: skill.name,
          count: (current?.count ?? 0) + 1,
        })
        return result
      }, new Map<string, SessionSkillSummary>())
      .values(),
  ).sort((a, b) => a.name.localeCompare(b.name))
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined
}
