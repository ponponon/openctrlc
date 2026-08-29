import { describe, expect, test } from "bun:test"
import type { AssistantMessage, Message, Part } from "@openctrlc/sdk/v2/client"
import {
  createSessionSearchDocuments,
  createSessionSearchIndex,
  findSessionSearchMatches,
  hydrateSessionSearchHistory,
  nextSessionSearchMatchIndex,
  preserveSessionSearchActiveIndex,
  createSessionSearchHydrator,
  createSessionSearchRunGate,
  searchableText,
} from "./session-search"
import { createHistoryAnchorRegistry } from "./timeline/history-anchor"

const user = (id: string): Message => ({
  id,
  sessionID: "session",
  role: "user",
  time: { created: 1 },
  agent: "agent",
  model: { providerID: "provider", modelID: "model" },
})

const assistant = (id: string): AssistantMessage => ({
  id,
  sessionID: "session",
  role: "assistant",
  time: { created: 2 },
  parentID: "user",
  modelID: "model",
  providerID: "provider",
  mode: "build",
  agent: "agent",
  path: { cwd: "/tmp", root: "/tmp" },
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

const part = (value: object) => value as unknown as Part

describe("searchableText", () => {
  test("includes readable text parts in the default conversation scope", () => {
    const text = searchableText({
      message: user("user-1"),
      parts: [
        part({ type: "text", text: "User request" }),
        part({ type: "reasoning", text: "private reasoning" }),
        part({ type: "file", mime: "image/png", url: "data:image/png;base64,encoded" }),
      ],
      scope: "conversation",
    })

    expect(text).toBe("User request")
  })

  test("includes assistant text parts in the default conversation scope", () => {
    expect(
      searchableText({
        message: assistant("assistant-1"),
        parts: [part({ type: "text", text: "assistant answer" }), part({ type: "reasoning", text: "hidden" })],
        scope: "conversation",
      }),
    ).toBe("assistant answer")
  })

  test("includes reasoning, tool values, and error text in the all-content scope", () => {
    const text = searchableText({
      message: {
        ...assistant("assistant-1"),
        error: { name: "UnknownError", data: { message: "provider failed" } },
      },
      parts: [
        part({ type: "text", text: "visible answer" }),
        part({ type: "reasoning", text: "private reasoning" }),
        part({
          type: "tool",
          tool: "bash",
          state: {
            status: "completed",
            input: { command: "bun test", nested: { path: "src/app.ts" } },
            output: "tool output",
            title: "Bash",
            metadata: {},
            time: { start: 1, end: 2 },
          },
        }),
      ],
      scope: "all",
    })

    expect(text).toContain("visible answer")
    expect(text).toContain("private reasoning")
    expect(text).toContain("bun test")
    expect(text).toContain("src/app.ts")
    expect(text).toContain("tool output")
    expect(text).toContain("provider failed")
  })

  test("skips unsupported values instead of stringifying them", () => {
    const text = searchableText({
      message: user("user-1"),
      parts: [
        part({ type: "text", text: "readable" }),
        part({ type: "file", mime: "application/octet-stream", url: "data:application/octet-stream;base64:binary" }),
        part({ type: "snapshot", snapshot: { large: "object" } }),
      ],
      scope: "all",
    })

    expect(text).toBe("readable")
    expect(text).not.toContain("[object Object]")
    expect(text).not.toContain("binary")
  })
})

describe("createSessionSearchDocuments", () => {
  test("preserves message order and bounds each document", () => {
    const messages = [user("first"), assistant("second")]
    const documents = createSessionSearchDocuments({
      messages,
      parts: (messageID) => [part({ type: "text", text: messageID === "first" ? "a" : "b".repeat(100_001) })],
      scope: "conversation",
    })

    expect(documents[0]).toEqual({ messageID: "first", text: "a" })
    expect(documents[1]?.messageID).toBe("second")
    expect(documents[1]?.text.length).toBe(100_000)
  })

  test("creates a document even when a message has no readable parts", () => {
    expect(
      createSessionSearchDocuments({ messages: [user("user-1")], parts: () => [], scope: "conversation" }),
    ).toEqual([{ messageID: "user-1", text: "" }])
  })

  test("does not extract documents while search is closed or query is empty", () => {
    let calls = 0
    const input = {
      messages: [user("user-1")],
      parts: () => {
        calls += 1
        return [part({ type: "text", text: "needle" })]
      },
      scope: "conversation" as const,
    }

    expect(createSessionSearchIndex({ ...input, open: false, query: "needle" })).toEqual([])
    expect(createSessionSearchIndex({ ...input, open: true, query: "" })).toEqual([])
    expect(calls).toBe(0)
    expect(createSessionSearchIndex({ ...input, open: true, query: "needle" })).toEqual([
      { messageID: "user-1", text: "needle" },
    ])
    expect(calls).toBe(1)
  })
})

describe("findSessionSearchMatches", () => {
  test("finds case-insensitive non-overlapping matches with document offsets", () => {
    expect(findSessionSearchMatches([{ messageID: "message-1", text: "Ababa foo FOO" }], "foo")).toEqual([
      { messageID: "message-1", start: 6, end: 9 },
      { messageID: "message-1", start: 10, end: 13 },
    ])
  })

  test("preserves document order and original offsets across documents", () => {
    expect(
      findSessionSearchMatches(
        [
          { messageID: "first", text: "prefix needle" },
          { messageID: "second", text: "needle suffix needle" },
        ],
        "NEEDLE",
      ),
    ).toEqual([
      { messageID: "first", start: 7, end: 13 },
      { messageID: "second", start: 0, end: 6 },
      { messageID: "second", start: 14, end: 20 },
    ])
  })

  test("maps expanded lowercase Unicode matches back to original UTF-16 offsets", () => {
    expect(findSessionSearchMatches([{ messageID: "unicode", text: "İfoo" }], "i\u0307f")).toEqual([
      { messageID: "unicode", start: 0, end: 2 },
    ])
  })

  test("uses contextual lowercase rules for Greek final sigma", () => {
    expect(findSessionSearchMatches([{ messageID: "greek", text: "ΟΣ" }], "ος")).toEqual([
      { messageID: "greek", start: 0, end: 2 },
    ])
  })

  test("maps matches at the end of the maximum-size document", () => {
    const text = `${"a".repeat(99_997)}İfoo`

    expect(findSessionSearchMatches([{ messageID: "long", text }], "i\u0307f")).toEqual([
      { messageID: "long", start: 99_997, end: 99_999 },
    ])
  })

  test("returns no matches for an empty query or missing text", () => {
    const documents = [{ messageID: "message-1", text: "content" }, { messageID: "message-2", text: "" }]
    expect(findSessionSearchMatches(documents, "")).toEqual([])
    expect(findSessionSearchMatches(documents, "missing")).toEqual([])
  })
})

describe("nextSessionSearchMatchIndex", () => {
  test("wraps forward and backward at both ends", () => {
    expect(nextSessionSearchMatchIndex(0, 3, -1)).toBe(2)
    expect(nextSessionSearchMatchIndex(2, 3, 1)).toBe(0)
    expect(nextSessionSearchMatchIndex(1, 3, 1)).toBe(2)
  })

  test("returns zero when there are no matches", () => {
    expect(nextSessionSearchMatchIndex(4, 0, 1)).toBe(0)
  })
})

describe("preserveSessionSearchActiveIndex", () => {
  test("keeps the active match when results are recomputed", () => {
    const previous = { messageID: "message-2", start: 3, end: 8 }
    const matches = [
      { messageID: "message-1", start: 0, end: 5 },
      previous,
      { messageID: "message-3", start: 1, end: 6 },
    ]

    expect(preserveSessionSearchActiveIndex(previous, matches, 1)).toBe(1)
  })

  test("falls back to the nearest result when the active match disappears", () => {
    const previous = { messageID: "message-2", start: 3, end: 8 }
    const matches = [
      { messageID: "message-1", start: 0, end: 5 },
      { messageID: "message-3", start: 1, end: 6 },
    ]

    expect(preserveSessionSearchActiveIndex(previous, matches, 1)).toBe(1)
    expect(preserveSessionSearchActiveIndex(previous, [], 1)).toBe(0)
  })
})

describe("hydrateSessionSearchHistory", () => {
  test("waits for loading history metadata before treating more=false as exhausted", async () => {
    let more = false
    let loading = true
    const calls: string[] = []

    const hydration = hydrateSessionSearchHistory({
      sessionID: () => "session-1",
      ready: () => true,
      more: () => more,
      loading: () => loading,
      loadMore: async (sessionID) => {
        calls.push(sessionID)
        more = false
      },
    })

    await Promise.resolve()
    expect(calls).toEqual([])
    more = true
    loading = false
    await hydration

    expect(calls).toEqual(["session-1"])
  })

  test("waits for initial history readiness before treating more=false as exhausted", async () => {
    let ready = false
    let remaining = 0
    const calls: string[] = []
    const hydration = hydrateSessionSearchHistory({
      sessionID: () => "session-1",
      ready: () => ready,
      more: () => remaining > 0,
      loading: () => false,
      loadMore: async (sessionID) => {
        calls.push(sessionID)
        remaining -= 1
      },
    })

    await Promise.resolve()
    expect(calls).toEqual([])
    ready = true
    remaining = 2
    await hydration
    expect(calls).toEqual(["session-1", "session-1"])
  })

  test("loads pages until history is exhausted", async () => {
    let remaining = 3
    const calls: string[] = []

    await hydrateSessionSearchHistory({
      sessionID: () => "session-1",
      more: () => remaining > 0,
      loading: () => false,
      loadMore: async (sessionID) => {
        calls.push(sessionID)
        remaining -= 1
      },
    })

    expect(calls).toEqual(["session-1", "session-1", "session-1"])
  })

  test("does not load when there is no session and waits for an existing load", async () => {
    let calls = 0
    let loading = true
    const loadMore = async () => {
      calls += 1
    }

    await hydrateSessionSearchHistory({ sessionID: () => undefined, ready: () => true, more: () => true, loading: () => false, loadMore })
    const hydration = hydrateSessionSearchHistory({
      sessionID: () => "session-1",
      more: () => calls < 1,
      loading: () => loading,
      loadMore,
    })
    loading = false
    await hydration

    expect(calls).toBe(1)
  })

  test("waits instead of succeeding while pagination is externally loading", async () => {
    let loading = false
    let remaining = 2
    let release: (() => void) | undefined
    let started: (() => void) | undefined
    const firstPageStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    const firstPage = new Promise<void>((resolve) => {
      release = resolve
    })
    const loadMore = async () => {
      if (remaining === 2) {
        loading = true
        started?.()
        await firstPage
        loading = false
      }
      remaining -= 1
    }

    const hydration = hydrateSessionSearchHistory({
      sessionID: () => "session-1",
      more: () => remaining > 0,
      loading: () => loading,
      loadMore,
    })
    await firstPageStarted
    let settled = false
    hydration.then(() => {
      settled = true
    })
    await Promise.resolve()

    expect(settled).toBe(false)
    release?.()
    await hydration
    expect(remaining).toBe(0)
  })

  test("prevents concurrent duplicate pagination and propagates failures", async () => {
    let release: (() => void) | undefined
    let calls = 0
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const loadMore = async () => {
      calls += 1
      await pending
      throw new Error("history unavailable")
    }
    const input = { sessionID: () => "session-1", more: () => true, loading: () => false, loadMore }
    const first = hydrateSessionSearchHistory(input)
    const second = hydrateSessionSearchHistory(input)

    expect(calls).toBe(1)
    release?.()
    await expect(first).rejects.toThrow("history unavailable")
    await expect(second).rejects.toThrow("history unavailable")
  })
})

describe("createSessionSearchHydrator", () => {
  test("invalidates stale loads and clears its timer on dispose", async () => {
    let sessionID: string | undefined = "session-1"
    let more = true
    let loading = true
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const timers: ReturnType<typeof setTimeout>[] = []
    let cleared = 0
    const hydrator = createSessionSearchHydrator({
      sessionID: () => sessionID,
      more: () => more,
      loading: () => loading,
      loadMore: async () => pending,
      setTimeout: (callback: () => void, delay: number) => {
        const timer = setTimeout(callback, delay)
        timers.push(timer)
        return timer
      },
      clearTimeout: (timer) => {
        cleared += 1
        clearTimeout(timer)
      },
    })

    const run = hydrator.hydrate("session-1")
    hydrator.dispose()
    sessionID = undefined
    more = false
    loading = false
    release?.()

    await run
    expect(timers).toHaveLength(1)
    expect(cleared).toBe(1)
    expect(hydrator.isCurrent("session-1")).toBe(false)
  })

  test("joins duplicate requests and permits retry after failure", async () => {
    let remaining = 1
    let calls = 0
    let fail = true
    let release: (() => void) | undefined
    let pending = Promise.resolve()
    const hydrator = createSessionSearchHydrator({
      sessionID: () => "session-1",
      more: () => remaining > 0,
      loading: () => false,
      loadMore: async () => {
        calls += 1
        pending = new Promise<void>((resolve) => {
          release = resolve
        })
        await pending
        if (fail) {
          fail = false
          throw new Error("history failed")
        }
        remaining = 0
      },
      setTimeout,
      clearTimeout,
    })

    const first = hydrator.hydrate("session-1")
    const joined = hydrator.hydrate("session-1")
    await Promise.resolve()
    expect(calls).toBe(1)
    expect(first).toBe(joined)
    release?.()
    await expect(first).rejects.toThrow("history failed")
    await expect(joined).rejects.toThrow("history failed")
    const retry = hydrator.hydrate("session-1")
    release?.()
    await retry

    expect(calls).toBe(2)
  })

  test("cancels a captured anchor when an in-flight page becomes stale", async () => {
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let captured = 0
    let restored = 0
    let cancelled = 0
    const hydrator = createSessionSearchHydrator({
      sessionID: () => "session-1",
      more: () => true,
      loading: () => false,
      loadMore: async () => pending,
      beforeLoad: () => ({
        restore: () => {
          restored += 1
        },
        cancel: () => {
          cancelled += 1
        },
      }),
    })

    const run = hydrator.hydrate("session-1")
    captured += 1
    hydrator.invalidate()
    expect(captured).toBe(1)
    expect(cancelled).toBe(1)
    expect(restored).toBe(0)
    release?.()
    await run
    expect(restored).toBe(0)
  })

  test("isolates an old pending run from a reopened run for the same session", async () => {
    let calls = 0
    let releaseOld: (() => void) | undefined
    let releaseNew: (() => void) | undefined
    const oldPending = new Promise<void>((resolve) => {
      releaseOld = resolve
    })
    const newPending = new Promise<void>((resolve) => {
      releaseNew = resolve
    })
    const hydrator = createSessionSearchHydrator({
      sessionID: () => "session-1",
      more: () => calls < 2,
      loading: () => false,
      loadMore: async () => {
        calls += 1
        await (calls === 1 ? oldPending : newPending)
      },
    })

    const oldRun = hydrator.hydrateRun("session-1")
    await Promise.resolve()
    hydrator.invalidate()
    const newRun = hydrator.hydrateRun("session-1")
    expect(newRun.token).not.toBe(oldRun.token)
    releaseOld?.()
    await oldRun.promise
    expect(calls).toBe(2)
    releaseNew?.()
    await newRun.promise
  })

  test("does not cancel an ordinary anchor when search hydration is invalidated", async () => {
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let ordinaryCancelled = 0
    let searchCancelled = 0
    const hydrator = createSessionSearchHydrator({
      sessionID: () => "session-1",
      more: () => true,
      loading: () => false,
      loadMore: async () => pending,
      beforeLoad: () => ({ restore: () => {}, cancel: () => searchCancelled++ }),
    })

    const ordinaryAnchor = { cancel: () => ordinaryCancelled++ }
    const run = hydrator.hydrate("session-1")
    hydrator.invalidate()
    release?.()
    await run
    expect(searchCancelled).toBe(1)
    expect(ordinaryCancelled).toBe(0)
  })

  test("restores captured anchors and releases run ownership on success and failure", async () => {
    let remaining = 2
    let fail = false
    let activeRuns = 0
    let restored = 0
    let cancelled = 0
    const hydrator = createSessionSearchHydrator({
      sessionID: () => "session-1",
      more: () => remaining > 0,
      loading: () => false,
      beforeLoad: () => ({
        restore: () => {
          restored += 1
        },
        cancel: () => {
          cancelled += 1
        },
      }),
      loadMore: async () => {
        remaining -= 1
        if (fail) throw new Error("history failed")
      },
      onRunStart: () => {
        activeRuns += 1
        return () => {
          activeRuns -= 1
        }
      },
    })

    await hydrator.hydrate("session-1")
    expect(activeRuns).toBe(0)
    expect(restored).toBe(2)
    expect(cancelled).toBe(0)

    remaining = 1
    fail = true
    await expect(hydrator.hydrate("session-1")).rejects.toThrow("history failed")
    expect(activeRuns).toBe(0)
    expect(restored).toBe(3)
    expect(cancelled).toBe(0)
  })
})

describe("createSessionSearchRunGate", () => {
  test("tracks hydration runs by current session owner", () => {
    const gate = createSessionSearchRunGate()
    const first = Symbol("first")
    const second = Symbol("second")
    const releaseFirst = gate.add("owner-1", first)

    expect(gate.has("owner-1")).toBe(true)
    expect(gate.has("owner-2")).toBe(false)
    gate.add("owner-1", second)
    expect(gate.has("owner-1")).toBe(true)
    releaseFirst()
    expect(gate.has("owner-1")).toBe(true)
    gate.remove("owner-1", second)
    expect(gate.has("owner-1")).toBe(false)
  })
})

describe("createHistoryAnchorRegistry", () => {
  test("isolates ordinary and search controllers on the same timeline registry", () => {
    const cancelled: symbol[] = []
    const restored: symbol[] = []
    let snapshot = 0
    const registry = createHistoryAnchorRegistry({
      snapshot: (kind) => ({ key: Symbol(kind), offset: ++snapshot }),
      restore: (value) => {
        restored.push(value.key)
        return () => {}
      },
      cancel: (value) => cancelled.push(value.key),
    })

    const ordinary = registry.capture("normal")
    const search = registry.capture("search")
    search?.cancel()

    expect(cancelled).toHaveLength(1)
    expect(registry.has("normal")).toBe(true)
    expect(registry.has("search")).toBe(false)

    ordinary?.restore(true)
    expect(restored).toHaveLength(1)
    expect(registry.has("normal")).toBe(true)
    registry.cleanup()
    expect(registry.has("normal")).toBe(false)
  })

  test("updates each active controller with its own timeline snapshot", () => {
    const restored: symbol[] = []
    let snapshot = 0
    const registry = createHistoryAnchorRegistry({
      snapshot: (kind) => ({ key: Symbol(`${kind}-${++snapshot}`), offset: snapshot }),
      restore: (value, done, settled) => {
        restored.push(value.key)
        if (done) settled()
        return () => {}
      },
      cancel: () => undefined,
    })

    const ordinary = registry.capture("normal")
    const search = registry.capture("search")
    registry.updatePending()
    ordinary?.restore(true)
    search?.restore(true)

    expect(restored).toHaveLength(2)
  })
})
