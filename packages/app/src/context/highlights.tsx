import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@openctrlc/ui/context"
import { useDialog } from "@openctrlc/ui/context/dialog"
import { usePlatform } from "@/context/platform"
import { useSettings } from "@/context/settings"
import { persisted } from "@/utils/persist"
import { DialogReleaseNotes, type Highlight } from "@/components/dialog-release-notes"
import { CHANGELOG_URL, normalizeReleaseVersion, releaseNoteSections } from "@/utils/changelog"
import type { dict } from "@/i18n/en"

type Store = {
  version?: string
}

type ParsedRelease = {
  tag?: string
  highlights: Highlight[]
  content?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.trim()
    return text.length > 0 ? text : undefined
  }

  if (typeof value === "number") return String(value)
  return
}

function parseMedia(value: unknown, alt: string): Highlight["media"] | undefined {
  if (!isRecord(value)) return
  const type = getText(value.type)?.toLowerCase()
  const src = getText(value.src) ?? getText(value.url)
  if (!src) return
  if (type !== "image" && type !== "video") return

  return { type, src, alt }
}

function parseHighlight(value: unknown): Highlight | undefined {
  if (!isRecord(value)) return

  const title = getText(value.title)
  if (!title) return

  const description = getText(value.description) ?? getText(value.shortDescription)
  if (!description) return

  const media = parseMedia(value.media, title)
  return { title, description, media }
}

function parseRelease(value: unknown): ParsedRelease | undefined {
  if (!isRecord(value)) return
  const tag = getText(value.tag) ?? getText(value.tag_name) ?? getText(value.name)
  const content = getText(value.content)

  if (!Array.isArray(value.highlights)) {
    return { tag, highlights: [], content }
  }

  const highlights = value.highlights.flatMap((group) => {
    if (!isRecord(group)) return []

    const source = getText(group.source)
    if (!source) return []
    if (!source.toLowerCase().includes("desktop")) return []

    if (Array.isArray(group.items)) {
      return group.items.map((item) => parseHighlight(item)).filter((item): item is Highlight => item !== undefined)
    }

    const item = parseHighlight(group)
    if (!item) return []
    return [item]
  })

  return { tag, highlights, content }
}

function parseChangelog(value: unknown): ParsedRelease[] | undefined {
  if (Array.isArray(value)) {
    return value.map(parseRelease).filter((release): release is ParsedRelease => release !== undefined)
  }

  if (!isRecord(value)) return
  if (!Array.isArray(value.releases)) return

  return value.releases.map(parseRelease).filter((release): release is ParsedRelease => release !== undefined)
}

function sliceHighlights(input: { releases: ParsedRelease[]; current?: string; previous?: string }) {
  const current = normalizeReleaseVersion(input.current)
  const previous = normalizeReleaseVersion(input.previous)
  const releases = input.releases

  const start = (() => {
    if (!current) return 0
    const index = releases.findIndex((release) => normalizeReleaseVersion(release.tag) === current)
    return index === -1 ? 0 : index
  })()

  const end = (() => {
    if (!previous) return releases.length
    const index = releases.findIndex((release, i) => i >= start && normalizeReleaseVersion(release.tag) === previous)
    return index === -1 ? releases.length : index
  })()

  const releaseDescriptionKeys: Record<string, Record<string, keyof typeof dict>> = {
    "1.1.4": {
      "Kept the session context panel responsive when switching between session tabs, with cached snapshots, virtualized raw messages, and faster token usage calculations.":
        "dialog.releaseNotes.v1_1_4.contextPanel",
      "Made remote device authorization easier to review with recent activity ordering, full local timestamps, and clearer expiration reminders.":
        "dialog.releaseNotes.v1_1_4.remoteAuthorization",
      "Added clearer guidance on the mobile pairing page for finding and approving a new device request in the desktop app.":
        "dialog.releaseNotes.v1_1_4.mobilePairing",
      "Fixed virtualized session and file rows failing during rapid updates, stale reads, or recursive size measurement.":
        "dialog.releaseNotes.v1_1_4.virtualRows",
      "Preserved the active session panel while switching tabs to avoid unnecessary reloads and recomputation.":
        "dialog.releaseNotes.v1_1_4.sessionTabs",
    },
    "1.1.5": {
      "Combined remote desktop, connection route, and lite-network status in the title bar; open the control to inspect the route and switch between saved desktops.":
        "dialog.releaseNotes.v1_1_5.remoteDesktopStatus",
      "Improved portrait phone navigation and session interactions, and kept Review and context panels stable when switching session tabs.":
        "dialog.releaseNotes.v1_1_5.mobileNavigation",
      "Made remote access recovery clearer and improved loading of the remote workspace.":
        "dialog.releaseNotes.v1_1_5.remoteRecovery",
      "Fixed virtualized rows and session loading failures during rapid updates, scrolling, and tab changes.":
        "dialog.releaseNotes.v1_1_5.sessionLoading",
      "Fixed packaged desktop startup failures on Linux caused by loading TypeScript source files as external dependencies.":
        "dialog.releaseNotes.v1_1_5.linuxStartup",
      "Fixed mobile toolbar overlap and scroll behavior that could hide content or unexpectedly jump to the bottom.":
        "dialog.releaseNotes.v1_1_5.mobileToolbar",
    },
    "1.1.6": {
      "Title-bar connection controls now compact automatically when open session tabs use up available space, keeping key actions accessible.":
        "dialog.releaseNotes.v1_1_6.connectionControls",
      "Added an optional `?debug=layout` overlay that reports viewport and session-frame measurements for layout troubleshooting.":
        "dialog.releaseNotes.v1_1_6.layoutDiagnostics",
      "The session composer now wraps controls according to its panel width, so split-screen and narrow side panels remain usable.":
        "dialog.releaseNotes.v1_1_6.responsiveComposer",
      "Fixed title-bar controls getting squeezed and focus indicators disappearing around clipped or scrollable UI.":
        "dialog.releaseNotes.v1_1_6.focusAndTitlebar",
      "Stale embedded CSS and JavaScript asset URLs now return 404 instead of the app HTML, preventing mixed-version pages from breaking.":
        "dialog.releaseNotes.v1_1_6.staleAssets",
    },
  }
  const highlights = releases.slice(start, end).flatMap((release) => {
    const version = normalizeReleaseVersion(release.tag)
    const items =
      release.highlights.length > 0
        ? release.highlights
        : releaseNoteSections(release.content).flatMap((section) =>
            section.items.map((description) => ({ title: section.title, description })),
          )
    return items.map((item) => ({
      ...item,
      translationKey: version ? releaseDescriptionKeys[version]?.[item.description] : undefined,
    }))
  })
  const seen = new Set<string>()
  const unique = highlights.filter((highlight) => {
    const key = dedupeKey(highlight)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return unique.slice(0, 5)
}

function dedupeKey(highlight: Highlight) {
  return [highlight.title, highlight.description, highlight.media?.type ?? "", highlight.media?.src ?? ""].join("\n")
}

function loadReleaseHighlights(value: unknown, current?: string, previous?: string) {
  const releases = parseChangelog(value)
  if (!releases?.length) return []
  return sliceHighlights({ releases, current, previous })
}

export const { use: useHighlights, provider: HighlightsProvider } = createSimpleContext({
  name: "Highlights",
  gate: false,
  init: () => {
    const platform = usePlatform()
    const dialog = useDialog()
    const settings = useSettings()
    const [store, setStore, _, ready] = persisted("highlights.v1", createStore<Store>({ version: undefined }))

    const [range, setRange] = createStore({
      from: undefined as string | undefined,
      to: undefined as string | undefined,
    })
    const state = { started: false }
    let timer: ReturnType<typeof setTimeout> | undefined

    const clearTimer = () => {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
    }

    const markSeen = () => {
      if (!platform.version) return
      setStore("version", platform.version)
    }

    const start = (previous: string) => {
      if (!settings.general.releaseNotes()) {
        markSeen()
        return
      }

      const fetcher = platform.fetch ?? fetch
      const controller = new AbortController()
      onCleanup(() => {
        controller.abort()
        clearTimer()
      })

      fetcher(CHANGELOG_URL, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then((response) => (response.ok ? (response.json() as Promise<unknown>) : undefined))
        .then((json) => {
          if (!json) return
          const highlights = loadReleaseHighlights(json, platform.version, previous)
          if (controller.signal.aborted) return

          if (highlights.length === 0) {
            markSeen()
            return
          }

          timer = setTimeout(() => {
            timer = undefined
            markSeen()
            dialog.show(() => <DialogReleaseNotes highlights={highlights} />)
          }, 500)
        })
        .catch(() => undefined)
    }

    createEffect(() => {
      if (state.started) return
      if (!ready()) return
      if (!settings.ready()) return
      if (!platform.version) return
      state.started = true

      const previous = store.version
      if (!previous) {
        setStore("version", platform.version)
        return
      }

      if (previous === platform.version) return

      setRange({ from: previous, to: platform.version })
      start(previous)
    })

    return {
      ready,
      from: () => range.from,
      to: () => range.to,
      get last() {
        return store.version
      },
      markSeen,
    }
  },
})
