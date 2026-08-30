import { expect, test } from "bun:test"
import { createVirtualizer } from "@tanstack/solid-virtual"
import { isActiveSearchMessage } from "@/pages/session/session-search"

test("marks only the active search message", () => {
  expect(isActiveSearchMessage("msg-2", "msg-2")).toBe(true)
  expect(isActiveSearchMessage("msg-1", "msg-2")).toBe(false)
  expect(isActiveSearchMessage("msg-2", undefined)).toBe(false)
})

test("keeps an offscreen search message in the virtual range and reveals it centered", () => {
  const activeIndex = 55
  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 80,
    getScrollElement: () => null,
    estimateSize: () => 60,
    initialRect: { width: 800, height: 300 },
    rangeExtractor: (range) => [...new Set([...rangeExtractor(range), activeIndex])].sort((a, b) => a - b),
  })

  expect(virtualizer.getVirtualItems().some((item) => item.index === activeIndex)).toBe(true)
  expect(virtualizer.getVirtualItems().find((item) => item.index === activeIndex)?.index).toBe(activeIndex)
})

function rangeExtractor(range: { startIndex: number; endIndex: number }) {
  return Array.from({ length: range.endIndex - range.startIndex + 1 }, (_, index) => range.startIndex + index)
}
