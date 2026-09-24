export type PendingOutputRow = { key: string; size: number }

export type PendingOutputMark = {
  keys: ReadonlySet<string>
  lastContentKey?: string
  lastContentSize: number
}

const EPHEMERAL_PREFIXES = ["thinking:", "retry:", "turn-gap:", "turn-divider:", "diff-summary:"]

function isEphemeralKey(key: string) {
  return EPHEMERAL_PREFIXES.some((prefix) => key.startsWith(prefix))
}

// 离开底部时打水位：记录当时全部行 key，以及最后一个“内容行”的 key/高度。
// 计数只看水位集合之后新出现的 key 或内容行自身增高，历史 prepend 与 Thinking 等尾部占位不会误计。
export function capturePendingOutputMark(input: { rows: readonly PendingOutputRow[] }): PendingOutputMark {
  const keys = new Set(input.rows.map((row) => row.key))
  const lastContent = [...input.rows].reverse().find((row) => !isEphemeralKey(row.key))
  return {
    keys,
    lastContentKey: lastContent?.key,
    lastContentSize: lastContent?.size ?? 0,
  }
}

export function pendingOutputCount(input: {
  mark: PendingOutputMark | undefined
  rows: readonly PendingOutputRow[]
  growThreshold?: number
}): number {
  const mark = input.mark
  if (!mark) return 0
  const threshold = input.growThreshold ?? 24

  // 从第一个仍存在的水位行起，统计其后未见过的 key；水位前的新 key 是历史 prepend。
  let firstSeenIndex = -1
  for (let index = 0; index < input.rows.length; index += 1) {
    if (mark.keys.has(input.rows[index]!.key)) {
      firstSeenIndex = index
      break
    }
  }
  const from = firstSeenIndex < 0 ? 0 : firstSeenIndex
  let unseen = 0
  for (let index = from; index < input.rows.length; index += 1) {
    if (!mark.keys.has(input.rows[index]!.key)) unseen += 1
  }

  let grew = 0
  if (mark.lastContentKey) {
    const row = input.rows.find((item) => item.key === mark.lastContentKey)
    if (row && row.size > mark.lastContentSize + threshold) grew = 1
    // 内容行被重组替换（例如 shell 行并入 steps）也算有新输出。
    if (!row && unseen === 0) grew = 1
  }

  return Math.max(unseen, grew)
}
