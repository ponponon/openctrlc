export const CHANGELOG_URL = "https://openctrlc.pages.dev/changelog.json"
export const CHANGELOG_PAGE_URL = "https://openctrlc.pages.dev/changelog"

export type ReleaseNoteSection = {
  title: string
  items: string[]
}

export type ReleaseNote = {
  tag: string
  date?: string
  url?: string
  sections: ReleaseNoteSection[]
}

export function normalizeReleaseVersion(value: string | undefined) {
  const text = value?.trim()
  if (!text) return
  return text.startsWith("v") || text.startsWith("V") ? text.slice(1) : text
}

export function releaseNoteSections(content: string | undefined): ReleaseNoteSection[] {
  if (!content || typeof DOMParser === "undefined") return []

  const document = new DOMParser().parseFromString(content, "text/html")
  return Array.from(document.body.querySelectorAll("h2"))
    .flatMap((heading) => {
      const title = heading.textContent?.trim()
      if (!title || /^(downloads|full changelog|contributors?)$/i.test(title)) return []

      const items: string[] = []
      let node = heading.nextElementSibling
      while (node && !/^H[1-3]$/.test(node.tagName)) {
        if (node.matches("ul, ol")) {
          items.push(
            ...Array.from(node.querySelectorAll(":scope > li"))
              .map((item) => item.textContent?.trim())
              .filter((item): item is string => !!item),
          )
        }
        node = node.nextElementSibling
      }

      return items.length ? [{ title, items }] : []
    })
    .filter((section) => section.items.length > 0)
}

export function findReleaseNote(value: unknown, version: string): ReleaseNote | undefined {
  if (!isRecord(value) || !Array.isArray(value.releases)) return

  const release = value.releases.find(
    (item) => isRecord(item) && normalizeReleaseVersion(getText(item.tag)) === normalizeReleaseVersion(version),
  )
  if (!isRecord(release)) return

  const tag = getText(release.tag)
  if (!tag) return

  const url = getText(release.url)
  return {
    tag,
    date: getText(release.date),
    url: url?.startsWith("https://github.com/ponponon/openctrlc/releases/") ? url : undefined,
    sections: releaseNoteSections(getText(release.content)),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getText(value: unknown): string | undefined {
  if (typeof value !== "string") return
  const text = value.trim()
  return text.length > 0 ? text : undefined
}
