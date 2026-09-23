import { describe, expect, test, vi } from "bun:test"
import { createScrollPersistence } from "./layout-scroll"

describe("createScrollPersistence", () => {
  test("debounces persisted scroll writes", () => {
    vi.useFakeTimers()
    try {
      const snapshot = {
        session: {
          review: { x: 0, y: 0 },
        },
      } as Record<string, Record<string, { x: number; y: number }>>
      const writes: Array<Record<string, { x: number; y: number }>> = []
      const scroll = createScrollPersistence({
        debounceMs: 10,
        getSnapshot: (sessionKey) => snapshot[sessionKey],
        onFlush: (sessionKey, next) => {
          snapshot[sessionKey] = next
          writes.push(next)
        },
      })

      for (const i of Array.from({ length: 30 }, (_, n) => n + 1)) {
        scroll.setScroll("session", "review", { x: 0, y: i })
      }

      vi.advanceTimersByTime(9)
      expect(writes).toHaveLength(0)

      vi.advanceTimersByTime(1)

      expect(writes).toHaveLength(1)
      expect(writes[0]?.review).toEqual({ x: 0, y: 30 })

      scroll.setScroll("session", "review", { x: 0, y: 30 })
      vi.advanceTimersByTime(20)

      expect(writes).toHaveLength(1)
      scroll.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  test("reseeds empty cache after persisted snapshot loads", () => {
    const snapshot = {
      session: {},
    } as Record<string, Record<string, { x: number; y: number }>>

    const scroll = createScrollPersistence({
      getSnapshot: (sessionKey) => snapshot[sessionKey],
      onFlush: () => {},
    })

    expect(scroll.scroll("session", "review")).toBeUndefined()

    snapshot.session = {
      review: { x: 12, y: 34 },
    }

    expect(scroll.scroll("session", "review")).toEqual({ x: 12, y: 34 })
    scroll.dispose()
  })

  test("keeps the follow flag across position writes and reloads", () => {
    vi.useFakeTimers()
    try {
      const snapshot = {} as Record<string, Record<string, { x: number; y: number; follow?: boolean }>>
      const scroll = createScrollPersistence({
        debounceMs: 10,
        getSnapshot: (sessionKey) => snapshot[sessionKey],
        onFlush: (sessionKey, next) => {
          snapshot[sessionKey] = next
        },
      })

      scroll.setScroll("session", "timeline", { x: 0, y: 1200, follow: false })
      vi.advanceTimersByTime(10)

      expect(snapshot.session?.timeline).toEqual({ x: 0, y: 1200, follow: false })
      expect(scroll.scroll("session", "timeline")?.follow).toBe(false)

      // A newer persisted snapshot must not override a session that is already cached.
      const reloaded = createScrollPersistence({
        getSnapshot: (sessionKey) => snapshot[sessionKey],
        onFlush: () => {},
      })
      expect(reloaded.scroll("session", "timeline")).toEqual({ x: 0, y: 1200, follow: false })

      // `follow` is optional: a position written without the flag keeps it absent, so a
      // session that never recorded an intent is not mistaken for a paused one.
      scroll.setScroll("session", "review", { x: 0, y: 5 })
      vi.advanceTimersByTime(10)
      expect(snapshot.session?.review).toEqual({ x: 0, y: 5 })
      expect(scroll.scroll("session", "review")?.follow).toBeUndefined()

      scroll.dispose()
      reloaded.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
})
