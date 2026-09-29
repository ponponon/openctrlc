import { observeElementRect, type Rect, type Virtualizer } from "@tanstack/solid-virtual"

export function virtualScrollElement(root: HTMLElement | undefined) {
  if (!root?.isConnected) return null
  return root.closest<HTMLDivElement>(".scroll-view__viewport")
}

export function observeVirtualScrollRect<TScrollElement extends Element, TItemElement extends Element>(
  instance: Virtualizer<TScrollElement, TItemElement>,
  callback: (rect: Rect) => void,
) {
  return observeElementRect(instance, (rect) => {
    // A hidden tab can report a transient zero-height ResizeObserver entry after it is visible again.
    // Keep the last usable range until the observer delivers the restored dimensions.
    if (rect.height === 0) return
    callback(rect)
  })
}
