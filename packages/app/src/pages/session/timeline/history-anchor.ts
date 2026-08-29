export type HistoryAnchorSnapshot = { key: symbol; offset: number; anchor?: string }
export type HistoryAnchorKind = "normal" | "search"

type HistoryAnchorPhase = "pending" | "correcting"

export function startHistoryAnchorCorrection(input: {
  snapshot: HistoryAnchorSnapshot
  resolve: (anchor: string) => { top: number } | undefined
  rootTop: () => number
  scrollBy: (delta: number) => void
  requestFrame: (callback: () => void) => number
  cancelFrame: (frame: number) => void
  settled: () => void
  stableFrames?: number
  maxFrames?: number
}) {
  if (!input.snapshot.anchor) {
    input.settled()
    return
  }

  let frame: number | undefined
  let frames = 0
  let stable = 0
  let active = true
  const stableFrames = input.stableFrames ?? 30
  const maxFrames = input.maxFrames ?? 180

  const apply = () => {
    frame = undefined
    if (!active) return
    const element = input.resolve(input.snapshot.anchor!)
    const delta = element ? element.top - input.rootTop() - input.snapshot.offset : undefined
    if (delta !== undefined && Math.abs(delta) > 0.5) {
      input.scrollBy(delta)
      stable = 0
    } else {
      stable += 1
    }
    frames += 1
    if (stable >= stableFrames || frames >= maxFrames) {
      active = false
      input.settled()
      return
    }
    frame = input.requestFrame(apply)
  }

  frame = input.requestFrame(apply)
  return () => {
    active = false
    if (frame !== undefined) input.cancelFrame(frame)
    frame = undefined
  }
}

export function createHistoryAnchorRegistry(input: {
  snapshot: (kind: HistoryAnchorKind) => HistoryAnchorSnapshot
  restore: (
    snapshot: HistoryAnchorSnapshot,
    done: boolean,
    settled: () => void,
  ) => (() => void) | undefined
  cancel: (snapshot: HistoryAnchorSnapshot) => void
  update?: (snapshot: HistoryAnchorSnapshot) => HistoryAnchorSnapshot
}) {
  type Entry = {
    kind: HistoryAnchorKind
    snapshot: HistoryAnchorSnapshot
    phase: HistoryAnchorPhase
    stop?: () => void
  }
  const active = new Map<symbol, Entry>()

  const stopCorrection = (token: symbol, entry: Entry) => {
    entry.stop?.()
    entry.stop = undefined
    active.delete(token)
  }

  const capture = (kind: HistoryAnchorKind) => {
    const token = Symbol(kind)
    const entry: Entry = { kind, snapshot: input.snapshot(kind), phase: "pending" }
    active.set(token, entry)
    return {
      restore(done: boolean) {
        if (!active.has(token)) return
        if (!done) {
          input.restore(entry.snapshot, false, () => {})
          return
        }
        if (entry.phase === "correcting") return

        for (const [otherToken, other] of active) {
          if (otherToken === token || other.phase !== "correcting") continue
          stopCorrection(otherToken, other)
        }

        entry.phase = "correcting"
        entry.stop = input.restore(entry.snapshot, true, () => {
          if (entry.phase !== "correcting") return
          active.delete(token)
          entry.stop = undefined
        })
      },
      cancel() {
        if (!active.has(token)) return
        if (entry.phase === "correcting") {
          stopCorrection(token, entry)
          return
        }
        active.delete(token)
        input.cancel(entry.snapshot)
      },
    }
  }

  const cancelCorrections = () => {
    for (const [token, entry] of active) {
      if (entry.phase === "correcting") stopCorrection(token, entry)
    }
  }

  const cancelAll = () => {
    for (const [token, entry] of active) {
      if (entry.phase === "correcting") {
        stopCorrection(token, entry)
        continue
      }
      active.delete(token)
      input.cancel(entry.snapshot)
    }
  }

  return {
    capture,
    updatePending() {
      for (const entry of active.values()) {
        if (entry.phase !== "pending") continue
        entry.snapshot = input.update?.(entry.snapshot) ?? input.snapshot(entry.kind)
      }
    },
    has(kind: HistoryAnchorKind) {
      return [...active.values()].some((entry) => entry.kind === kind)
    },
    hasPending() {
      return [...active.values()].some((entry) => entry.phase === "pending")
    },
    hasCorrecting() {
      return [...active.values()].some((entry) => entry.phase === "correcting")
    },
    cancelCorrections,
    cancelAll,
    cleanup: cancelAll,
  }
}
