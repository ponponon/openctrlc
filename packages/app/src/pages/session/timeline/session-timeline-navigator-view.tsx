import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, type Accessor } from "solid-js"
import { Icon } from "@openctrlc/ui/icon"
import { useLanguage } from "@/context/language"
import type { SessionTimelineNavigatorEntry } from "./session-timeline-navigator-model"
import "./session-timeline-navigator.css"

export function SessionTimelineNavigator(props: {
  entries: Accessor<SessionTimelineNavigatorEntry[]>
  viewport: Accessor<HTMLDivElement | undefined>
  onNavigate: (id: string) => void
}) {
  const language = useLanguage()
  const [hoveredID, setHoveredID] = createSignal<string>()
  const [scrollTop, setScrollTop] = createSignal(0)
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const clearHideTimer = () => {
    if (hideTimer === undefined) return
    clearTimeout(hideTimer)
    hideTimer = undefined
  }

  const showPreview = (id: string) => {
    clearHideTimer()
    setHoveredID(id)
  }

  const hidePreview = () => {
    clearHideTimer()
    hideTimer = setTimeout(() => {
      hideTimer = undefined
      setHoveredID(undefined)
    }, 100)
  }

  const navigateToEntry = (entry: SessionTimelineNavigatorEntry | undefined) => {
    if (!entry) return

    clearHideTimer()
    setHoveredID(undefined)
    props.onNavigate(entry.id)
  }

  const navigateToBoundary = (boundary: "start" | "end") => {
    const entries = props.entries()
    const entry = boundary === "start" ? entries[0] : entries.at(-1)
    navigateToEntry(entry)
  }

  createEffect(
    on(props.viewport, (viewport) => {
      if (!viewport) return

      const update = () => setScrollTop(viewport.scrollTop)
      viewport.addEventListener("scroll", update, { passive: true })
      update()
      onCleanup(() => viewport.removeEventListener("scroll", update))
    }),
  )

  onCleanup(() => clearHideTimer())

  const currentID = createMemo(() => {
    const entries = props.entries()
    if (entries.length === 0) return undefined

    const viewport = props.viewport()
    if (!viewport) return entries.at(-1)?.id

    const target = scrollTop() + viewport.clientHeight * 0.25
    return entries.reduce((current, entry) => (entry.offset <= target ? entry.id : current), entries[0].id)
  })

  const currentIndex = createMemo(() => props.entries().findIndex((entry) => entry.id === currentID()))
  const isAtStart = createMemo(() => scrollTop() <= 1)
  const isAtEnd = createMemo(() => {
    const viewport = props.viewport()
    if (!viewport) return currentIndex() === props.entries().length - 1
    return scrollTop() + viewport.clientHeight >= viewport.scrollHeight - 1
  })
  const canNavigatePrevious = createMemo(() => currentIndex() > 0 && !isAtStart())
  const canNavigateNext = createMemo(() => {
    const index = currentIndex()
    return index >= 0 && index < props.entries().length - 1 && !isAtEnd()
  })

  const navigateToAdjacent = (offset: -1 | 1) => {
    navigateToEntry(props.entries()[currentIndex() + offset])
  }

  return (
    <Show when={props.entries().length > 1}>
      <nav class="session-timeline-navigator" aria-label={language.t("session.tab.session")}>
        <button
          type="button"
          class="session-timeline-navigator__edge-button session-timeline-navigator__edge-button--start"
          disabled={isAtStart()}
          aria-label={props.entries()[0]?.prompt || language.t("session.tab.session")}
          title={props.entries()[0]?.prompt || language.t("session.tab.session")}
          onClick={() => navigateToBoundary("start")}
        >
          <Icon name="arrow-up" size="small" />
        </button>
        <button
          type="button"
          class="session-timeline-navigator__edge-button session-timeline-navigator__edge-button--previous"
          disabled={!canNavigatePrevious()}
          aria-label={language.t("command.message.previous")}
          title={language.t("command.message.previous")}
          onClick={() => navigateToAdjacent(-1)}
        >
          <Icon name="chevron-down" size="small" />
        </button>
        <For each={props.entries()}>
          {(entry) => {
            const previewID = `session-timeline-preview-${entry.id}`

            return (
              <div
                class="session-timeline-navigator__entry"
                style={{ top: `${entry.position * 100}%` }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "touch") return
                  showPreview(entry.id)
                }}
                onPointerLeave={hidePreview}
              >
                <button
                  type="button"
                  class="session-timeline-navigator__marker"
                  classList={{
                    "session-timeline-navigator__marker--current": currentID() === entry.id,
                    "session-timeline-navigator__marker--hovered": hoveredID() === entry.id,
                  }}
                  aria-current={currentID() === entry.id ? "location" : undefined}
                  aria-describedby={hoveredID() === entry.id ? previewID : undefined}
                  aria-label={entry.prompt || language.t("session.messages.jumpToLatest")}
                  onClick={() => {
                    clearHideTimer()
                    setHoveredID(undefined)
                    props.onNavigate(entry.id)
                  }}
                />
                <Show when={hoveredID() === entry.id && (entry.prompt || entry.response)}>
                  <div
                    id={previewID}
                    role="tooltip"
                    class="session-timeline-navigator__preview"
                    onPointerEnter={() => showPreview(entry.id)}
                    onPointerLeave={hidePreview}
                  >
                    <Show when={entry.prompt}>
                      <p class="session-timeline-navigator__prompt">{entry.prompt}</p>
                    </Show>
                    <Show when={entry.response}>
                      <p class="session-timeline-navigator__response">{entry.response}</p>
                    </Show>
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
        <button
          type="button"
          class="session-timeline-navigator__edge-button session-timeline-navigator__edge-button--next"
          disabled={!canNavigateNext()}
          aria-label={language.t("command.message.next")}
          title={language.t("command.message.next")}
          onClick={() => navigateToAdjacent(1)}
        >
          <Icon name="chevron-down" size="small" />
        </button>
        <button
          type="button"
          class="session-timeline-navigator__edge-button session-timeline-navigator__edge-button--end"
          disabled={isAtEnd()}
          aria-label={language.t("session.messages.jumpToLatest")}
          title={language.t("session.messages.jumpToLatest")}
          onClick={() => navigateToBoundary("end")}
        >
          <Icon name="arrow-down-to-line" size="small" />
        </button>
      </nav>
    </Show>
  )
}
