import { describe, expect, test } from "bun:test"
import { readdir } from "node:fs/promises"
import { LOCALES, detectFromAcceptLanguage, detectFromLanguages, docs, fromDocsPathname, parseLocale } from "./language"

describe("product locales", () => {
  test("Console and Stats load dictionaries only for supported locales", async () => {
    const directories = [
      new URL("../i18n/", import.meta.url),
      new URL("../../../../stats/app/src/i18n/", import.meta.url),
    ]
    const files = await Promise.all(directories.map((directory) => readdir(directory)))

    expect(LOCALES).toEqual(["en", "zh", "ja", "ko"])
    expect(files[0].filter((file) => /^[a-z]{2,3}\.ts$/.test(file)).sort()).toEqual([
      "en.ts",
      "ja.ts",
      "ko.ts",
      "zh.ts",
    ])
    expect(files[1].filter((file) => /^[a-z]{2,3}\.ts$/.test(file)).sort()).toEqual(["ja.ts", "ko.ts", "zh.ts"])
  })

  test("unsupported stored locales fall back while detection prefers a supported language", () => {
    expect(parseLocale("de")).toBeNull()
    expect(parseLocale("zht")).toBeNull()
    expect(detectFromLanguages(["de-DE", "ja-JP"])).toBe("ja")
    expect(detectFromLanguages(["de-DE"])).toBe("en")
    expect(detectFromAcceptLanguage("de;q=1, ko;q=0.8")).toBe("ko")
    expect(detectFromAcceptLanguage("de")).toBe("en")
  })

  test("only supported documentation locales are recognized and generated", () => {
    expect(fromDocsPathname("/docs/zh-CN/config")).toBe("zh")
    expect(fromDocsPathname("/docs/de/config")).toBeNull()
    expect(docs("zh", "/docs/config")).toBe("/docs/zh-cn/config")
    expect(docs("ja", "/docs/config")).toBe("/docs/ja/config")
  })
})
