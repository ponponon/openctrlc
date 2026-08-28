export type HistoryAnchorSnapshot = { key: string; offset: number; anchor?: string }
export type HistoryAnchorKind = "normal" | "search"

export function createHistoryAnchorRegistry(input: {
  snapshot: (kind: HistoryAnchorKind) => HistoryAnchorSnapshot
  restore: (snapshot: HistoryAnchorSnapshot, done: boolean) => void
  cancel: (snapshot: HistoryAnchorSnapshot) => void
  update?: (snapshot: HistoryAnchorSnapshot) => HistoryAnchorSnapshot
}) {
  const active = new Map<symbol, { kind: HistoryAnchorKind; snapshot: HistoryAnchorSnapshot; done: boolean }>()

  const capture = (kind: HistoryAnchorKind) => {
    const token = Symbol(kind)
    const entry = { kind, snapshot: input.snapshot(kind), done: false }
    active.set(token, entry)
    return {
      restore(done: boolean) {
        if (entry.done) return
        entry.done = done
        input.restore(entry.snapshot, done)
        if (done) active.delete(token)
      },
      cancel() {
        if (entry.done) return
        entry.done = true
        active.delete(token)
        input.cancel(entry.snapshot)
      },
    }
  }

  return {
    capture,
    update() {
      for (const entry of active.values()) {
        entry.snapshot = input.update?.(entry.snapshot) ?? input.snapshot(entry.kind)
      }
    },
    has(kind: HistoryAnchorKind) {
      return [...active.values()].some((entry) => entry.kind === kind)
    },
    hasAny() {
      return active.size > 0
    },
    cancelAll() {
      for (const [token, entry] of active) {
        entry.done = true
        active.delete(token)
        input.cancel(entry.snapshot)
      }
    },
  }
}
