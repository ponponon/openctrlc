import { describe, expect, test } from "bun:test"
import { titlebarTabStatus } from "./titlebar-tab-status"

describe("titlebarTabStatus", () => {
  test("shows a completion marker for an unseen response", () => {
    expect(titlebarTabStatus(true, false)).toBe("complete")
  })

  test("prioritizes an unseen error marker", () => {
    expect(titlebarTabStatus(true, true)).toBe("error")
  })

  test("clears the marker once the session is viewed", () => {
    expect(titlebarTabStatus(false, false)).toBeUndefined()
    expect(titlebarTabStatus(false, true)).toBeUndefined()
  })
})
