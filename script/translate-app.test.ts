import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import {
  APP_TRANSLATION_LOCALES,
  findDrift,
  glossaryFile,
  modelVariants,
  parseTranslationArgs,
  runPool,
  sessionIDFromEvents,
  sessionModels,
  targetFiles,
  textFromEvents,
  translationConfig,
  unexpectedChanges,
} from "./translate-app"

describe("translate app", () => {
  test("defaults to MiMo Token Plan for the supported locale set", () => {
    expect(parseTranslationArgs(["ja"])).toEqual({
      target: "ja",
      concurrency: 1,
      model: "xiaomi-token-plan-cn/mimo-v2.6-flash",
      variant: undefined,
      dryRun: false,
      check: false,
      help: false,
    })
  })

  test("parses all locales with bounded concurrency overrides", () => {
    expect(
      parseTranslationArgs([
        "all",
        "--concurrency",
        "7",
        "--model",
        "opencode/gpt-5.4",
        "--variant",
        "high",
        "--dry-run",
      ]),
    ).toEqual({
      target: "all",
      concurrency: 7,
      model: "opencode/gpt-5.4",
      variant: "high",
      dryRun: true,
      check: false,
      help: false,
    })
  })

  test("limits the all target to the three supported non-English locales", () => {
    expect(APP_TRANSLATION_LOCALES).toEqual(["zh", "ja", "ko"])
  })

  test("rejects unsupported targets and invalid concurrency", () => {
    expect(() => parseTranslationArgs(["en"])).toThrow("Unknown locale")
    expect(() => parseTranslationArgs(["ja", "ko"])).toThrow("one locale")
    expect(() => parseTranslationArgs(["de"])).toThrow("Unknown locale")
    expect(() => parseTranslationArgs(["all", "--concurrency", "0"])).toThrow("positive integer")
  })

  test("parses fresh-process parity checks without requesting translation", () => {
    expect(parseTranslationArgs(["ja", "--check"]).check).toBe(true)
  })

  test("limits each locale to its app surfaces", () => {
    expect(targetFiles("ja")).toEqual([
      "packages/app/src/i18n/ja.ts",
      "packages/ui/src/i18n/ja.ts",
      "packages/desktop/src/renderer/i18n/ja.ts",
    ])
    expect(targetFiles("ko")).toEqual([
      "packages/app/src/i18n/ko.ts",
      "packages/ui/src/i18n/ko.ts",
      "packages/desktop/src/renderer/i18n/ko.ts",
    ])
    expect(targetFiles("zh")).toEqual([
      "packages/app/src/i18n/zh.ts",
      "packages/ui/src/i18n/zh.ts",
      "packages/desktop/src/renderer/i18n/zh.ts",
    ])
  })

  test("maps product locale codes to their glossaries", () => {
    expect(glossaryFile("zh")).toBe(".openctrlc/glossary/zh-cn.md")
    expect(glossaryFile("ja")).toBe(".openctrlc/glossary/ja.md")
    expect(glossaryFile("ko")).toBe(".openctrlc/glossary/ko.md")
  })

  test("uses the OpenCtrlC project namespace in translation tooling", async () => {
    const source = await fs.readFile(path.join(import.meta.dir, "translate-app.ts"), "utf8")
    expect(source).toContain("OPENCTRLC_CONFIG_CONTENT")
    expect(source).not.toContain("OPENCODE_CONFIG_CONTENT")
    expect(source).toContain(".openctrlc/glossary")
    expect(source).not.toContain(".opencode/glossary")
  })

  test("finds key and placeholder drift", () => {
    expect(
      findDrift(
        { keep: "Hello {{name}}", missing: "Missing", changed: "{{one}} {{two}}" },
        { keep: "Bonjour {{name}}", extra: "Extra", changed: "{{one}}" },
      ),
    ).toEqual({ missing: ["missing"], extra: ["extra"], placeholders: ["changed"] })
  })

  test("accepts locale-specific CLDR plural variants", () => {
    expect(
      findDrift(
        { "files.one": "{{count}} file", "files.other": "{{count}} files" },
        {
          "files.one": "{{count}} ملف",
          "files.two": "ملفان: {{count}}",
          "files.few": "{{count}} ملفات",
          "files.many": "{{count}} ملفًا",
          "files.zero": "{{count}} ملف",
          "files.other": "{{count}} ملف",
        },
        "ar",
      ),
    ).toEqual({ missing: [], extra: [], placeholders: [] })
  })

  test("reports missing locale-specific CLDR plural variants", () => {
    const drift = findDrift(
      { "files.one": "{{count}} file", "files.other": "{{count}} files" },
      { "files.one": "{{count}} ملف", "files.other": "{{count}} ملف" },
      "ar",
    )
    expect(drift.missing).toContain("files.few")
  })

  test("reports placeholder drift in locale-specific CLDR plural variants", () => {
    const drift = findDrift(
      { "files.one": "{{count}} file", "files.other": "{{count}} files" },
      {
        "files.one": "{{count}} ملف",
        "files.two": "ملفان: {{count}}",
        "files.few": "{{count}} ملفات",
        "files.many": "ملفات كثيرة",
        "files.zero": "{{count}} ملف",
        "files.other": "{{count}} ملف",
      },
      "ar",
    )
    expect(drift.placeholders).toContain("files.many")
  })

  test("runs work with the requested maximum concurrency", async () => {
    const active = new Set<number>()
    const peaks: number[] = []
    const result = await runPool([1, 2, 3, 4, 5], 2, async (item) => {
      active.add(item)
      peaks.push(active.size)
      await Bun.sleep(5)
      active.delete(item)
      return item * 2
    })

    expect(result).toEqual([2, 4, 6, 8, 10])
    expect(Math.max(...peaks)).toBe(2)
  })

  test("reads the actual model and variant from the completed session", () => {
    expect(sessionIDFromEvents('shared: https://example.test\n{"type":"step_start","sessionID":"ses_test"}\n')).toBe(
      "ses_test",
    )
    expect(
      sessionModels({
        messages: [
          { info: { role: "user" } },
          {
            info: {
              role: "assistant",
              providerID: "opencode",
              modelID: "gpt-5.5",
              variant: "xhigh",
            },
          },
        ],
      }),
    ).toEqual([{ model: "opencode/gpt-5.5", variant: "xhigh" }])
    expect(
      textFromEvents(
        'shared: https://example.test\n{"type":"text","sessionID":"ses_test","part":{"text":"finished"}}\n',
      ),
    ).toBe("finished")
  })

  test("resolves variants from verbose model output", () => {
    const output = `opencode/other
{"variants":{}}
opencode/gpt-5.5
{"variants":{"high":{"reasoningEffort":"high"},"xhigh":{"reasoningEffort":"xhigh"}}}
opencode/next
{"variants":{}}
`
    expect(modelVariants(output, "opencode/gpt-5.5")).toEqual({
      high: { reasoningEffort: "high" },
      xhigh: { reasoningEffort: "xhigh" },
    })
  })

  test("supports models that use their provider default variant", () => {
    expect(
      modelVariants(
        'xiaomi-token-plan-cn/mimo-v2.6-flash\n{"name":"MiMo-V2.6-Flash"}\n',
        "xiaomi-token-plan-cn/mimo-v2.6-flash",
      ),
    ).toEqual({})
  })

  test("disables side effects and scopes edits for the translation agent", () => {
    const config = translationConfig("translate-app-ja", "opencode/gpt-5.5", ["packages/app/src/i18n/ja.ts"])
    expect(config.share).toBe("disabled")
    expect(config.formatter).toBe(false)
    expect(config.lsp).toBe(false)
    expect(config.agent["translate-app-ja"].permission.webfetch).toBe("allow")
    expect(config.agent["translate-app-ja"].permission.websearch).toBe("allow")
    expect(config.agent["translate-app-ja"].permission.edit).toEqual({
      "*": "deny",
      "packages/app/src/i18n/ja.ts": "allow",
    })
  })

  test("detects edits outside the locale targets", () => {
    expect(
      unexpectedChanges(
        { "script/translate-app.ts": "before" },
        {
          "script/translate-app.ts": "before",
          "packages/app/src/i18n/ja.ts": "translated",
          "packages/app/src/app.tsx": "unexpected",
        },
        ["packages/app/src/i18n/ja.ts"],
      ),
    ).toEqual(["packages/app/src/app.tsx"])
    expect(unexpectedChanges({ "already-dirty.ts": "before" }, { "already-dirty.ts": "after" }, [])).toEqual([
      "already-dirty.ts",
    ])
  })
})
