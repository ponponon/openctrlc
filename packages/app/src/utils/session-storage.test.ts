import { describe, expect, test } from "bun:test"
import { formatStorageBytes } from "./session-storage"

describe("formatStorageBytes", () => {
  test("uses bytes, kilobytes, and megabytes", () => {
    expect(formatStorageBytes(512)).toBe("512 B")
    expect(formatStorageBytes(199_680)).toBe("195 KB")
    expect(formatStorageBytes(765_952)).toBe("748 KB")
    expect(formatStorageBytes(16_516_826)).toBe("15.8 MB")
    expect(formatStorageBytes(1_048_576)).toBe("1.0 MB")
  })

  test("hides sessions without a projected transcript", () => {
    expect(formatStorageBytes(undefined)).toBe("")
    expect(formatStorageBytes(0)).toBe("")
  })
})
