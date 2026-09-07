export type SessionTimelineNavigatorEntry = {
  id: string
  prompt: string
  response?: string
  offset: number
  position: number
}

export function createSessionTimelineNavigatorEntries(input: {
  messages: readonly { id: string }[]
  rowIndex: ReadonlyMap<string, number>
  measurements: readonly { start: number }[]
  totalSize: number
  getPrompt: (id: string) => string
  getResponse: (id: string) => string | undefined
}) {
  if (input.totalSize <= 0) return []

  return input.messages.flatMap((message) => {
    const row = input.rowIndex.get(message.id)
    if (row === undefined) return []

    const measurement = input.measurements[row]
    if (!measurement) return []

    return [
      {
        id: message.id,
        prompt: input.getPrompt(message.id),
        response: input.getResponse(message.id),
        offset: measurement.start,
        position: Math.max(0, Math.min(1, measurement.start / input.totalSize)),
      },
    ] satisfies SessionTimelineNavigatorEntry[]
  })
}
