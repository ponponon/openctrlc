import { createEffect, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createEventListener } from "@solid-primitives/event-listener"
import { createResizeObserver } from "@solid-primitives/resize-observer"

export interface AutoScrollOptions {
  working: () => boolean
  onUserInteracted?: () => void
  overflowAnchor?: "none" | "auto" | "dynamic"
  bottomThreshold?: number
  isUserInteracting?: () => boolean
  shouldResumeOnScroll?: () => boolean
  /**
   * 会话级“当前是否应当跟随最新消息”的判定（包含持久化 follow 与用户向上意图）。
   * 为 false 时禁止一切非强制吸底——塌缩窗口里 userScrolled 可能还没来得及置位，
   * 只信它会把手动回看的视口拉回底部。
   */
  shouldFollow?: () => boolean
}

export function createAutoScroll(options: AutoScrollOptions) {
  let settling = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let autoTimer: ReturnType<typeof setTimeout> | undefined
  let auto: { top: number; time: number } | undefined
  // 虚拟列表重测量会让 scrollHeight 瞬时塌缩（canScroll 变 false）。
  // 塌缩窗口内的向上滚动手势无法置 userScrolled，若不记下意图，
  // 内容恢复后 ResizeObserver 会按“仍在跟随”把视口吸回底部。
  let pendingIntentAt: number | undefined
  // 窗口要覆盖慢速历史分页 / 长时间测量塌缩；结束时持久化意图应当已经落地。
  const pendingIntentWindowMs = 5000

  const threshold = () => options.bottomThreshold ?? 10
  const shouldResumeOnScroll = () => options.shouldResumeOnScroll?.() ?? true

  const [store, setStore] = createStore({
    contentRef: undefined as HTMLElement | undefined,
    scrollRef: undefined as HTMLElement | undefined,
    userScrolled: false,
  })

  const active = () => options.working() || settling

  const distanceFromBottom = (el: HTMLElement) => {
    return el.scrollHeight - el.clientHeight - el.scrollTop
  }

  const canScroll = (el: HTMLElement) => {
    return el.scrollHeight - el.clientHeight > 1
  }

  // Browsers can dispatch scroll events asynchronously. If new content arrives
  // between us calling `scrollTo()` and the subsequent `scroll` event firing,
  // the handler can see a non-zero `distanceFromBottom` and incorrectly assume
  // the user scrolled.
  const markAuto = (el: HTMLElement) => {
    auto = {
      top: Math.max(0, el.scrollHeight - el.clientHeight),
      time: Date.now(),
    }

    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
      auto = undefined
      autoTimer = undefined
    }, 1500)
  }

  const isAuto = (el: HTMLElement) => {
    const a = auto
    if (!a) return false

    if (Date.now() - a.time > 1500) {
      auto = undefined
      return false
    }

    // 只容忍自动落点附近的抖动；用户向上滚动的第一时间（scrollTop 减小）
    // 不能再被当作自动滚动，否则会在跟随时误判并触发一次吸底。
    const delta = el.scrollTop - a.top
    return delta >= -1 && delta < 2
  }

  const scrollToBottomNow = (behavior: ScrollBehavior) => {
    const el = store.scrollRef
    if (!el) return
    markAuto(el)
    if (behavior === "smooth") {
      el.scrollTo({ top: el.scrollHeight, behavior })
      return
    }

    // `scrollTop` assignment bypasses any CSS `scroll-behavior: smooth`.
    el.scrollTop = el.scrollHeight
  }

  const scrollToBottom = (force: boolean) => {
    if (!force && !active()) return

    if (force && store.userScrolled) setStore("userScrolled", false)
    if (force) pendingIntentAt = undefined

    const el = store.scrollRef
    if (!el) return

    if (!force && store.userScrolled) return

    // 会话层已判定“不应跟随”（用户回看历史）：任何非强制吸底都要放弃。
    if (!force && options.shouldFollow?.() === false) {
      pendingIntentAt = undefined
      if (!store.userScrolled) setStore("userScrolled", true)
      return
    }

    // 塌缩窗口内记下的向上意图：内容恢复溢出后不能当作“仍在底部跟随”。
    if (!force && pendingIntentAt !== undefined) {
      const fresh = Date.now() - pendingIntentAt <= pendingIntentWindowMs
      pendingIntentAt = undefined
      if (fresh) {
        setStore("userScrolled", true)
        options.onUserInteracted?.()
        return
      }
    }

    const distance = distanceFromBottom(el)
    if (distance < 2) {
      markAuto(el)
      return
    }

    // For auto-following content we prefer immediate updates to avoid
    // visible "catch up" animations while content is still settling.
    scrollToBottomNow("auto")
  }

  const recordUserIntent = (el: HTMLElement | undefined) => {
    // 能滚动时直接暂停跟随（持久状态）；瞬时不可滚动时只记意图，
    // 等溢出恢复再由 scrollToBottom 消费，避免吞掉用户手势。
    if (el && canScroll(el)) {
      pendingIntentAt = undefined
      if (store.userScrolled) return
      setStore("userScrolled", true)
      options.onUserInteracted?.()
      return
    }
    pendingIntentAt = Date.now()
  }

  /** 会话层在确认用户向上滚动后调用：即使当下内容无法滚动也要记下意图。 */
  const markUserIntent = () => recordUserIntent(store.scrollRef)

  const hasPendingIntent = () => pendingIntentAt !== undefined && Date.now() - pendingIntentAt <= pendingIntentWindowMs

  const stop = () => {
    const el = store.scrollRef
    if (!el) return
    if (!canScroll(el)) {
      pendingIntentAt = Date.now()
      return
    }
    if (store.userScrolled) return

    pendingIntentAt = undefined
    setStore("userScrolled", true)
    options.onUserInteracted?.()
  }

  const handleWheel = (e: WheelEvent) => {
    if (e.deltaY >= 0) return
    // If the user is scrolling within a nested scrollable region (tool output,
    // code block, etc), don't treat it as leaving the "follow bottom" mode.
    // Those regions opt in via `data-scrollable`.
    const el = store.scrollRef
    const target = e.target instanceof Element ? e.target : undefined
    const nested = target?.closest("[data-scrollable]")
    if (el && nested && nested !== el) return
    stop()
  }

  const handleScroll = () => {
    const el = store.scrollRef
    if (!el) return

    if (!canScroll(el)) {
      if (store.userScrolled && shouldResumeOnScroll()) setStore("userScrolled", false)
      return
    }

    if (distanceFromBottom(el) < threshold()) {
      pendingIntentAt = undefined
      if (store.userScrolled && shouldResumeOnScroll()) setStore("userScrolled", false)
      return
    }

    // Ignore scroll events triggered by our own scrollToBottom calls.
    if (!store.userScrolled && isAuto(el)) {
      scrollToBottom(false)
      return
    }

    stop()
  }

  const handleInteraction = () => {
    if (!active()) return
    const selection = window.getSelection()
    if (selection && selection.toString().length > 0) {
      stop()
    }
  }

  const updateOverflowAnchor = (el: HTMLElement) => {
    const mode = options.overflowAnchor ?? "dynamic"

    if (mode === "none") {
      el.style.overflowAnchor = "none"
      return
    }

    if (mode === "auto") {
      el.style.overflowAnchor = "auto"
      return
    }

    el.style.overflowAnchor = store.userScrolled ? "auto" : "none"
  }

  createResizeObserver(
    () => store.contentRef,
    () => {
      if (options.isUserInteracting?.()) return
      const el = store.scrollRef
      if (el && !canScroll(el)) {
        if (store.userScrolled && shouldResumeOnScroll()) setStore("userScrolled", false)
        return
      }
      if (!active()) return
      if (store.userScrolled) return
      // ResizeObserver fires after layout, before paint.
      // Keep the bottom locked in the same frame to avoid visible
      // "jump up then catch up" artifacts while streaming content.
      scrollToBottom(false)
    },
  )

  createEffect(
    on(options.working, (working: boolean) => {
      settling = false
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = undefined

      if (working) {
        if (!store.userScrolled) scrollToBottom(true)
        return
      }

      settling = true
      settleTimer = setTimeout(() => {
        settling = false
      }, 300)
    }),
  )

  createEffect(() => {
    // Track `userScrolled` even before `scrollRef` is attached, so we can
    // update overflow anchoring once the element exists.
    store.userScrolled
    const el = store.scrollRef
    if (!el) return
    updateOverflowAnchor(el)
  })

  createEventListener(() => store.scrollRef, "wheel", handleWheel, { passive: true })

  onCleanup(() => {
    if (settleTimer) clearTimeout(settleTimer)
    if (autoTimer) clearTimeout(autoTimer)
  })

  return {
    scrollRef: (el: HTMLElement | undefined) => setStore("scrollRef", el),
    contentRef: (el: HTMLElement | undefined) => setStore("contentRef", el),
    handleScroll,
    handleInteraction,
    pause: stop,
    setUserScrolled: (value: boolean) => setStore("userScrolled", value),
    resume: () => {
      pendingIntentAt = undefined
      if (store.userScrolled) setStore("userScrolled", false)
      scrollToBottom(true)
    },
    scrollToBottom: () => scrollToBottom(false),
    forceScrollToBottom: () => scrollToBottom(true),
    userScrolled: () => store.userScrolled,
    /** 用户向上意图（含塌缩窗口内的待定意图），供会话层门禁吸底路径使用。 */
    markUserIntent,
    hasPendingIntent,
  }
}
