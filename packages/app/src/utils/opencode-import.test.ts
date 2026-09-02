import { describe, expect, test } from "bun:test"
import { isOpenCodeSessionID } from "./opencode-import"

describe("OpenCode session import", () => {
  test("accepts session IDs supported by OpenCode", () => {
    expect(isOpenCodeSessionID("ses_abc123")).toBe(true)
    expect(isOpenCodeSessionID("  ses_ABC123  ")).toBe(true)
  })

  test("rejects malformed session IDs", () => {
    expect(isOpenCodeSessionID("session_abc123")).toBe(false)
    expect(isOpenCodeSessionID("ses-")).toBe(false)
    expect(isOpenCodeSessionID("ses_abc-123")).toBe(false)
    expect(isOpenCodeSessionID("")).toBe(false)
  })
})
