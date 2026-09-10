import { describe, expect, test } from "bun:test"
import { forkBoundaryAfterMessage } from "./session-fork"

describe("forkBoundaryAfterMessage", () => {
  const messages = [{ id: "user-a" }, { id: "assistant-a" }, { id: "user-b" }, { id: "assistant-b" }]

  test("returns the next message as the exclusive fork boundary", () => {
    expect(forkBoundaryAfterMessage(messages, "assistant-a")).toEqual({ found: true, messageID: "user-b" })
  })

  test("omits the boundary when the selected message is the last message", () => {
    expect(forkBoundaryAfterMessage(messages, "assistant-b")).toEqual({ found: true, messageID: undefined })
  })

  test("reports an unloaded message instead of accidentally copying the full session", () => {
    expect(forkBoundaryAfterMessage(messages, "assistant-missing")).toEqual({ found: false })
  })
})
