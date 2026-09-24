import { describe, expect, test } from "bun:test"
import { readdir } from "node:fs/promises"
import { docsLocale, exactLocale, locale, matchLocale } from "./locales"

describe("documentation locales", () => {
  test("only English, Simplified Chinese, Japanese, and Korean are configured", () => {
    expect(locale).toEqual(["root", "ja", "ko", "zh-cn"])
    expect(docsLocale).toEqual(["ja", "ko", "zh-cn"])
  })

  test("browser languages resolve only to supported locales", () => {
    expect(exactLocale("en")).toBe("root")
    expect(exactLocale("zh-cn")).toBe("zh-cn")
    expect(exactLocale("de")).toBeNull()
    expect(matchLocale("ja-JP")).toBe("ja")
    expect(matchLocale("ko-KR")).toBe("ko")
    expect(matchLocale("zh-TW")).toBe("zh-cn")
    expect(matchLocale("de-DE")).toBeNull()
  })

  test("interface dictionaries and translated docs exist only for supported locales", async () => {
    const [dictionaries, docs] = await Promise.all([
      readdir(new URL("../content/i18n/", import.meta.url)),
      readdir(new URL("../content/docs/", import.meta.url), { withFileTypes: true }),
    ])

    expect(dictionaries.filter((file) => file.endsWith(".json")).sort()).toEqual([
      "en.json",
      "ja.json",
      "ko.json",
      "zh-CN.json",
    ])
    expect(
      docs
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(["ja", "ko", "zh-cn"])
  })
})
