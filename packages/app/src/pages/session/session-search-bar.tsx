import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { Button } from "@openctrlc/ui/button"
import { Icon } from "@openctrlc/ui/icon"
import { IconButton } from "@openctrlc/ui/icon-button"
import { Select } from "@openctrlc/ui/select"
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

  let inputRef: HTMLInputElement | undefined
  let isComposing = false

  // 当外部 query 变化（如重置清空）且输入法未在合成时，同步给 DOM input
  createEffect(() => {
    const externalQuery = props.query
    if (inputRef && !isComposing && inputRef.value !== externalQuery) {
      inputRef.value = externalQuery
    }
  })

  // 当搜索栏打开时自动聚焦并选中文字
  createEffect(() => {
    if (props.open) {
      requestAnimationFrame(() => {
        if (inputRef) {
          inputRef.focus()
          inputRef.select()
        }
      })
    }
  })

  const handleInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    if (isComposing) return
    props.onQueryChange(event.currentTarget.value)
  }

  const handleCompositionStart = () => {
    isComposing = true
  }

  const handleCompositionEnd = (event: CompositionEvent & { currentTarget: HTMLInputElement }) => {
    isComposing = false
    props.onQueryChange(event.currentTarget.value)
  }

  const handleKeyDown = (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    // 中文/输入法合成状态下（按键选词、空格、回车等）绝不拦截
    if (event.isComposing || event.keyCode === 229) {
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      props.onClose()
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      props.onNavigate(event.shiftKey ? -1 : 1)
      return
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      props.onNavigate(event.key === "ArrowUp" ? -1 : 1)
      return
    }
  }

  return (
    <Show when={props.open}>
      <div class="session-search-bar" data-component="session-search-bar" role="search">
        <div class="session-search-bar__field">
          <Icon name="magnifying-glass" size="small" class="session-search-bar__search-icon" />
          <input
            ref={(el) => {
              inputRef = el
            }}
            type="text"
            class="session-search-bar__native-input"
            value={props.query}
            onInput={handleInput}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={handleKeyDown}
            placeholder={language.t("session.search.placeholder")}
            aria-label={language.t("session.search.input")}
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

export function sessionSearchBarState(
  props: Pick<SessionSearchBarProps, "query" | "matches" | "loading" | "partial" | "error">,
) {
  return {
    hasResults: !props.loading && props.matches > 0,
    noResults: !props.loading && !!props.query && props.matches === 0,
    partial: props.partial,
    loading: props.loading,
    error: props.error,
  }
}
