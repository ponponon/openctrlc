import "@/index.css"
import * as Sentry from "@sentry/solid"
import { I18nProvider } from "@openctrlc/ui/context"
import { DialogProvider, useDialog } from "@openctrlc/ui/context/dialog"
import { FileComponentProvider } from "@openctrlc/ui/context/file"
import { Font } from "@openctrlc/ui/font"
import { Splash } from "@openctrlc/ui/logo"
import { ThemeProvider } from "@openctrlc/ui/theme/context"
import { ButtonV2 } from "@openctrlc/ui/v2/button-v2"
import { MetaProvider } from "@solidjs/meta"
import {
  type BaseRouterProps,
  Navigate,
  Route,
  Router,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "@solidjs/router"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { Effect } from "effect"
import { base64Encode } from "@openctrlc/core/util/encode"
import {
  type Component,
  createEffect,
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  For,
  type JSX,
  lazy,
  onCleanup,
  type ParentProps,
  Show,
  startTransition,
  Suspense,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { makeEventListener } from "@solid-primitives/event-listener"
import { CommandProvider, useCommand, type CommandOption } from "@/context/command"
import { CommentsProvider } from "@/context/comments"
import { FileProvider } from "@/context/file"
import { ServerSDKProvider } from "@/context/server-sdk"
import { ServerSyncProvider, useServerSync } from "@/context/server-sync"
import { GlobalProvider, useGlobal } from "@/context/global"
import { HighlightsProvider } from "@/context/highlights"
import { LanguageProvider, type Locale, useLanguage } from "@/context/language"
import { LayoutProvider, useLayout } from "@/context/layout"
import { ModelsProvider } from "@/context/models"
import { NotificationProvider } from "@/context/notification"
import { PermissionProvider } from "@/context/permission"
import { usePlatform, type RemoteWorkspaceSnapshot } from "@/context/platform"
import { PromptProvider } from "@/context/prompt"
import { ServerConnection, ServerProvider, serverName, useServer } from "@/context/server"
import { SettingsProvider, useSettings } from "@/context/settings"
import { TabsProvider, tabKey, useTabs, type DraftTab } from "@/context/tabs"
import { SDKProvider, useSDK } from "@/context/sdk"
import { WslServersProvider } from "@/wsl/context"
import DirectoryLayout, { DirectoryDataProvider } from "@/pages/directory-layout"
import LegacyLayout from "@/pages/layout"
import NewLayout from "@/pages/layout-new"
import { ErrorPage } from "./pages/error"
import { useCheckServerHealth } from "./utils/server-health"
import { legacySessionHref, legacySessionServer, requireServerKey, sessionHref } from "./utils/session-route"
import { createSessionLineage } from "@/pages/session/session-lineage"
import { showToast } from "@/utils/toast"
import { showOpenCodeImportDialog } from "@/utils/opencode-import-dialog"
import { decode64 } from "@/utils/base64"
import { NewHome } from "@/pages/home"
import { LegacyHome } from "@/pages/home/legacy-home"
import { SessionSkeleton } from "@/pages/session-skeleton"

// Session chrome (timeline, diffs, composer, terminal) is the bulk of the bundle.
// Keep it out of the remote first paint; only load when a session route mounts.
const SessionRouteView = lazy(() => import("@/pages/session-route-view").then((m) => ({ default: m.SessionRouteView })))
const TargetSessionRouteView = lazy(() =>
  import("@/pages/session-route-view").then((m) => ({ default: m.TargetSessionRouteView })),
)
const SessionBoundary = lazy(() => import("@/pages/session-route-view").then((m) => ({ default: m.SessionBoundary })))
const File = lazy(() => import("@openctrlc/session-ui/file").then((m) => ({ default: m.File })))
const NewSession = lazy(() => import("@/pages/new-session"))

/** Warm the session chrome chunk before a restored session route mounts. */
export function warmSessionRoute() {
  return import("@/pages/session-route-view").then(() => undefined)
}

const setDesktopTitlebar = (theme: { mode: "light" | "dark"; scheme?: "system" | "light" | "dark" }) => {
  const api = (
    window as Window & {
      api?: { setTitlebar?: (theme: { mode: "light" | "dark"; scheme?: "system" | "light" | "dark" }) => Promise<void> }
    }
  ).api
  void api?.setTitlebar?.(theme)
}

const SessionRoute = () => {
  const settings = useSettings()
  const params = useParams()
  const [search] = useSearchParams<{ draftId?: string; prompt?: string }>()
  const sdk = useSDK()
  const server = useServer()
  const tabs = useTabs()

  if (params.id && settings.general.newLayoutDesigns()) {
    const sessionID = params.id
    return (
      <Show when={tabs.ready()}>
        {(_) => {
          const persisted = tabs.store.filter((item) => item.type === "session")
          return <Navigate href={sessionHref(legacySessionServer(persisted, sessionID, server.key), sessionID)} />
        }}
      </Show>
    )
  }

  // When the new layout is enabled, the legacy new-session route (/:dir/session with no id)
  // is replaced by a draft at /new-session?draftId=…
  createEffect(() => {
    if (!settings.general.newLayoutDesigns()) return
    if (params.id || search.draftId) return
    if (!tabs.ready() || !sdk().directory) return
    tabs.newDraft({ server: server.key, directory: sdk().directory }, search.prompt)
  })

  return (
    <Suspense fallback={<SessionSkeleton />}>
      <SessionRouteView sessionID={params.id} />
    </Suspense>
  )
}

function TargetServerRoute(props: ParentProps) {
  const params = useParams<{ serverKey: string; id: string }>()
  const global = useGlobal()
  const conn = createMemo(() => {
    const key = requireServerKey(params.serverKey)
    return global.servers.list().find((item) => ServerConnection.key(item) === key)
  })

  return (
    // Owns the server-identity remount. Session changes must NOT remount this
    // subtree (SessionRouteErrorBoundary resets and createSessionLineage
    // re-resolves reactively instead); both rely on this key for server changes.
    <Show when={requireServerKey(params.serverKey)} keyed>
      <ServerSDKProvider server={conn}>
        <ServerSyncProvider server={conn}>{props.children}</ServerSyncProvider>
      </ServerSDKProvider>
    </Show>
  )
}

const TargetSessionRoute = () => (
  <TargetServerRoute>
    <Suspense fallback={<SessionSkeleton />}>
      <TargetSessionRouteView />
    </Suspense>
  </TargetServerRoute>
)

function LegacyTargetSessionRoute() {
  const params = useParams<{ serverKey: string; id: string }>()
  return (
    <TargetServerRoute>
      <Suspense fallback={<SessionSkeleton />}>
        <SessionBoundary sessionID={params.id} serverKey={requireServerKey(params.serverKey)}>
          <LegacyTargetSessionRedirect />
        </SessionBoundary>
      </Suspense>
    </TargetServerRoute>
  )
}

function LegacyTargetSessionRedirect() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sync = useServerSync()
  const current = createSessionLineage(
    () => params.id,
    () => sync().session.lineage,
  )

  createEffect(() => {
    const directory = current()?.session.directory
    if (!directory) return
    navigate(legacySessionHref(directory, params.id), { replace: true })
  })

  return null
}

// Wraps the non-draft routes. They are gated on (and keyed to) the globally selected
// server via ServerKey, then provide the server-scoped shell for that server.
function SelectedServerProviders(props: ParentProps) {
  return (
    <ServerKey>
      <ServerSDKProvider>
        <ServerSyncProvider>{props.children}</ServerSyncProvider>
      </ServerSDKProvider>
    </ServerKey>
  )
}

function LegacyServerLayout(props: ParentProps<{ serverScoped?: JSX.Element }>) {
  return (
    <SelectedServerProviders>
      <LegacyServerScopedShell serverScoped={props.serverScoped}>{props.children}</LegacyServerScopedShell>
    </SelectedServerProviders>
  )
}

function DraftRoute() {
  const [search] = useSearchParams<{ draftId?: string }>()
  const settings = useSettings()
  const tabs = useTabs()
  return (
    <Show when={tabs.ready()}>
      <Show
        when={tabs.store.find((tab): tab is DraftTab => tab.type === "draft" && tab.draftID === search.draftId)}
        keyed
        fallback={<Navigate href="/" />}
      >
        {(draft) => (
          <Show
            when={settings.general.newLayoutDesigns()}
            fallback={<Navigate href={`/${base64Encode(draft.directory)}/session`} />}
          >
            <ResolvedDraftRoute draft={draft} />
          </Show>
        )}
      </Show>
    </Show>
  )
}

function ResolvedDraftRoute(props: { draft: DraftTab }) {
  const global = useGlobal()
  const conn = createMemo(() => global.servers.list().find((item) => ServerConnection.key(item) === props.draft.server))
  const directory = () => props.draft.directory
  const serverKey = () => props.draft.server

  return (
    <Show when={`${props.draft.server}\0${props.draft.directory}`} keyed>
      <ServerSDKProvider server={conn}>
        <ServerSyncProvider server={conn}>
          <ModelsProvider directory={directory}>
            <SDKProvider directory={directory}>
              <DirectoryDataProvider directory={directory} server={serverKey}>
                <DraftProviders>
                  <NewSession />
                </DraftProviders>
              </DirectoryDataProvider>
            </SDKProvider>
          </ModelsProvider>
        </ServerSyncProvider>
      </ServerSDKProvider>
    </Show>
  )
}

function UiI18nBridge(props: ParentProps) {
  const language = useLanguage()
  return (
    <I18nProvider
      value={{ locale: language.intl, layoutLocale: language.layoutLocale, t: language.t, plural: language.plural }}
    >
      {props.children}
    </I18nProvider>
  )
}

function LayoutCompatibility(props: ParentProps) {
  const global = useGlobal()
  const navigate = useNavigate()
  const server = useServer()
  const settings = useSettings()

  createEffect(() => {
    if (settings.general.newLayoutDesigns()) return
    const current = server.current
    if (!current) return
    const protocol = global.ensureServerCtx(current).sdk.protocolKind()
    if (protocol !== "v2") return
    const next = global.servers.list().find((s) => {
      if (ServerConnection.key(s) === ServerConnection.key(current)) return false
      return global.ensureServerCtx(s).sdk.protocolKind() !== "v2"
    })
    if (!next) return
    navigate("/")
    queueMicrotask(() => server.setActive(ServerConnection.key(next)))
  })

  return <>{props.children}</>
}

declare global {
  interface Window {
    __OPENCTRLC__?: {
      deepLinks?: string[]
    }
  }
}

function QueryProvider(props: ParentProps) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnReconnect: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
    },
  })
  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
}

function BodyDesignClass() {
  const settings = useSettings()

  createRenderEffect(() => {
    if (typeof document === "undefined") return

    const enabled = settings.general.newLayoutDesigns()
    document.body.toggleAttribute("data-new-layout", enabled)
    document.body.classList.toggle("text-12-regular", !enabled)
    document.body.classList.toggle("font-(family-name:--font-family-text)", enabled)
    document.body.classList.toggle("text-[13px]", enabled)
    document.body.classList.toggle("font-[440]", enabled)
  })

  return null
}

// Server-agnostic providers shared across every route. These live in the shared
// shell (router root) so they stay mounted regardless of the active server/route.
function SharedProviders(props: ParentProps) {
  return (
    <>
      <BodyDesignClass />
      <CommandProvider>
        <DesktopCommands />
        <HighlightsProvider>{props.children}</HighlightsProvider>
      </CommandProvider>
    </>
  )
}

function DesktopCommands() {
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()

  command.register("desktop", () => {
    const commands: CommandOption[] = []
    if (platform.platform === "desktop" && platform.exportDebugLogs) {
      commands.push({
        id: "logs.export",
        title: language.t("command.logs.export"),
        category: language.t("command.category.settings"),
        onSelect: () => {
          void platform.exportDebugLogs?.()
        },
      })
    }
    return commands
  })

  return null
}

// Server-scoped providers shared by the legacy shell and the top-level new shell.
type ServerScopedShellProps = ParentProps<{
  directory?: () => string | undefined
  serverScoped?: JSX.Element
}>

function ServerScopedProviders(props: ServerScopedShellProps) {
  return (
    <LayoutProvider>
      <DesktopSessionCommands />
      {props.serverScoped}
      <ModelsProvider directory={props.directory}>{props.children}</ModelsProvider>
    </LayoutProvider>
  )
}

function DesktopSessionCommands() {
  const command = useCommand()
  const dialog = useDialog()
  const language = useLanguage()
  const layout = useLayout()
  const platform = usePlatform()
  const server = useServer()
  const serverSync = useServerSync()
  const tabs = useTabs()

  const targetDirectory = createMemo(() => {
    const route = layout.route()
    if (route.type === "dir-new-sesssion") return route.dir
    if (route.type === "session") return serverSync().session.get(route.sessionId)?.directory
    const selection = layout.home.selection()
    if (selection.server === server.key && selection.directory) return selection.directory
    return layout.projects.list()[0]?.worktree
  })

  const localDesktop = createMemo(
    () =>
      platform.platform === "desktop" &&
      !!platform.importOpenCodeSession &&
      server.current?.type === "sidecar" &&
      server.current.variant === "base",
  )

  command.register("desktop-session-import", () => [
    {
      id: "session.importOpencode",
      title: language.t("command.session.importOpencode"),
      description: language.t("command.session.importOpencode.description"),
      category: language.t("command.category.session"),
      disabled: !localDesktop() || !targetDirectory(),
      onSelect: async () => {
        if (!localDesktop()) {
          showToast({ title: language.t("dialog.session.importOpencode.error.localOnly") })
          return
        }
        const directory = targetDirectory()
        if (!directory) {
          showToast({ title: language.t("dialog.session.importOpencode.error.project") })
          return
        }
        showOpenCodeImportDialog({
          directory,
          dialog,
          language,
          openProject: layout.projects.open,
          platform,
          serverKey: server.key,
          serverSync,
          tabs,
          touchProject: server.projects.touch,
        })
      },
    },
  ])

  return null
}

function LegacyServerScopedShell(props: ServerScopedShellProps) {
  return (
    <ServerScopedProviders directory={props.directory} serverScoped={props.serverScoped}>
      <LegacyLayout>{props.children}</LegacyLayout>
    </ServerScopedProviders>
  )
}

function NewAppLayout(props: ParentProps<{ serverScoped?: JSX.Element }>) {
  return (
    <SelectedServerProviders>
      <ServerScopedProviders serverScoped={props.serverScoped}>
        <NewLayout>{props.children}</NewLayout>
      </ServerScopedProviders>
    </SelectedServerProviders>
  )
}

// The draft page only renders the prompt composer, so it drops TerminalProvider.
// FileProvider and CommentsProvider stay because PromptInput uses file search and comment context.
function DraftProviders(props: ParentProps) {
  return (
    <FileProvider>
      <PromptProvider>
        <CommentsProvider>{props.children}</CommentsProvider>
      </PromptProvider>
    </FileProvider>
  )
}

export function AppBaseProviders(
  props: ParentProps<{
    locale?: Locale
    onNativeTranslations?: Parameters<typeof LanguageProvider>[0]["onNativeTranslations"]
  }>,
) {
  return (
    <MetaProvider>
      <Font />
      <ThemeProvider
        onThemeApplied={(_, mode, scheme) => {
          setDesktopTitlebar({ mode, scheme })
        }}
      >
        <LanguageProvider locale={props.locale} onNativeTranslations={props.onNativeTranslations}>
          <UiI18nBridge>
            <ErrorBoundary
              fallback={(error) => {
                Sentry.captureException(error)
                return <AppErrorFallback error={error} />
              }}
            >
              <QueryProvider>
                <WslServersProvider>
                  <DialogProvider>
                    <FileComponentProvider component={File}>{props.children}</FileComponentProvider>
                  </DialogProvider>
                </WslServersProvider>
              </QueryProvider>
            </ErrorBoundary>
          </UiI18nBridge>
        </LanguageProvider>
      </ThemeProvider>
    </MetaProvider>
  )
}

function AppErrorFallback(props: { error: unknown }) {
  const platform = usePlatform()
  const language = useLanguage()
  if (!platform.remoteSessionID) return <ErrorPage error={props.error} />

  return (
    <main class="flex min-h-screen w-full items-center justify-center bg-v2-background-bg-base p-6" role="alert">
      <section class="flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-6 text-center shadow-[var(--v2-elevation-raised)]">
        <div class="flex flex-col gap-2">
          <h1 class="text-16-medium text-v2-text-text-strong">{language.t("remote.route.loadFailedTitle")}</h1>
          <p class="text-13-regular leading-5 text-v2-text-text-muted">
            {language.t("remote.route.loadFailedDescription")}
          </p>
        </div>
        <ButtonV2 variant="neutral" onClick={() => window.location.reload()}>
          {language.t("remote.route.retry")}
        </ButtonV2>
      </section>
    </main>
  )
}

function ConnectionGate(props: ParentProps<{ disableHealthCheck?: boolean; startup?: Promise<void> }>) {
  const server = useServer()
  const checkServerHealth = useCheckServerHealth()

  const [checkMode, setCheckMode] = createSignal<"blocking" | "background">("blocking")

  // performs repeated health check with a grace period for
  // non-http connections, otherwise fails instantly
  const [startupHealthCheck, healthCheckActions] = createResource(() =>
    props.disableHealthCheck
      ? true
      : Effect.gen(function* () {
          if (!server.current) return true
          const { http, type } = server.current

          while (true) {
            const res = yield* Effect.promise(() => checkServerHealth(http))
            if (res.healthy) return true
            if (checkMode() === "background" || type === "http") return false
          }
        }).pipe(
          Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.succeed(false) }),
          Effect.ensuring(Effect.sync(() => setCheckMode("background"))),
          Effect.runPromise,
        ),
  )
  const checking = createMemo(
    () => checkMode() === "blocking" && ["unresolved", "pending"].includes(startupHealthCheck.state),
  )
  const [startup] = createResource(async () => {
    if (!props.startup) return true
    await props.startup.catch((error) => {
      console.error("[startup] startup gate failed", error)
    })
    return true
  })
  const startupChecking = createMemo(
    () => startupHealthCheck.latest === true && ["unresolved", "pending"].includes(startup.state),
  )
  const loading = createMemo(() => checking() || startupChecking())

  return (
    <>
      <Show when={!checking()}>
        <Show
          when={startupHealthCheck.latest}
          fallback={
            <ConnectionError
              onRetry={() => {
                if (checkMode() === "background") void healthCheckActions.refetch()
              }}
              onServerSelected={(key) => {
                setCheckMode("blocking")
                server.setActive(key)
                void healthCheckActions.refetch()
              }}
            />
          }
        >
          {props.children}
        </Show>
      </Show>
      <Show when={loading()}>
        <div class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background-base">
          <Splash class="w-16 h-20 opacity-50 animate-pulse" />
        </div>
      </Show>
    </>
  )
}

function ConnectionError(props: { onRetry?: () => void; onServerSelected?: (key: ServerConnection.Key) => void }) {
  const language = useLanguage()
  const server = useServer()
  const others = () => server.list.filter((s) => ServerConnection.key(s) !== server.key)
  const name = createMemo(() => server.name || server.key)
  const serverToken = "\u0000server\u0000"
  const unreachable = createMemo(() => language.t("app.server.unreachable", { server: serverToken }).split(serverToken))

  const timer = setInterval(() => props.onRetry?.(), 1000)
  onCleanup(() => clearInterval(timer))

  return (
    <div class="h-dvh w-screen flex flex-col items-center justify-center bg-background-base gap-6 p-6">
      <div class="flex flex-col items-center max-w-md text-center">
        <Splash class="w-12 h-15 mb-4" />
        <p class="text-14-regular text-text-base">
          {unreachable()[0]}
          <span class="text-text-strong font-medium">{name()}</span>
          {unreachable()[1]}
        </p>
        <p class="mt-1 text-12-regular text-text-weak">{language.t("app.server.retrying")}</p>
      </div>
      <Show when={others().length > 0}>
        <div class="flex flex-col gap-2 w-full max-w-sm">
          <span class="text-12-regular text-text-base text-center">{language.t("app.server.otherServers")}</span>
          <div class="flex flex-col gap-1 bg-surface-base rounded-lg p-2">
            <For each={others()}>
              {(conn) => {
                const key = ServerConnection.key(conn)
                return (
                  <button
                    type="button"
                    class="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-surface-raised-base-hover transition-colors text-left"
                    onClick={() => props.onServerSelected?.(key)}
                  >
                    <span class="text-14-regular text-text-strong truncate">{serverName(conn)}</span>
                  </button>
                )
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}

function ServerKey(props: ParentProps) {
  const server = useServer()
  return (
    <Show when={server.key} keyed>
      {props.children}
    </Show>
  )
}

export function AppInterface(props: {
  children?: JSX.Element
  defaultServer: ServerConnection.Key
  canonicalLocalServer?: ServerConnection.Key
  servers?: Array<ServerConnection.Any>
  router?: Component<BaseRouterProps>
  disableHealthCheck?: boolean
  startup?: Promise<void>
  serverScoped?: JSX.Element
  remoteWorkspace?: RemoteWorkspaceSnapshot
}) {
  // The visual new layout lives in the router root so it remains mounted across
  // route changes. Draft and session routes override only their server-bound data
  // providers beneath it.
  const ServerShell = (shellProps: ParentProps) => (
    <QueryProvider>
      <SharedProviders>
        {props.children}
        {shellProps.children}
      </SharedProviders>
    </QueryProvider>
  )

  return (
    <ServerProvider
      defaultServer={props.defaultServer}
      canonicalLocalServer={props.canonicalLocalServer}
      servers={props.servers}
      remoteWorkspace={props.remoteWorkspace}
    >
      <GlobalProvider>
        <SettingsProvider>
          <ConnectionGate disableHealthCheck={props.disableHealthCheck} startup={props.startup}>
            <RemoteWorkspaceHydrator remoteWorkspace={props.remoteWorkspace} />
            <Show when={useSettings().general.newLayoutDesigns().toString()} keyed>
              <Dynamic
                component={props.router ?? Router}
                root={(routerProps) => (
                  <TabsProvider remoteWorkspace={props.remoteWorkspace}>
                    <RemoteTabsHydrator />
                    <PermissionProvider>
                      <NotificationProvider>
                        <ServerShell>
                          <Show when={useSettings().general.newLayoutDesigns()} fallback={routerProps.children}>
                            <NewAppLayout serverScoped={props.serverScoped}>{routerProps.children}</NewAppLayout>
                          </Show>
                        </ServerShell>
                      </NotificationProvider>
                    </PermissionProvider>
                  </TabsProvider>
                )}
              >
                <Routes serverScoped={props.serverScoped} />
              </Dynamic>
            </Show>
          </ConnectionGate>
        </SettingsProvider>
      </GlobalProvider>
    </ServerProvider>
  )
}

function pickRemoteConnection(global: ReturnType<typeof useGlobal>) {
  return (
    global.servers.list().find(ServerConnection.builtin) ??
    global.servers.list().find(ServerConnection.local) ??
    global.servers.list()[0]
  )
}

function RemoteWorkspaceHydrator(props: { remoteWorkspace?: RemoteWorkspaceSnapshot }) {
  const platform = usePlatform()
  const server = useServer()
  const global = useGlobal()

  // A workspace snapshot is authoritative, including an intentionally empty project list.
  // Only direct web connections without a snapshot need one local project as a fallback.
  createEffect(() => {
    if (platform.platform !== "web") return
    if (props.remoteWorkspace) return
    if (!server.ready()) return
    const connection = pickRemoteConnection(global)
    if (!connection) return
    const context = global.ensureServerCtx(connection)
    const known = context.sync.data.project ?? []
    if (known.length === 0) return
    const open = context.projects.list()
    if (open.length > 0) return
    const last = context.projects.last()
    const worktree = known.find((project) => project.worktree === last)?.worktree ?? known[0]?.worktree
    if (!worktree) return
    context.projects.touch(worktree)
    context.projects.open(worktree)
  })

  return null
}

function RemoteTabsHydrator() {
  const platform = usePlatform()
  const server = useServer()
  const global = useGlobal()
  const tabs = useTabs()
  const location = useLocation()

  const protocolSnapshot = createMemo(() => {
    if (platform.platform !== "desktop" || !platform.remoteAccess || !server.ready() || !tabs.ready()) return ""
    const connection = pickRemoteConnection(global)
    if (!connection) return ""
    const key = ServerConnection.key(connection)
    const context = global.ensureServerCtx(connection)
    return JSON.stringify(
      tabs.store.flatMap((tab) => {
        if (tab.type !== "session" || tab.server !== key) return []
        const protocol = context.sdk.sessionProtocols.get(tab.sessionId)
        if (!protocol || context.sync.session.data.session_message[tab.sessionId] === undefined) return []
        return [`${tab.sessionId}:${protocol}`]
      }),
    )
  })

  createEffect(() => {
    if (platform.platform !== "desktop" || !platform.remoteAccess) return
    if (!server.ready() || !tabs.ready()) return
    protocolSnapshot()
    const connection = pickRemoteConnection(global)
    if (!connection) return
    const key = ServerConnection.key(connection)
    const parts = location.pathname.split("/").filter(Boolean)
    const activeSessionID =
      parts[0] === "server" && parts[2] === "session" && parts[3] && decode64(parts[1]) === key ? parts[3] : undefined
    const sessionIDs = tabs.store.flatMap((tab) =>
      tab.type === "session" && tab.server === key ? [tab.sessionId] : [],
    )
    if (activeSessionID && !sessionIDs.includes(activeSessionID)) sessionIDs.push(activeSessionID)
    const context = global.ensureServerCtx(connection)
    const projects = context.projects.list().map((project) => ({
      worktree: project.worktree,
      expanded: project.expanded,
    }))
    const lastProject = context.projects.last()
    const sessionInfo = sessionIDs.flatMap((sessionID) => {
      const tab = tabs.store.find((item) => item.type === "session" && item.sessionId === sessionID)
      const title =
        (tab?.type === "session" ? tabs.info[tabKey(tab)]?.title : undefined) ??
        context.sync.session.peek(sessionID)?.title
      if (typeof title !== "string") return []
      const messagesLoaded = context.sync.session.data.session_message[sessionID] !== undefined
      const protocol = messagesLoaded ? context.sdk.sessionProtocols.get(sessionID) : undefined
      return [
        {
          sessionID,
          title: title.slice(0, 200),
          ...(protocol ? { protocol } : {}),
        },
      ]
    })
    const snapshot: RemoteWorkspaceSnapshot = {
      projects,
      ...(lastProject && projects.some((project) => project.worktree === lastProject) ? { lastProject } : {}),
      sessionIDs,
      sessionInfo,
      activeSessionID,
    }
    platform.remoteAccess.updateWorkspace(snapshot)
  })

  // The snapshot already restores all desktop tabs. Keep this fallback only for
  // older or direct links that have an active session but no workspace snapshot.
  createEffect(() => {
    if (platform.platform !== "web" || !tabs.ready()) return
    if (tabs.store.some((tab) => tab.type === "session")) return
    const parts = location.pathname.split("/").filter(Boolean)
    const active = parts[0] === "server" && parts[2] === "session" ? parts[3] : undefined
    if (!active) return
    const connection = pickRemoteConnection(global)
    if (!connection) return
    tabs.addSessionTab({ server: ServerConnection.key(connection), sessionId: active })
  })

  return null
}

function Routes(props: { serverScoped?: JSX.Element }) {
  const settings = useSettings()

  return (
    <>
      <Route
        component={(routeProps) => (
          <LegacyServerLayout serverScoped={props.serverScoped}>{routeProps.children}</LegacyServerLayout>
        )}
      >
        <Show when={!settings.general.newLayoutDesigns()}>
          {
            <>
              <Route path="/" component={LegacyHome} />
              <Route path="/server/:serverKey/session/:id" component={LegacyTargetSessionRoute} />
            </>
          }
        </Show>
        <Route path="/:dir" component={DirectoryLayout}>
          <Route path="/" component={() => <Navigate href="session" />} />
          <Route path="/session/:id?" component={SessionRoute} />
        </Route>
      </Route>
      <Show when={settings.general.newLayoutDesigns()}>
        <Route path="/" component={NewHome} />
        <Route path="/:dir/session/:id" component={NewLayoutLegacySessionRedirect} />
        <Route path="/server/:serverKey/session/:id" component={TargetSessionRoute} />
      </Show>
      <Route path="/new-session" component={DraftRoute} />
    </>
  )
}

function NewLayoutLegacySessionRedirect() {
  const server = useServer()
  const tabs = useTabs()
  const params = useParams<{ id: string }>()

  return (
    <Show when={tabs.ready()}>
      <Navigate
        href={sessionHref(
          legacySessionServer(
            tabs.store.filter((item) => item.type === "session"),
            params.id,
            server.key,
          ),
          params.id,
        )}
      />
    </Show>
  )
}
