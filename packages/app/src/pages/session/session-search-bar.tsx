/** @jsxImportSource solid-js */
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
          <Icon name="magnifying-glass" size="small" />
          <TextField
            value={props.query}
            onChange={props.onQueryChange}
            placeholder={language.t("session.search.placeholder")}
            aria-label={language.t("session.search.input")}
            hideLabel
            variant="ghost"
            autofocus={true}
          />
        </div>
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
        <div class="session-search-bar__status" aria-live="polite">
          <Show when={state().hasResults}>
            {language.t("session.search.results", { current: props.activeMatch + 1, total: props.matches })}
          </Show>
          <Show when={state().loading}>{language.t("session.search.loading")}</Show>
          <Show when={state().noResults}>{language.t("session.search.noResults")}</Show>
          <Show when={state().partial}>{language.t("session.search.partial")}</Show>
          <Show when={props.error}>
            <span class="session-search-bar__error">{props.error}</span>
            <Button size="small" variant="ghost" onClick={props.onRetry}>
              {language.t("session.search.retry")}
            </Button>
          </Show>
        </div>
        <div class="session-search-bar__actions">
          <IconButton
            icon="chevron-left"
            variant="ghost"
            size="normal"
            disabled={props.matches === 0}
            aria-label={language.t("session.search.previous")}
            onClick={() => props.onNavigate(-1)}
          />
          <IconButton
            icon="chevron-right"
            variant="ghost"
            size="normal"
            disabled={props.matches === 0}
            aria-label={language.t("session.search.next")}
            onClick={() => props.onNavigate(1)}
          />
          <IconButton
            icon="close"
            variant="ghost"
            size="normal"
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
