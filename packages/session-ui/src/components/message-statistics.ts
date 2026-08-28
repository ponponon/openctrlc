export type AssistantStatisticsInput = {
  output: number | undefined
  created: number | undefined
  completed: number | undefined
}

export type AssistantStatistics = {
  output: number
  durationMs: number
  tokensPerSecond: number
}

export function assistantStatistics(input: AssistantStatisticsInput): AssistantStatistics | undefined {
  if (
    typeof input.output !== "number" ||
    typeof input.created !== "number" ||
    typeof input.completed !== "number" ||
    !Number.isFinite(input.output) ||
    !Number.isFinite(input.created) ||
    !Number.isFinite(input.completed) ||
    input.output <= 0 ||
    input.completed <= input.created
  ) {
    return
  }

  const durationMs = input.completed - input.created
  return {
    output: input.output,
    durationMs,
    tokensPerSecond: (input.output / durationMs) * 1000,
  }
}
