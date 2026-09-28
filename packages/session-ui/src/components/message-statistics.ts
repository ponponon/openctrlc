export type AssistantStatisticsInput = {
  output: number | undefined
  reasoning?: number | undefined
  created: number | undefined
  completed: number | undefined
}

export type AssistantStatistics = {
  output: number
  reasoning: number
  total: number
  durationMs: number
  tokensPerSecond: number
}

export function assistantStatistics(input: AssistantStatisticsInput): AssistantStatistics | undefined {
  const output = typeof input.output === "number" && Number.isFinite(input.output) ? Math.max(0, input.output) : 0
  const reasoning =
    typeof input.reasoning === "number" && Number.isFinite(input.reasoning) ? Math.max(0, input.reasoning) : 0
  const total = output + reasoning
  if (
    total <= 0 ||
    typeof input.created !== "number" ||
    !Number.isFinite(input.created) ||
    typeof input.completed !== "number" ||
    !Number.isFinite(input.completed) ||
    input.completed <= input.created
  )
    return

  const durationMs = input.completed - input.created
  const tokensPerSecond = (total / durationMs) * 1000
  if (!Number.isFinite(durationMs) || !Number.isFinite(tokensPerSecond)) return

  return {
    output,
    reasoning,
    total,
    durationMs,
    tokensPerSecond,
  }
}
