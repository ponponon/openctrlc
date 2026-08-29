import { TimelineRow } from "./timeline-row"

export function indexUserMessageRows(rows: TimelineRow.TimelineRow[]) {
  const result = new Map<string, number>()
  rows.forEach((row, index) => {
    if (row._tag === "UserMessage") result.set(row.userMessageID, index)
  })
  return result
}
