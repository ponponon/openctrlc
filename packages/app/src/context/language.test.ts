import { describe, expect, test } from "bun:test"
import { normalizeLocale } from "./language"

describe("supported application languages", () => {
  test("keeps only English, Simplified Chinese, Japanese, and Korean", () => {
    expect(["en", "zh", "ja", "ko"].map(normalizeLocale)).toEqual(["en", "zh", "ja", "ko"])
    expect(["zht", "de", "es", "fr"].map(normalizeLocale)).toEqual(["en", "en", "en", "en"])
  })
})
