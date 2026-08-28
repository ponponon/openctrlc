import { describe, expect, test } from "bun:test"
import { SessionSearchBarProps, sessionSearchBarState } from "./session-search-bar"

describe("SessionSearchBar", () => {
  test("formats the result state and preserves the component contract", () => {
    const props: SessionSearchBarProps = {
      open: true,
      query: "needle",
      scope: "conversation",
      matches: 2,
      activeMatch: 1,
      loading: false,
      partial: false,
      onQueryChange: () => undefined,
      onScopeChange: () => undefined,
      onNavigate: () => undefined,
      onRetry: () => undefined,
      onClose: () => undefined,
    }

    expect(sessionSearchBarState(props)).toEqual({
      hasResults: true,
      noResults: false,
      partial: false,
      loading: false,
      error: undefined,
    })
  })
})
