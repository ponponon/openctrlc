import { For, createSignal, onCleanup, onMount } from "solid-js"
import { makeEventListener } from "@solid-primitives/event-listener"
import { useLanguage } from "@/context/language"

const STORAGE_KEY = "openctrlc.layout-debug"

// Enabled by `?debug=layout` (sticky across in-app navigation via sessionStorage)
// and disabled by `?debug=layout0`. Remote/tablet pages can then be screenshotted
// with real innerWidth/element rects when the layout cannot be reproduced locally.
function readEnabled() {
  if (typeof window === "undefined") return false
  const value = new URLSearchParams(window.location.search).get("debug")
  if (value === "layout") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {}
    return true
  }
  if (value === "layout0") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
    return false
  }
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

const enabled = readEnabled()
export const layoutDebugEnabled = () => enabled

type Line = { text: string; bad: boolean }

type Box = { x: number; y: number; w: number; h: number }

function box(el: Element | null): Box | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
}

const fmt = (value: Box | null) => (value ? `${value.x},${value.y} ${value.w}×${value.h}` : "—")

const near = (a: number, b: number) => Math.abs(a - b) <= 2

function findFrame() {
  return (
    [...document.querySelectorAll("div")].find((element) => {
      const classes = element.classList
      return classes.contains("size-full") && classes.contains("overflow-hidden") && classes.contains("flex-col")
    }) ?? null
  )
}

function hasCssRule(fragment: string) {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(rules)) {
      const selector = (rule as { selectorText?: unknown }).selectorText
      if (typeof selector === "string" && selector.includes(fragment)) return true
    }
  }
  return false
}

function collect(): Line[] {
  const root = document.getElementById("root")
  const main = document.querySelector("main")
  const frame = findFrame()
  const row = [...document.querySelectorAll("div")].find((element) => element.classList.contains("md:flex-row")) ?? null
  const aside = document.getElementById("review-panel")

  const viewport = { w: window.innerWidth, h: window.innerHeight }
  const visual = window.visualViewport
  const rootBox = box(root)
  const mainBox = box(main)
  const frameBox = box(frame)
  const rowBox = box(row)
  const asideBox = box(aside)

  const rootFilled = !!rootBox && near(rootBox.h, visual?.height ?? viewport.h)
  const frameWidthFilled = !!frameBox && !!mainBox && near(frameBox.w, mainBox.w)
  const frameHeightFilled = !!frameBox && !!mainBox && near(frameBox.h, mainBox.h)
  const ruleLoaded = hasCssRule(".size-full")
  const frameComputed = frame ? getComputedStyle(frame) : undefined
  const rowDirection = row ? getComputedStyle(row).flexDirection : "—"
  const asideGrow = aside ? getComputedStyle(aside).flexGrow : "—"

  return [
    {
      text: `vp ${viewport.w}×${viewport.h} dpr ${window.devicePixelRatio}${
        visual ? ` vv ${Math.round(visual.width)}×${Math.round(visual.height)}@${visual.scale}` : ""
      }`,
      bad: false,
    },
    { text: `root  ${fmt(rootBox)} fill ${rootFilled ? "✓" : "✗"}`, bad: !rootFilled },
    { text: `main   ${fmt(mainBox)}`, bad: !mainBox },
    {
      text: `frame  ${fmt(frameBox)} fill ${frameWidthFilled && frameHeightFilled ? "✓" : "✗"} css .size-full ${ruleLoaded ? "✓" : "✗"}${frameComputed ? ` style ${frameComputed.width}/${frameComputed.height}` : ""}`,
      bad: !frameBox || !frameWidthFilled || !frameHeightFilled || !ruleLoaded,
    },
    { text: `row    ${fmt(rowBox)} dir ${rowDirection}${rowDirection === "row" ? " ✓" : " ✗"}`, bad: rowDirection !== "row" },
    {
      text: `aside  ${fmt(asideBox)} grow ${asideGrow}${asideGrow === "1" ? " ✓" : " ✗"}`,
      bad: aside !== null && asideGrow !== "1",
    },
    { text: `sheets ${document.styleSheets.length}`, bad: document.styleSheets.length === 0 },
  ]
}

export function LayoutDebug() {
  const language = useLanguage()
  const [lines, setLines] = createSignal<Line[]>([])

  onMount(() => {
    const update = () => setLines(collect())
    update()
    const poll = window.setInterval(update, 500)
    makeEventListener(window, "resize", update)
    window.visualViewport?.addEventListener("resize", update)
    onCleanup(() => {
      window.clearInterval(poll)
      window.visualViewport?.removeEventListener("resize", update)
    })
  })

  return (
    <aside
      aria-label={language.t("layoutDebug.title")}
      class="pointer-events-auto fixed bottom-3 left-3 z-50 max-w-[calc(100vw-1.5rem)] select-text rounded-lg border border-border-base bg-surface-raised-stronger-non-alpha px-2.5 py-2 font-mono text-[11px] leading-[1.5] shadow-[var(--shadow-lg-border-base)]"
    >
      <div class="mb-1 text-[10px] font-black tracking-[0.04em] opacity-70 uppercase">
        {language.t("layoutDebug.title")}
      </div>
      <For each={lines()}>
        {(line) => <div class={line.bad ? "text-text-on-critical-base" : "text-text-strong"}>{line.text}</div>}
      </For>
      <div class="mt-1 text-[10px] opacity-60">{language.t("layoutDebug.hint")}</div>
    </aside>
  )
}
