import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { dict as en } from "@/i18n/en"
import { dict as ja } from "@/i18n/ja"
import { dict as ko } from "@/i18n/ko"
import { dict as zh } from "@/i18n/zh"
import { releaseNoteSections } from "@/utils/changelog"
import { loadReleaseHighlights, releaseDescriptionKeys } from "./highlights"

const releasesDir = new URL("../../../../docs/releases/", import.meta.url)

function releaseContent(version: string) {
  return readFileSync(new URL(`v${version}.md`, releasesDir), "utf8").replace(/\r\n?/g, "\n")
}

// changelog.json serves parseMarkdown output (h2/ul/li and inline code HTML),
// so mirror that shape from the stored markdown before releaseNoteSections runs.
function releaseHtml(version: string) {
  return releaseContent(version)
    .split("\n")
    .map((line) => {
      const heading = /^## (.+)$/.exec(line)
      if (heading) return `<h2>${heading[1]}</h2>`
      if (line.startsWith("- ")) {
        const item = line
          .slice(2)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replace(/`([^`]+)`/g, "<code>$1</code>")
        return `<ul><li>${item}</li></ul>`
      }
      return line
    })
    .join("\n")
}

function releaseBullets(version: string) {
  return releaseNoteSections(releaseHtml(version)).flatMap((section) => section.items)
}

describe("release highlight translation keys", () => {
  test("each mapped version's keys exactly match its release-note bullets", () => {
    for (const [version, mapping] of Object.entries(releaseDescriptionKeys)) {
      const items = releaseBullets(version)
      expect(items.length, `v${version} bullets`).toBeGreaterThan(0)
      expect(Object.keys(mapping).sort(), `v${version} mapping`).toEqual([...items].sort())
      for (const [description, key] of Object.entries(mapping)) {
        expect(en[key], `en ${key}`).toBe(description)
      }
    }
  })

  test("the runtime highlight pipeline resolves a key for every shown bullet", () => {
    for (const [version, mapping] of Object.entries(releaseDescriptionKeys)) {
      const highlights = loadReleaseHighlights(
        { releases: [{ tag: `v${version}`, content: releaseHtml(version) }] },
        version,
        undefined,
      )
      expect(highlights.length, `v${version} highlights`).toBeGreaterThan(0)
      expect(highlights.length).toBeLessThanOrEqual(5)
      for (const highlight of highlights) {
        expect(highlight.translationKey, `v${version}: ${highlight.description}`).toBeDefined()
        expect(highlight.translationKey).toBe(mapping[highlight.description])
      }
    }
  })

  test("mapped release notes are translated in every product language", () => {
    const bundles = [["zh", zh] as const, ["ja", ja] as const, ["ko", ko] as const]
    for (const mapping of Object.values(releaseDescriptionKeys)) {
      for (const key of Object.values(mapping)) {
        for (const [locale, dict] of bundles) {
          expect(dict[key], `${locale} ${key}`).toBeDefined()
          expect(dict[key], `${locale} ${key}`).not.toBe(en[key])
        }
      }
    }
  })
})
