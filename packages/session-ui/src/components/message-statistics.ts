export type AssistantStatisticsInput = {
  output: number | undefined
  reasoning?: number | undefined
  created: number | undefined
  completed: number | undefined
  requestStarted?: number | undefined
  firstGenerated?: number | undefined
  lastGenerated?: number | undefined
  generationDuration?: number | undefined
  providerCompleted?: number | undefined
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
  const start = [input.firstGenerated, input.requestStarted, input.created].find(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  )
  const end = [input.lastGenerated, input.providerCompleted, input.completed].find(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && start !== undefined && value > start,
  )
  if (total <= 0 || start === undefined || end === undefined || end <= start) return

  const generationDuration =
    typeof input.generationDuration === "number" && Number.isFinite(input.generationDuration)
      ? input.generationDuration
      : undefined
  const durationMs = generationDuration !== undefined && generationDuration > 0 ? generationDuration : end - start
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
