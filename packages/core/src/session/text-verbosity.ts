export function instruction(level: "default" | "low" | "medium" | "high" | undefined) {
  if (level === "default" || level === undefined) return undefined
  if (level === "low")
    return "Reply detail: low. Keep the final answer concise and direct. Include only information needed to answer the user's request; avoid unnecessary background, repetition, and examples. Preserve required deliverables and essential steps, evidence, and safety information. This setting controls user-facing answer detail only; do not reduce reasoning effort."
  if (level === "medium")
    return "Reply detail: medium. Balance brevity with explanation. Include the key context, steps, reasoning, and caveats needed to understand the answer without repetition. Follow explicit user requests for a different level of detail. This setting controls user-facing answer detail only; do not change reasoning effort."
  return "Reply detail: high. Give a thorough, well-structured final answer with relevant context, reasoning, steps, evidence, and caveats. Include examples when useful, but avoid repetition and do not omit required deliverables. Follow explicit user requests for a different level of detail. This setting controls user-facing answer detail only; do not change reasoning effort."
}

export * as SessionTextVerbosity from "./text-verbosity"
