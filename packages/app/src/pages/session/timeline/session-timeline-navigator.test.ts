import { describe, expect, test } from "bun:test"
import { createSessionTimelineNavigatorEntries } from "./session-timeline-navigator-model"

describe("session timeline navigator entries", () => {
  test("maps user messages to their measured timeline positions", () => {
    const result = createSessionTimelineNavigatorEntries({
      messages: [{ id: "one" }, { id: "two" }],
      rowIndex: new Map([
        ["one", 0],
        ["two", 1],
      ]),
      measurements: [{ start: 40 }, { start: 240 }],
      totalSize: 400,
      getPrompt: (id) => `prompt:${id}`,
      getResponse: () => undefined,
    })

    expect(result).toEqual([
      { id: "one", prompt: "prompt:one", response: undefined, offset: 40, position: 0.1 },
      { id: "two", prompt: "prompt:two", response: undefined, offset: 240, position: 0.6 },
    ])
  })

  test("skips unmeasured rows and clamps marker positions", () => {
    const result = createSessionTimelineNavigatorEntries({
      messages: [{ id: "missing" }, { id: "first" }, { id: "last" }],
      rowIndex: new Map([
        ["missing", 2],
        ["first", 0],
        ["last", 1],
      ]),
      measurements: [{ start: -20 }, { start: 500 }, { start: 700 }],
      totalSize: 400,
      getPrompt: () => "",
      getResponse: (id) => (id === "last" ? "answer" : undefined),
    })

    expect(result).toEqual([
      { id: "missing", prompt: "", response: undefined, offset: 700, position: 1 },
      { id: "first", prompt: "", response: undefined, offset: -20, position: 0 },
      { id: "last", prompt: "", response: "answer", offset: 500, position: 1 },
    ])
  })

  test("returns no entries until the virtual timeline has a size", () => {
    expect(
      createSessionTimelineNavigatorEntries({
        messages: [{ id: "one" }],
        rowIndex: new Map([["one", 0]]),
        measurements: [{ start: 0 }],
        totalSize: 0,
        getPrompt: () => "prompt",
        getResponse: () => undefined,
      }),
    ).toEqual([])
  })
})
