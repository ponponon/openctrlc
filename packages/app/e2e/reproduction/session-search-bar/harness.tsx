import { createSignal, type ParentProps } from "solid-js"
import { render } from "solid-js/web"
import { I18nProvider } from "@openctrlc/ui/context/i18n"
import { PlatformProvider } from "@/context/platform"
import { LanguageProvider } from "@/context/language"
import { SessionSearchBar, type SessionSearchBarProps } from "@/pages/session/session-search-bar"
import "@/index.css"

type HarnessState = {
  open: boolean
  query: string
  scope: "conversation" | "all"
  matches: number
  activeMatch: number
  loading: boolean
  partial: boolean
  error?: string
  navigation: number[]
  retries: number
  closed: number
}

const initial: HarnessState = {
  open: false,
  query: "",
  scope: "conversation",
  matches: 0,
  activeMatch: 0,
  loading: false,
  partial: false,
  navigation: [],
  retries: 0,
  closed: 0,
}

const [state, setState] = createSignal(initial)
const update = (next: Partial<HarnessState>) => setState((current) => ({ ...current, ...next }))

declare global {
  interface Window {
    __sessionSearchHarness?: {
      state: HarnessState
      set: (next: Partial<HarnessState>) => void
    }
  }
}

window.__sessionSearchHarness = {
  get state() {
    return state()
  },
  set: update,
}

function TestPlatform(props: ParentProps) {
  return (
    <PlatformProvider
      value={{
        platform: "web",
        openExternal: () => undefined,
        restart: async () => undefined,
        notify: async () => undefined,
      }}
    >
      {props.children}
    </PlatformProvider>
  )
}

function Harness() {
  return (
    <TestPlatform>
      <LanguageProvider locale="en">
        <I18nProvider value={{ locale: () => "en", t: (key) => key, plural: () => "" }}>
          <SessionSearchBar
            open={state().open}
            query={state().query}
            scope={state().scope}
            matches={state().matches}
            activeMatch={state().activeMatch}
            loading={state().loading}
            partial={state().partial}
            error={state().error}
            onQueryChange={(query) => update({ query })}
            onScopeChange={(scope) => update({ scope })}
            onNavigate={(direction) => update({ navigation: [...state().navigation, direction] })}
            onRetry={() => update({ retries: state().retries + 1 })}
            onClose={() => update({ open: false, closed: state().closed + 1 })}
          />
        </I18nProvider>
      </LanguageProvider>
    </TestPlatform>
  )
}

render(() => <Harness />, document.getElementById("root")!)
