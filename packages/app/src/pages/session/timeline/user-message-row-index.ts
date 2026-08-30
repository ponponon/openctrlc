import { TimelineRow } from "./timeline-row"

export function indexUserMessageRows(rows: TimelineRow.TimelineRow[]) {
  const result = new Map<string, number>()
  rows.forEach((row, index) => {
    if (row._tag === "UserMessage") result.set(row.userMessageID, index)
  })
  return result
}

export function includeUserMessageRow(
  indexes: number[],
  messageID: string | undefined,
  userMessageRows: ReadonlyMap<string, number>,
  count: number,
) {
  const index = messageID === undefined ? undefined : userMessageRows.get(messageID)
  if (index === undefined || index < 0 || index >= count) return indexes
  return [...new Set([...indexes, index])].sort((a, b) => a - b)
}
