import { describe, expect, test } from "bun:test"
import type { UserMessage } from "@openctrlc/sdk/v2/client"
import { getSessionSystemPrompt } from "./session-context-system-prompt"

const user = (id: string, fields: Partial<UserMessage> = {}) =>
  ({ id, role: "user", time: { created: 1 }, ...fields }) as UserMessage

describe("getSessionSystemPrompt", () => {
  test("prefers the effective prompt over the user override", () => {
    expect(
      getSessionSystemPrompt([
        user("u1", { system: "user override" }),
        user("u2", { systemPrompt: "  effective prompt  " }),
      ]),
    ).toBe("effective prompt")
  })

  test("falls back to the user override for older sessions", () => {
    expect(getSessionSystemPrompt([user("u1", { system: "  legacy prompt  " })])).toBe("legacy prompt")
  })
})
