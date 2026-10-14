import { createMemoryHistory, MemoryRouter, Route } from "@solidjs/router"
import { createComponent, createRoot } from "solid-js"
import { expect, test } from "bun:test"
import { useSessionHashScroll } from "../src/pages/session/use-session-hash-scroll"

test("clears the reading anchor before a non-message hash jump", () => {
  const history = createMemoryHistory()
  history.set({ value: "/project/session/ses_test#review-panel", scroll: false })
  const target = document.createElement("div")
  target.id = "review-panel"
  document.body.append(target)
  let clearCount = 0
  let pauseCount = 0
  let applyHash: (behavior: ScrollBehavior) => void = () => {}

  function Harness() {
    const hook = useSessionHashScroll({
      sessionKey: () => "project:session",
      sessionID: () => undefined,
      messagesReady: () => false,
      visibleUserMessages: () => [],
      historyMore: () => false,
      historyLoading: () => false,
      loadMore: async () => {},
      currentMessageId: () => undefined,
      pendingMessage: () => undefined,
      setPendingMessage: () => {},
      setActiveMessage: () => {},
      autoScroll: { pause: () => pauseCount++, forceScrollToBottom: () => {} },
      shouldFollowBottom: () => false,
      scroller: () => {
        const element = document.createElement("div")
        element.scrollTo = () => {}
        return element
      },
      anchor: (id) => `message-${id}`,
      clearReadingAnchor: () => clearCount++,
      scheduleScrollState: () => {},
      consumePendingMessage: () => undefined,
    })
    applyHash = hook.applyHash
    return null
  }

  const dispose = createRoot((dispose) => {
    createComponent(MemoryRouter, {
      history,
      children: createComponent(Route, { path: "*", component: Harness }),
    })
    return dispose
  })

  applyHash("auto")

  expect(pauseCount).toBe(1)
  expect(clearCount).toBe(1)

  dispose()
  target.remove()
})
