import { describe, expect, test } from "bun:test"
import { createHistoryAnchorRegistry, startHistoryAnchorCorrection } from "./history-anchor"

function createHarness() {
  const restored: Array<{ key: symbol; done: boolean }> = []
  const stopped: symbol[] = []
  const settled: Array<() => void> = []
  let snapshot = 0

  const registry = createHistoryAnchorRegistry({
    snapshot: (kind) => ({ key: Symbol(`${kind}-${++snapshot}`), offset: snapshot }),
    restore: (value, done, onSettled) => {
      restored.push({ key: value.key, done })
      if (done) settled.push(onSettled)
      return () => stopped.push(value.key)
    },
    cancel: (value) => stopped.push(value.key),
    update: (value) => ({ ...value, offset: value.offset + 100 }),
  })

  return { registry, restored, stopped, settled }
}

describe("createHistoryAnchorRegistry", () => {
  test("keeps a restored entry correcting until settled", () => {
    const harness = createHarness()
    harness.registry.capture("normal").restore(true)

    expect(harness.registry.hasPending()).toBe(false)
    expect(harness.registry.hasCorrecting()).toBe(true)
    expect(harness.registry.has("normal")).toBe(true)

    harness.settled[0]?.()

    expect(harness.registry.hasCorrecting()).toBe(false)
    expect(harness.registry.has("normal")).toBe(false)
  })

  test("cancels only correcting entries and leaves pending captures independent", () => {
    const harness = createHarness()
    const normal = harness.registry.capture("normal")
    const search = harness.registry.capture("search")
    normal.restore(true)

    harness.registry.cancelCorrections()

    expect(harness.stopped).toHaveLength(1)
    expect(harness.registry.has("normal")).toBe(false)
    expect(harness.registry.has("search")).toBe(true)
    search.cancel()
    expect(harness.stopped).toHaveLength(2)
  })

  test("allows only one correcting entry while preserving pending entries", () => {
    const harness = createHarness()
    const normal = harness.registry.capture("normal")
    const search = harness.registry.capture("search")
    normal.restore(true)
    search.restore(true)

    expect(harness.stopped).toHaveLength(1)
    expect(harness.registry.hasCorrecting()).toBe(true)
    expect(harness.registry.has("normal")).toBe(false)
    expect(harness.registry.has("search")).toBe(true)
  })

  test("updates pending snapshots without retargeting a correction", () => {
    const harness = createHarness()
    const pending = harness.registry.capture("normal")
    harness.registry.updatePending()
    pending.restore(true)
    const correctingOffset = harness.restored[0]?.key

    harness.registry.updatePending()

    expect(correctingOffset).toBeDefined()
    expect(harness.restored).toHaveLength(1)
    expect(harness.restored[0]?.done).toBe(true)
  })

  test("cleanup stops corrections and cancels pending entries", () => {
    const harness = createHarness()
    harness.registry.capture("normal")
    harness.registry.capture("search").restore(true)

    harness.registry.cleanup()

    expect(harness.stopped).toHaveLength(2)
    expect(harness.registry.hasPending()).toBe(false)
    expect(harness.registry.hasCorrecting()).toBe(false)
  })
})

describe("startHistoryAnchorCorrection", () => {
  test("uses the stable snapshot, resolves the element on each frame, and converges", () => {
    const frames: Array<() => void> = []
    const cancelled: number[] = []
    const positions = [120, 101, 100]
    let resolved = 0
    let scrolled = 0
    let settled = 0

    startHistoryAnchorCorrection({
      snapshot: { key: Symbol("anchor"), anchor: "row", offset: 100 },
      resolve: () => ({ top: positions[resolved++] ?? 100 }),
      rootTop: () => 0,
      scrollBy: (delta) => {
        scrolled += delta
      },
      requestFrame: (callback) => {
        frames.push(callback)
        return frames.length
      },
      cancelFrame: (frame) => cancelled.push(frame),
      settled: () => settled++,
      stableFrames: 2,
      maxFrames: 10,
    })

    frames.shift()?.()
    frames.shift()?.()
    frames.shift()?.()
    frames.shift()?.()

    expect(resolved).toBe(4)
    expect(scrolled).toBe(21)
    expect(settled).toBe(1)
    expect(cancelled).toHaveLength(0)
  })

  test("cancels its outstanding frame without needing a scroll event", () => {
    const frames: Array<() => void> = []
    const cancelled: number[] = []
    let settled = 0
    const stop = startHistoryAnchorCorrection({
      snapshot: { key: Symbol("anchor"), anchor: "row", offset: 100 },
      resolve: () => ({ top: 120 }),
      rootTop: () => 0,
      scrollBy: () => {},
      requestFrame: (callback) => {
        frames.push(callback)
        return frames.length
      },
      cancelFrame: (frame) => cancelled.push(frame),
      settled: () => settled++,
    })

    stop?.()
    frames.shift()?.()

    expect(cancelled).toEqual([1])
    expect(settled).toBe(0)
  })

  test("settles at the hard frame limit when the anchor never converges", () => {
    const frames: Array<() => void> = []
    let settled = 0
    startHistoryAnchorCorrection({
      snapshot: { key: Symbol("anchor"), anchor: "row", offset: 0 },
      resolve: () => ({ top: 10 }),
      rootTop: () => 0,
      scrollBy: () => {},
      requestFrame: (callback) => {
        frames.push(callback)
        return frames.length
      },
      cancelFrame: () => {},
      settled: () => settled++,
      stableFrames: 100,
      maxFrames: 2,
    })

    frames.shift()?.()
    frames.shift()?.()

    expect(settled).toBe(1)
  })

  test("does not count missing anchor frames as stable before remount", () => {
    const frames: Array<() => void> = []
    const elements = [undefined, { top: 100 }, { top: 100 }]
    let resolved = 0
    let settled = 0
    startHistoryAnchorCorrection({
      snapshot: { key: Symbol("anchor"), anchor: "row", offset: 100 },
      resolve: () => elements[resolved++],
      rootTop: () => 0,
      scrollBy: () => {},
      requestFrame: (callback) => {
        frames.push(callback)
        return frames.length
      },
      cancelFrame: () => {},
      settled: () => settled++,
      stableFrames: 2,
      maxFrames: 10,
    })

    frames.shift()?.()
    expect(settled).toBe(0)
    frames.shift()?.()
    expect(settled).toBe(0)
    frames.shift()?.()

    expect(resolved).toBe(3)
    expect(settled).toBe(1)
  })
})
