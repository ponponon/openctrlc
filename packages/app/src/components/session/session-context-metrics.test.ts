import { describe, expect, test } from "bun:test"
import type { Message, Part } from "@openctrlc/sdk/v2/client"
import { getMessageActivity, getMessageTokenDelta, getMessageTokenTotal, getSessionContext } from "./session-context-metrics"

const assistant = (
  id: string,
  tokens: { input: number; output: number; reasoning: number; read: number; write: number },
  cost: number,
  providerID = "openai",
  modelID = "gpt-4.1",
) => {
  return {
    id,
    role: "assistant",
    providerID,
    modelID,
    cost,
    tokens: {
      input: tokens.input,
      output: tokens.output,
      reasoning: tokens.reasoning,
      cache: {
        read: tokens.read,
        write: tokens.write,
      },
    },
    time: { created: 1 },
  } as unknown as Message
}

const user = (id: string) => {
  return {
    id,
    role: "user",
    cost: 0,
    time: { created: 1 },
  } as unknown as Message
}

describe("getSessionContext", () => {
  test("returns the recorded total for assistant messages and no value for user messages", () => {
    const message = assistant("a1", { input: 600, output: 200, reasoning: 100, read: 50, write: 50 }, 0.5)

    expect(getMessageTokenTotal(message)).toBe(1000)
    expect(getMessageTokenTotal(user("u1"))).toBeUndefined()
  })

  test("returns the token difference from the previous assistant message", () => {
    const messages = [
      user("u1"),
      assistant("a1", { input: 600, output: 200, reasoning: 100, read: 50, write: 50 }, 0.5),
      user("u2"),
      assistant("a2", { input: 900, output: 300, reasoning: 100, read: 100, write: 100 }, 0.75),
      assistant("a3", { input: 500, output: 100, reasoning: 50, read: 50, write: 50 }, 1),
    ]

    expect(getMessageTokenDelta(messages, 0)).toBeUndefined()
    expect(getMessageTokenDelta(messages, 1)).toBe(1000)
    expect(getMessageTokenDelta(messages, 3)).toBe(500)
    expect(getMessageTokenDelta(messages, 4)).toBe(0)
  })

  test("summarizes assistant activity and tool names", () => {
    const message = assistant("a1", { input: 10, output: 5, reasoning: 0, read: 0, write: 0 }, 0)
    const parts = [
      { type: "tool", tool: "read", state: { status: "completed" } },
      { type: "tool", tool: "read", state: { status: "completed" } },
      { type: "tool", tool: "bash", state: { status: "completed" } },
    ] as unknown as Part[]

    expect(getMessageActivity(message, parts)).toBe("tool: read, bash")
    expect(
      getMessageActivity(
        message,
        [{ type: "tool", tool: "read", state: { status: "error" } }] as unknown as Part[],
      ),
    ).toBe("tool: read (error)")
    expect(getMessageActivity(message, [{ type: "reasoning" }] as unknown as Part[])).toBe("reasoning")
    expect(getMessageActivity(message, [{ type: "text" }] as unknown as Part[])).toBe("response")
    expect(getMessageActivity(message, [{ type: "step-finish" }] as unknown as Part[])).toBe("step")
    expect(getMessageActivity(message, [])).toBe("—")
    expect(getMessageActivity(user("u1"), parts)).toBe("—")
  })

  test("computes token totals and usage from latest assistant with tokens", () => {
    const messages = [
      user("u1"),
      assistant("a1", { input: 600, output: 200, reasoning: 100, read: 50, write: 50 }, 0.5),
      assistant("a2", { input: 300, output: 100, reasoning: 50, read: 25, write: 25 }, 1.25),
    ]
    const providers = [
      {
        id: "openai",
        name: "OpenAI",
        models: {
          "gpt-4.1": {
            name: "GPT-4.1",
            limit: { context: 1000 },
          },
        },
      },
    ]

    const ctx = getSessionContext(messages, providers)

    expect(ctx?.message.id).toBe("a2")
    expect(ctx?.total).toBe(500)
    expect(ctx?.input).toBe(300)
    expect(ctx?.usage).toBe(50)
    expect(ctx?.providerLabel).toBe("OpenAI")
    expect(ctx?.modelLabel).toBe("GPT-4.1")
  })

  test("preserves fallback labels and null usage when model metadata is missing", () => {
    const messages = [assistant("a1", { input: 40, output: 10, reasoning: 0, read: 0, write: 0 }, 0.1, "p-1", "m-1")]
    const providers = [{ id: "p-1", models: {} }]

    const ctx = getSessionContext(messages, providers)

    expect(ctx?.providerLabel).toBe("p-1")
    expect(ctx?.modelLabel).toBe("m-1")
    expect(ctx?.limit).toBeUndefined()
    expect(ctx?.usage).toBeNull()
  })

  test("recomputes when message array is mutated in place", () => {
    const messages = [assistant("a1", { input: 10, output: 10, reasoning: 10, read: 10, write: 10 }, 0.25)]
    const providers = [{ id: "openai", models: {} }]

    const one = getSessionContext(messages, providers)
    messages.push(assistant("a2", { input: 100, output: 20, reasoning: 0, read: 0, write: 0 }, 0.75))
    const two = getSessionContext(messages, providers)

    expect(one?.message.id).toBe("a1")
    expect(two?.message.id).toBe("a2")
  })

  test("returns undefined when inputs are undefined", () => {
    const ctx = getSessionContext(undefined, undefined)

    expect(ctx).toBeUndefined()
  })
})
