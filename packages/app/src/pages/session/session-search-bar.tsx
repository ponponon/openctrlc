import { Show } from "solid-js"
import { Button } from "@openctrlc/ui/button"
import { Icon } from "@openctrlc/ui/icon"
import { IconButton } from "@openctrlc/ui/icon-button"
import { Select } from "@openctrlc/ui/select"
import { TextField } from "@openctrlc/ui/text-field"
import { useLanguage } from "@/context/language"
import type { SessionSearchScope } from "./session-search"
import "./session-search-bar.css"

export type SessionSearchBarProps = {
  open: boolean
  query: string
  scope: SessionSearchScope
  matches: number
  activeMatch: number
  loading: boolean
  partial: boolean
  error?: string
  onQueryChange: (query: string) => void
  onScopeChange: (scope: SessionSearchScope) => void
  onNavigate: (direction: -1 | 1) => void
  onRetry: () => void
  onClose: () => void
}

export function SessionSearchBar(props: SessionSearchBarProps) {
  const language = useLanguage()
  const scopes: SessionSearchScope[] = ["conversation", "all"]
  const scopeLabel = (scope: SessionSearchScope) =>
    scope === "conversation" ? language.t("session.search.scope.conversation") : language.t("session.search.scope.all")
  const state = () => sessionSearchBarState(props)

  return (
    <Show when={props.open}>
      <div class="session-search-bar" data-component="session-search-bar" role="search">
        <div class="session-search-bar__field">
          <Icon name="magnifying-glass" size="small" class="session-search-bar__search-icon" />
          <TextField
            value={props.query}
            onChange={props.onQueryChange}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key === "Escape") {
                event.preventDefault()
                props.onClose()
                return
              }
              if (event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                props.onNavigate(event.key === "ArrowUp" || (event.key === "Enter" && event.shiftKey) ? -1 : 1)
              }
            }}
            placeholder={language.t("session.search.placeholder")}
            aria-label={language.t("session.search.input")}
            hideLabel
            variant="ghost"
            autofocus={true}
          />
        </div>
        <div class="session-search-bar__status" aria-live="polite">
          <Show when={state().hasResults}>
            <span class="session-search-bar__count">
              {language.t("session.search.results", { current: props.activeMatch + 1, total: props.matches })}
            </span>
          </Show>
          <Show when={state().loading}>
            <span class="session-search-bar__loading">{language.t("session.search.loading")}</span>
          </Show>
          <Show when={state().noResults}>
            <span class="session-search-bar__no-results">{language.t("session.search.noResults")}</span>
          </Show>
          <Show when={state().partial}>
            <span class="session-search-bar__partial">{language.t("session.search.partial")}</span>
          </Show>
          <Show when={props.error}>
            <span class="session-search-bar__error">{props.error}</span>
            <Button size="small" variant="ghost" class="session-search-bar__retry" onClick={props.onRetry}>
              {language.t("session.search.retry")}
            </Button>
          </Show>
        </div>
        <div class="session-search-bar__divider" aria-hidden="true" />
        <div class="session-search-bar__scope-wrapper">
          <Select
            options={scopes}
            current={props.scope}
            value={(scope) => scope}
            label={scopeLabel}
            onSelect={(scope) => scope && props.onScopeChange(scope)}
            variant="ghost"
            size="small"
            aria-label={language.t("session.search.scope")}
            class="session-search-bar__scope"
          />
        </div>
        <div class="session-search-bar__divider" aria-hidden="true" />
        <div class="session-search-bar__actions">
          <IconButton
            icon="chevron-left"
            variant="ghost"
            size="small"
            disabled={props.matches === 0}
            aria-label={language.t("session.search.previous")}
            onClick={() => props.onNavigate(-1)}
          />
          <IconButton
            icon="chevron-right"
            variant="ghost"
            size="small"
            disabled={props.matches === 0}
            aria-label={language.t("session.search.next")}
            onClick={() => props.onNavigate(1)}
          />
          <IconButton
            icon="close"
            variant="ghost"
            size="small"
            aria-label={language.t("session.search.close")}
            onClick={props.onClose}
          />
        </div>
      </div>
    </Show>
  )
}

export function sessionSearchBarState(props: Pick<SessionSearchBarProps, "query" | "matches" | "loading" | "partial" | "error">) {
  return {
    hasResults: !props.loading && props.matches > 0,
    noResults: !props.loading && !!props.query && props.matches === 0,
    partial: props.partial,
    loading: props.loading,
    error: props.error,
  }
}
