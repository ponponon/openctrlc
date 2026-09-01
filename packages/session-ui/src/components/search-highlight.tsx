import { createEffect, onCleanup } from "solid-js"
import type { JSX } from "solid-js"

// 基于 CSS Custom Highlight API 的搜索命中高亮：
// 不修改 DOM（对 markdown 流式渲染零冲突），实例只扫描容器内文本节点并登记 Range，
// 由模块级管理器把所有实例的 Range 合并成一个固定的 ::highlight(session-search-hit) 注册项。
// 需要浏览器支持 Highlight API（Chromium 105+，Electron 43 满足）；不支持时静默降级为无高亮。
const HIGHLIGHT_NAME = "session-search-hit"
const ACTIVE_HIGHLIGHT_NAME = "session-search-hit-current"

type HighlightRegistry = { highlights: Map<string, unknown> }
type HighlightConstructor = new (...ranges: Range[]) => unknown
type HighlightRanges = { normal: Range[]; active: Range[] }

const highlights = (): HighlightRegistry["highlights"] | undefined => {
  if (typeof CSS === "undefined") return undefined
  return (CSS as unknown as HighlightRegistry).highlights
}

const highlightConstructor = (): HighlightConstructor | undefined => {
  if (typeof globalThis === "undefined") return undefined
  return (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight
}

const registry = new Map<number, HighlightRanges>()
let scheduled = false
let instanceSeq = 0

function rebuild() {
  scheduled = false
  const store = highlights()
  const HighlightCtor = highlightConstructor()
  if (!store || !HighlightCtor) return
  const normal: Range[] = []
  const active: Range[] = []
  for (const items of registry.values()) {
    normal.push(...items.normal)
    active.push(...items.active)
  }
  if (normal.length === 0) {
    store.delete(HIGHLIGHT_NAME)
  } else {
    store.set(HIGHLIGHT_NAME, new HighlightCtor(...normal))
  }
  if (active.length === 0) {
    store.delete(ACTIVE_HIGHLIGHT_NAME)
  } else {
    store.set(ACTIVE_HIGHLIGHT_NAME, new HighlightCtor(...active))
  }
}

function scheduleRebuild() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(rebuild)
}

export function SearchTextHighlight(props: { query?: string; activeOccurrence?: number; children: JSX.Element }) {
  let root: HTMLDivElement | undefined
  let observer: MutationObserver | undefined
  const key = ++instanceSeq

  const scan = () => {
    const normal: Range[] = []
    const active: Range[] = []
    const query = props.query
    if (root && query) {
      const needle = query.toLocaleLowerCase()
      if (needle) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let occurrence = 0
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const value = node.nodeValue ?? ""
          if (!value) continue
          const lower = value.toLocaleLowerCase()
          let start = 0
          while (start < lower.length) {
            const index = lower.indexOf(needle, start)
            if (index < 0) break
            const range = document.createRange()
            range.setStart(node, index)
            range.setEnd(node, index + needle.length)
            if (props.activeOccurrence === occurrence) active.push(range)
            else normal.push(range)
            occurrence += 1
            start = index + needle.length
          }
        }
      }
    }
    if (normal.length === 0 && active.length === 0) registry.delete(key)
    else registry.set(key, { normal, active })
    scheduleRebuild()
  }

  createEffect(() => {
    // 追踪 query 变化触发重扫；MutationObserver 覆盖 markdown 流式渲染时的 DOM 重建
    props.query
    props.activeOccurrence
    if (!root) return
    scan()
    if (!observer) {
      observer = new MutationObserver(scan)
      observer.observe(root, { childList: true, characterData: true, subtree: true })
    }
  })

  onCleanup(() => {
    observer?.disconnect()
    observer = undefined
    registry.delete(key)
    scheduleRebuild()
  })

  return (
    <div
      ref={(el) => {
        root = el
      }}
      data-search-highlight-root
    >
      {props.children}
    </div>
  )
}
