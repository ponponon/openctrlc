import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { renderSessionSearchBarDom } from "./session-search-bar-dom"

const labels = {
  input: "Search session messages",
  scope: "Search scope",
  results: "2 of 2 results",
  noResults: "No results",
  loading: "Loading results...",
  partial: "Partial history",
  retry: "Retry",
  previous: "Previous result",
  next: "Next result",
  close: "Close search",
}

describe("SessionSearchBar DOM boundary", () => {
  test("renders focusable labeled controls and forwards query and scope changes", () => {
    const root = document.createElement("div")
    document.body.append(root)
    const queries: string[] = []
    const scopes: string[] = []
    const view = renderSessionSearchBarDom(root, {
      query: "needle",
      scope: "conversation",
      scopes: [
        { value: "conversation", label: "Conversation" },
        { value: "all", label: "All content" },
      ],
      matches: 2,
      activeMatch: 1,
      loading: false,
      partial: false,
      labels,
      onQueryChange: (value) => queries.push(value),
      onScopeChange: (value) => scopes.push(value),
      onNavigate: () => undefined,
      onRetry: () => undefined,
      onClose: () => undefined,
    })

    expect(view.query.autofocus).toBe(true)
    expect(view.query.getAttribute("aria-label")).toBe(labels.input)
    expect(view.scope.getAttribute("aria-label")).toBe(labels.scope)
    expect(view.scope.options).toHaveLength(2)
    view.query.focus()
    expect(document.activeElement).toBe(view.query)
    view.query.value = "changed"
    view.query.dispatchEvent(new Event("input"))
    view.scope.value = "all"
    view.scope.dispatchEvent(new Event("change"))
    expect(queries).toEqual(["changed"])
    expect(scopes).toEqual(["all"])
  })

  test("renders result, error, retry, navigation, and close behavior", () => {
    const root = document.createElement("div")
    document.body.append(root)
    const navigation: number[] = []
    let retry = 0
    let close = 0
    const view = renderSessionSearchBarDom(root, {
      query: "needle",
      scope: "conversation",
      scopes: [{ value: "conversation", label: "Conversation" }],
      matches: 2,
      activeMatch: 1,
      loading: false,
      partial: true,
      error: "History unavailable",
      labels,
      onQueryChange: () => undefined,
      onScopeChange: () => undefined,
      onNavigate: (direction) => navigation.push(direction),
      onRetry: () => retry++,
      onClose: () => close++,
    })

    expect(view.status.textContent).toContain(labels.results)
    expect(view.status.textContent).toContain(labels.partial)
    expect(view.status.textContent).toContain("History unavailable")
    view.previous.click()
    view.next.click()
    view.status.querySelector("button")?.click()
    view.close.click()
    expect(navigation).toEqual([-1, 1])
    expect(retry).toBe(1)
    expect(close).toBe(1)
  })

  test("renders loading and no-results states and disables navigation without matches", () => {
    const root = document.createElement("div")
    document.body.append(root)
    const view = renderSessionSearchBarDom(root, {
      query: "needle",
      scope: "all",
      scopes: [],
      matches: 0,
      activeMatch: 0,
      loading: true,
      partial: false,
      labels,
      onQueryChange: () => undefined,
      onScopeChange: () => undefined,
      onNavigate: () => undefined,
      onRetry: () => undefined,
      onClose: () => undefined,
    })
    expect(view.status.textContent).toBe(labels.loading)
    expect(view.next.disabled).toBe(true)

    const empty = renderSessionSearchBarDom(root, {
      query: "needle",
      scope: "all",
      scopes: [],
      matches: 0,
      activeMatch: 0,
      loading: false,
      partial: false,
      labels,
      onQueryChange: () => undefined,
      onScopeChange: () => undefined,
      onNavigate: () => undefined,
      onRetry: () => undefined,
      onClose: () => undefined,
    })
    expect(empty.status.textContent).toBe(labels.noResults)
  })

  test("uses normal flow so the composer can remain below the search bar", () => {
    const css = readFileSync(new URL("./session-search-bar.css", import.meta.url), "utf8")
    expect(css).toContain("position: relative")
    expect(css).not.toContain("position: absolute")
    expect(css).toContain("flex: 0 0 auto")
    expect(css).toContain("--session-search-bar-height")
    expect(css).toContain(":focus-within")
    expect(css).toContain("var(--shadow-xs-border-focus)")
  })
})
