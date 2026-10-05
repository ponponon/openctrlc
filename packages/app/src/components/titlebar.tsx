import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
  untrack,
} from "solid-js"
import { createStore } from "solid-js/store"
import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { IconButton } from "@openctrlc/ui/icon-button"
import { Icon } from "@openctrlc/ui/icon"
import { Button } from "@openctrlc/ui/button"
import { Tooltip, TooltipKeybind } from "@openctrlc/ui/tooltip"
import { IconButtonV2 } from "@openctrlc/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@openctrlc/ui/v2/icon"
import { KeybindV2 } from "@openctrlc/ui/v2/keybind-v2"
import { TooltipV2 } from "@openctrlc/ui/v2/tooltip-v2"

import { LayoutRoute, useLayout } from "@/context/layout"
import { usePlatform, type RemoteTransportStatus } from "@/context/platform"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { WindowsAppMenu } from "./windows-app-menu"
import { applyPath, backPath, forwardPath } from "./titlebar-history"
import { remoteHostName, listRemoteDesktops, switchRemoteDesktop, activeRemoteSessionID } from "@/utils/remote-workspace"
import { readNetworkQuality, onNetworkQualityChange } from "@/utils/network-quality"
import { TitlebarTabStrip } from "@/components/titlebar-tab-strip"
import { makeEventListener } from "@solid-primitives/event-listener"
import { createMediaQuery } from "@solid-primitives/media"
import { readSessionTabsRemovedDetail, SESSION_TABS_REMOVED_EVENT } from "@/components/titlebar-session-events"
import { useGlobal } from "@/context/global"
import { ServerConnection, useServer } from "@/context/server"
import { tabKey, useTabs } from "@/context/tabs"
import type { PromptSession } from "@/context/prompt"
import "./titlebar.css"
import { newTabTooltipKeybind } from "./command-tooltip-keybind"
import { normalizeSessionInfo } from "@/utils/session"
import { useDialog } from "@openctrlc/ui/context/dialog"
import { DialogRemoteAccess } from "@/components/dialog-remote-access"
import { Popover as KobaltePopover } from "@kobalte/core/popover"
import { ButtonV2 } from "@openctrlc/ui/v2/button-v2"
import { CHANGELOG_PAGE_URL, CHANGELOG_URL, findReleaseNote, type ReleaseNote } from "@/utils/changelog"

const legacyTitlebarHeight = 40
const v2TitlebarHeight = 36
const minTitlebarZoom = 0.25
const windowsControlsBaseWidth = 138 // 3 native Windows caption buttons at 46px each.
const macTrafficLightsBaseWidth = 84

export type TitlebarUpdate = {
  version: () => string | undefined
  installing: () => boolean
  install: () => void
}

export function useTitlebarRightMount() {
  const language = useLanguage()
  const [mount, setMount] = createSignal<HTMLElement | null>(null)
  const sync = () => setMount(document.getElementById("opencode-titlebar-right"))
  onMount(sync)
  createEffect(on(language.direction, sync, { defer: true }))
  return mount
}

export function Titlebar(props: { update?: TitlebarUpdate; debugTools?: { visible: boolean; toggle: () => void } }) {
  const layout = useLayout()
  const platform = usePlatform()
  const dialog = useDialog()
  const command = useCommand()
  const language = useLanguage()
  const settings = useSettings()
  const server = useServer()
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const useV2Titlebar = createMemo(() => settings.general.newLayoutDesigns())
  const mobile = createMediaQuery("(max-width: 767px)")
  const bottom = createMemo(() => useV2Titlebar() && mobile() && settings.general.mobileTitlebarPosition() === "bottom")

  const mac = createMemo(() => platform.platform === "desktop" && platform.os === "macos")
  const windows = createMemo(() => platform.platform === "desktop" && platform.os === "windows")
  const linux = createMemo(() => platform.platform === "desktop" && platform.os === "linux")
  const web = createMemo(() => platform.platform === "web")
  const macTrafficLights = createMemo(() => mac() && !platform.windowFullscreen?.())
  const zoom = () => platform.webviewZoom?.() ?? 1
  const titlebarZoom = () => (windows() ? Math.max(zoom(), minTitlebarZoom) : zoom())
  const counterZoom = () => (windows() && titlebarZoom() < 1 ? 1 / titlebarZoom() : 1)
  const minHeight = () => {
    const height = useV2Titlebar() ? v2TitlebarHeight : legacyTitlebarHeight
    if (mac()) return `${height / zoom()}px`
    if (windows()) return `${height / Math.min(titlebarZoom(), 1)}px`
    return undefined
  }
  const windowsControlsWidth = () => `${windowsControlsBaseWidth / Math.max(titlebarZoom(), 1)}px`

  const [history, setHistory] = createStore({
    stack: [] as string[],
    index: 0,
    action: undefined as "back" | "forward" | undefined,
  })

  const path = () => `${location.pathname}${location.search}${location.hash}`
  const creating = createMemo(() => {
    const route = layout.route()
    if (route.type === "draft" || route.type === "dir-new-sesssion") return true
    if (!params.dir) return false
    if (params.id) return false
    const parts = location.pathname.replace(/\/+$/, "").split("/")
    return parts.at(-1) === "session"
  })

  createEffect(() => {
    const current = path()

    untrack(() => {
      const next = applyPath(history, current)
      if (next === history) return
      setHistory(next)
    })
  })

  const canBack = createMemo(() => history.index > 0)
  const canForward = createMemo(() => history.index < history.stack.length - 1)
  const hasProjects = createMemo(() => layout.projects.list().length > 0)
  const nav = createMemo(() => (useV2Titlebar() ? settings.general.showNavigation() : true))
  const updateState = createMemo<TitlebarUpdatePillState>(() => {
    const installing = props.update?.installing() ?? false
    const version = props.update?.version()
    return {
      visible: version !== undefined || installing,
      installing,
      version,
      label: language.t("titlebar.update"),
      ariaLabel: language.t("toast.update.action.installRestart"),
      title: version ? language.t("titlebar.updateVersion", { version }) : undefined,
      installLabel: language.t("titlebar.updateInstall"),
      installingLabel: language.t("titlebar.updateInstalling"),
      featuresLabel: language.t("titlebar.updateFeatures"),
      fixesLabel: language.t("titlebar.updateFixes"),
      performanceLabel: language.t("titlebar.updatePerformance"),
      uiLabel: language.t("titlebar.updateUI"),
      loadingLabel: language.t("titlebar.updateLoading"),
      unavailableLabel: language.t("titlebar.updateUnavailable"),
      moreLabel: language.t("titlebar.updateMore"),
      onInstall: () => props.update?.install(),
    }
  })
  const v2RightState = createMemo<TitlebarV2RightState>(() => ({
    update: updateState(),
    remoteAccess: platform.remoteAccess
      ? {
          label: language.t("remoteAccess.title"),
          open: () => dialog.show(() => <DialogRemoteAccess />),
        }
      : undefined,
  }))

  const back = () => {
    const next = backPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  const forward = () => {
    const next = forwardPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  command.register(() => [
    {
      id: "common.goBack",
      title: language.t("common.goBack"),
      category: language.t("command.category.view"),
      keybind: "mod+[",
      onSelect: back,
    },
    {
      id: "common.goForward",
      title: language.t("common.goForward"),
      category: language.t("command.category.view"),
      keybind: "mod+]",
      onSelect: forward,
    },
  ])

  return (
    <header
      data-slot={useV2Titlebar() ? "titlebar-v2" : undefined}
      classList={{
        "shrink-0 relative flex flex-row": true,
        "h-9 bg-v2-background-bg-deep overflow-visible": useV2Titlebar(),
        "h-10 bg-background-base overflow-hidden": !useV2Titlebar(),
        "order-last": bottom(),
      }}
      style={{
        "min-height": minHeight(),
        // Keep native macOS traffic lights clear even when the desktop window is narrow.
        "padding-left": macTrafficLights() ? `${macTrafficLightsBaseWidth / zoom()}px` : 0,
        width: windows() ? `env(titlebar-area-width, calc(100vw - ${windowsControlsWidth()}))` : undefined,
        "max-width": windows() ? `env(titlebar-area-width, calc(100vw - ${windowsControlsWidth()}))` : undefined,
        // Native Windows caption controls remain on the physical right in both writing directions.
        "margin-right": windows() ? "auto" : undefined,
      }}
      data-tauri-drag-region
    >
      <Switch>
        <Match when={useV2Titlebar()}>
          {(_) => {
            const layout = useLayout()
            const global = useGlobal()

            const tabs = useTabs()
            const tabsStore = tabs.store
            const tabsStoreActions = tabs
            const [session] = createResource(
              () => {
                const route = layout.route()
                if (route.type !== "session") return undefined
                const conn = global.servers
                  .list()
                  .find((item) => ServerConnection.key(item) === (route.server ?? server.key))
                return conn ? { route, sdk: global.ensureServerCtx(conn).sdk } : undefined
              },
              ({ route, sdk }) =>
                sdk.api.session
                  .get({ sessionID: route.sessionId })
                  .then(normalizeSessionInfo)
                  .catch(() => {}),
            )

            const matchRoute = (route: LayoutRoute) => {
              if (route.type === "home") return
              if (route.type === "draft") {
                return tabsStore.find((item) => item.type === "draft" && item.draftID === route.draftID)
              }
              if (route.type === "session") {
                const main = tabsStore.find(
                  (item) =>
                    item.type === "session" && item.server === route.server && item.sessionId === route.sessionId,
                )
                if (main) return main
                const s = session()
                if (s?.parentID) {
                  const parentID = s.parentID
                  const parent = tabsStore.find(
                    (item) => item.type === "session" && item.server === route.server && item.sessionId === parentID,
                  )
                  if (parent) return parent
                }
              }
            }

            const currentTab = () => matchRoute(layout.route())

            createEffect(() => {
              const route = layout.route()
              if (!tabs.ready()) return
              const tab = currentTab()
              if (tab) {
                tabs.remember(tab)
                return
              }

              if (route.type === "session") {
                const s = session()
                if (!s) return
                const sessionId = s.parentID ?? s.id
                const next = { server: route.server ?? server.key, sessionId }
                tabsStoreActions.addSessionTab(next)
              }
            })

            makeEventListener(window, SESSION_TABS_REMOVED_EVENT, (event) => {
              const detail = readSessionTabsRemovedDetail(event)
              if (!detail) return
              tabsStoreActions.removeSessions(detail)
            })

            const openNewTab = () => {
              const route = layout.route()
              const activeSession = session()
              if (route.type === "session" && activeSession) {
                const sessionTab = {
                  type: "session" as const,
                  server: route.server ?? server.key,
                  sessionId: activeSession.id,
                }
                const model = tabs.stateValue<PromptSession>(sessionTab, "prompt")?.model.current()
                tabs.newDraft({ server: sessionTab.server, directory: activeSession.directory }, "", model)
                return
              }

              const activeTab = currentTab()
              if (activeTab?.type === "draft") {
                const model = tabs.stateValue<PromptSession>(activeTab, "prompt")?.model.current()
                tabs.newDraft({ server: activeTab.server, directory: activeTab.directory }, "", model)
                return
              }

              if (route.type === "home") {
                const selection = layout.home.selection()
                const conn = global.servers.list().find((item) => ServerConnection.key(item) === selection.server)
                const project = conn
                  ? global
                      .ensureServerCtx(conn)
                      .projects.list()
                      .find((item) => item.worktree === selection.directory)
                  : undefined
                if (conn && project) {
                  tabs.newDraft({ server: ServerConnection.key(conn), directory: project.worktree }, "")
                  return
                }
              }

              const current = layout.projects.list()[0]
              if (current) {
                tabs.newDraft({ server: server.key, directory: current.worktree }, "")
                return
              }

              const fallback = global.servers.list().flatMap((conn) => {
                const project = global.ensureServerCtx(conn).projects.list()[0]
                return project ? [{ server: ServerConnection.key(conn), project }] : []
              })[0]
              if (!fallback) return

              tabs.newDraft({ server: fallback.server, directory: fallback.project.worktree }, "")
            }
            const toggleHome = () => tabs.toggleHome({ home: layout.route().type === "home", current: currentTab() })

            command.register("titlebar-home", () => [
              {
                id: "home.toggle",
                title: language.t("home.title"),
                category: language.t("command.category.view"),
                keybind: "mod+b",
                hidden: true,
                onSelect: toggleHome,
              },
            ])

            command.register("tabs", () => {
              const current = currentTab()

              return [
                {
                  id: "tab.new",
                  category: "tab",
                  title: language.t("command.session.new"),
                  keybind: "mod+t,mod+n",
                  hidden: true,
                  onSelect: openNewTab,
                },
                current && {
                  id: "tab.close",
                  category: "tab",
                  title: language.t("command.tab.close"),
                  keybind: "mod+w",
                  hidden: true,
                  onSelect: () => {
                    tabsStoreActions.closeTab(tabsStore.findIndex((tab) => current === tab))
                  },
                },
                {
                  id: "tab.reopenClosed",
                  category: language.t("command.category.file"),
                  title: language.t("command.tab.reopenClosed"),
                  keybind: "mod+shift+t",
                  onSelect: () => tabsStoreActions.reopenClosedTab(),
                },
              ].filter((v) => v !== undefined)
            })

            const [tabsAreOverflowing, setTabsAreOverflowing] = createSignal(false)

            return (
              <div
                class="h-full flex-1 overflow-hidden flex flex-row items-center gap-1.5 px-2 md:pr-3"
                classList={{
                  "pt-2": !bottom(),
                  "pb-2": bottom(),
                  "md:pl-2": macTrafficLights(),
                  "md:pl-4": !macTrafficLights(),
                }}
              >
                <ChannelIndicator debugTools={props.debugTools} />
                <Show when={windows() || linux()}>
                  <WindowsAppMenu command={command} platform={platform} variant="v2" />
                </Show>
                <TooltipV2
                  placement="bottom"
                  value={
                    <>
                      {language.t("home.title")}
                      <KeybindV2 keys={command.keybindParts("home.toggle")} variant="neutral" />
                    </>
                  }
                  class="shrink-0"
                >
                  <IconButtonV2
                    type="button"
                    variant="ghost-muted"
                    size="large"
                    class="!w-9 shrink-0"
                    icon={<IconV2 name="grid-plus" />}
                    state={layout.route().type === "home" ? "pressed" : undefined}
                    onClick={toggleHome}
                    aria-label={language.t("home.title")}
                    aria-pressed={layout.route().type === "home"}
                  />
                </TooltipV2>

                <TitlebarTabStrip
                  tabs={tabsStore}
                  currentTab={currentTab}
                  forceTruncate={tabsAreOverflowing()}
                  onOverflowChange={setTabsAreOverflowing}
                  onNavigate={(tab, el) => {
                    tabs.select(tab)
                    // block/inline must be "nearest": default block:"start" scrolls overflow
                    // ancestors vertically and clips titlebar chips (e.g. lite-network).
                    el?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" })
                  }}
                  onClose={(tab) => {
                    const index = tabsStore.findIndex((item) => tabKey(item) === tabKey(tab))
                    if (index !== -1) tabsStoreActions.closeTab(index)
                  }}
                  onReorder={(keys) => tabsStoreActions.reorder(keys)}
                />
                <TooltipV2
                  placement="bottom"
                  value={
                    <>
                      {language.t("command.session.new")}
                      <KeybindV2 keys={newTabTooltipKeybind(command)} variant="neutral" />
                    </>
                  }
                >
                  <IconButtonV2
                    type="button"
                    variant="ghost-muted"
                    size="large"
                    class="shrink-0"
                    icon={<IconV2 name="plus" />}
                    onClick={openNewTab}
                    aria-label={language.t("command.session.new")}
                  />
                </TooltipV2>
                <div class="flex-1" />
                <TitlebarV2Right state={v2RightState()} />
              </div>
            )
          }}
        </Match>
        <Match when>
          <div
            class="grid h-full min-h-full w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
            style={{ zoom: counterZoom() }}
          >
            <div
              classList={{
                "flex items-center min-w-0": true,
                "pl-2": !macTrafficLights(),
              }}
            >
              <Show when={windows() || linux()}>
                <WindowsAppMenu command={command} platform={platform} />
              </Show>
              <Show when={mac()}>
                <div class="xl:hidden w-10 shrink-0 flex items-center justify-center">
                  <IconButton
                    icon="menu"
                    variant="ghost"
                    class="titlebar-icon rounded-md"
                    onClick={layout.mobileSidebar.toggle}
                    aria-label={language.t("sidebar.menu.toggle")}
                    aria-expanded={layout.mobileSidebar.opened()}
                  />
                </div>
              </Show>
              <Show when={!mac()}>
                <div class="xl:hidden w-[48px] shrink-0 flex items-center justify-center">
                  <IconButton
                    icon="menu"
                    variant="ghost"
                    class="titlebar-icon rounded-md"
                    onClick={layout.mobileSidebar.toggle}
                    aria-label={language.t("sidebar.menu.toggle")}
                    aria-expanded={layout.mobileSidebar.opened()}
                  />
                </div>
              </Show>
              <div class="flex items-center gap-1 shrink-0">
                <TooltipKeybind
                  class={web() ? "hidden xl:flex shrink-0 ml-14" : "hidden xl:flex shrink-0 ml-2"}
                  placement="bottom"
                  title={language.t("command.sidebar.toggle")}
                  keybind={command.keybind("sidebar.toggle")}
                >
                  <Button
                    variant="ghost"
                    class="group/sidebar-toggle titlebar-icon w-8 h-6 p-0 box-border"
                    onClick={layout.sidebar.toggle}
                    aria-label={language.t("command.sidebar.toggle")}
                    aria-expanded={layout.sidebar.opened()}
                  >
                    <Icon size="small" name={layout.sidebar.opened() ? "sidebar-active" : "sidebar"} />
                  </Button>
                </TooltipKeybind>
                <div class="hidden xl:flex items-center shrink-0">
                  <Show when={params.dir}>
                    <div
                      class="flex items-center shrink-0 w-8 mr-1"
                      aria-hidden={layout.sidebar.opened() ? "true" : undefined}
                    >
                      <div
                        class="transition-opacity"
                        classList={{
                          "opacity-100 duration-120 ease-out": !layout.sidebar.opened(),
                          "opacity-0 duration-120 ease-in delay-0 pointer-events-none": layout.sidebar.opened(),
                        }}
                      >
                        <TooltipKeybind
                          placement="bottom"
                          title={language.t("command.session.new")}
                          keybind={command.keybind("session.new")}
                          openDelay={800}
                        >
                          <Button
                            variant="ghost"
                            class="titlebar-icon w-8 h-6 p-0 box-border"
                            disabled={layout.sidebar.opened()}
                            tabIndex={layout.sidebar.opened() ? -1 : undefined}
                            onClick={() => {
                              if (!params.dir) return
                              navigate(`/${params.dir}/session`)
                            }}
                            aria-label={language.t("command.session.new")}
                            aria-current={creating() ? "page" : undefined}
                          >
                            <IconV2 name="edit" size="small" />
                          </Button>
                        </TooltipKeybind>
                      </div>
                    </div>
                  </Show>
                  <div
                    class="flex items-center shrink-0"
                    classList={{
                      "ltr:-translate-x-[36px] rtl:translate-x-[36px]": layout.sidebar.opened() && !!params.dir,
                      "duration-180 ease-out": !layout.sidebar.opened(),
                      "duration-180 ease-in": layout.sidebar.opened(),
                    }}
                  >
                    <Show when={hasProjects() && nav()}>
                      <div class="flex items-center gap-0 transition-transform">
                        <Tooltip placement="bottom" value={language.t("common.goBack")} openDelay={800}>
                          <Button
                            variant="ghost"
                            icon="chevron-left"
                            class="titlebar-icon w-6 h-6 p-0 box-border"
                            disabled={!canBack()}
                            onClick={back}
                            aria-label={language.t("common.goBack")}
                          />
                        </Tooltip>
                        <Tooltip placement="bottom" value={language.t("common.goForward")} openDelay={800}>
                          <Button
                            variant="ghost"
                            icon="chevron-right"
                            class="titlebar-icon w-6 h-6 p-0 box-border"
                            disabled={!canForward()}
                            onClick={forward}
                            aria-label={language.t("common.goForward")}
                          />
                        </Tooltip>
                      </div>
                    </Show>
                    <div id="opencode-titlebar-left" class="flex items-center gap-3 min-w-0 px-2" />
                  </div>
                </div>
                <ChannelIndicator debugTools={props.debugTools} />
              </div>
            </div>

            <div class="min-w-0 flex items-center justify-center pointer-events-none">
              <div
                id="opencode-titlebar-center"
                class="pointer-events-auto min-w-0 flex justify-center w-fit max-w-full"
              />
            </div>

            <div
              classList={{
                "flex items-center min-w-0 justify-end": true,
                "pr-2": !windows(),
              }}
              data-tauri-drag-region
            >
              <div id="opencode-titlebar-right" class="flex items-center gap-1 shrink-0 justify-end" />
              <Show when={windows()}>
                <div class="shrink-0" style={{ width: windowsControlsWidth() }} />
              </Show>
            </div>
          </div>
        </Match>
      </Switch>
    </header>
  )
}

type TitlebarUpdatePillState = {
  visible: boolean
  installing: boolean
  version?: string
  label: string
  ariaLabel: string
  title?: string
  installLabel: string
  installingLabel: string
  featuresLabel: string
  fixesLabel: string
  performanceLabel: string
  uiLabel: string
  loadingLabel: string
  unavailableLabel: string
  moreLabel: string
  onInstall: () => void
}

type TitlebarV2RightState = {
  update: TitlebarUpdatePillState
  remoteAccess?: { label: string; open: () => void }
}

function TitlebarV2Right(props: { state: TitlebarV2RightState }) {
  return (
    <div class="relative z-20 flex shrink-0 items-center justify-end gap-0 overflow-visible">
      <Show when={props.state.remoteAccess}>
        {(remoteAccess) => (
          <TooltipV2 placement="bottom" value={remoteAccess().label}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="large"
              class="titlebar-mobile-access"
              icon={<IconV2 name="smartphone" />}
              onClick={remoteAccess().open}
              aria-label={remoteAccess().label}
            />
          </TooltipV2>
        )}
      </Show>
      <Show when={props.state.update.visible}>
        <TitlebarUpdateIconButton state={props.state.update} />
      </Show>
      <div id="opencode-titlebar-right" class="flex shrink-0 items-center justify-end gap-0" />
    </div>
  )
}

function TitlebarUpdateIconButton(props: { state: TitlebarUpdatePillState }) {
  const language = useLanguage()
  const [shown, setShown] = createSignal(false)
  const [status, setStatus] = createSignal<"idle" | "loading" | "ready" | "unavailable">("idle")
  const [release, setRelease] = createSignal<ReleaseNote>()
  let controller: AbortController | undefined
  let requestedVersion: string | undefined
  let triggerElement: HTMLElement | undefined

  const loadRelease = async (version: string) => {
    if ((requestedVersion === version && status() !== "unavailable") || status() === "loading") return
    controller?.abort()
    const request = new AbortController()
    controller = request
    requestedVersion = version
    setStatus("loading")
    setRelease(undefined)

    try {
      const response = await fetch(CHANGELOG_URL, {
        signal: request.signal,
        headers: { Accept: "application/json" },
      })
      if (!response.ok) throw new Error("Changelog unavailable")
      const item = findReleaseNote(await response.json(), version)
      if (request.signal.aborted) return
      setRelease(item)
      setStatus(item ? "ready" : "unavailable")
    } catch {
      if (request.signal.aborted) return
      setStatus("unavailable")
    }
  }

  const handleOpenChange = (next: boolean) => {
    setShown(next)
    if (next && props.state.version) void loadRelease(props.state.version)
  }

  createEffect(
    on(
      () => props.state.version,
      (version) => {
        if (requestedVersion === version) return
        controller?.abort()
        requestedVersion = undefined
        setRelease(undefined)
        setStatus("idle")
        if (shown() && version) void loadRelease(version)
      },
    ),
  )

  onCleanup(() => controller?.abort())

  const sectionTitle = (title: string) => {
    const key = title.trim().toLowerCase()
    if (key === "features" || key === "new features") return props.state.featuresLabel
    if (key === "bug fixes" || key === "fixes") return props.state.fixesLabel
    if (key === "performance and reliability") return props.state.performanceLabel
    if (key === "ui improvements") return props.state.uiLabel
    return title
  }

  const formatDate = (value: string | undefined) => {
    if (!value) return
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return
    return new Intl.DateTimeFormat(language.locale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  return (
    <KobaltePopover open={shown()} onOpenChange={handleOpenChange} placement="bottom-end" gutter={8}>
      <div class="group relative mr-3 h-5 w-5 shrink-0 rounded-full bg-v2-background-bg-deep transition-[width] duration-150 ease-out hover:z-30 hover:w-[68px] focus-within:z-30 focus-within:w-[68px] motion-reduce:transition-none">
        <KobaltePopover.Trigger
          as="button"
          ref={(el) => (triggerElement = el)}
          type="button"
          class="absolute right-0 top-0 z-10 flex h-5 w-5 items-center justify-end overflow-hidden rounded-full bg-v2-icon-icon-accent/20 text-v2-icon-icon-accent transition-[width,background-color] duration-150 ease-out group-hover:w-[68px] group-hover:bg-[color-mix(in_srgb,var(--v2-icon-icon-accent)_20%,var(--v2-background-bg-deep))] group-focus-within:w-[68px] group-focus-within:bg-[color-mix(in_srgb,var(--v2-icon-icon-accent)_20%,var(--v2-background-bg-deep))] focus-visible:outline-none disabled:opacity-60 motion-reduce:transition-none"
          disabled={props.state.installing}
          aria-busy={props.state.installing}
          aria-label={props.state.ariaLabel}
          title={props.state.title}
        >
          <span class="shrink-0 ml-[8px] mr-px text-[11px] text-v2-text-text-accent [font-weight:530] opacity-0 translate-x-2 motion-safe:transition-all duration-150 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 motion-reduce:translate-x-0">
            {props.state.label}
          </span>
          <span class="flex size-5 shrink-0 items-center justify-center">
            <Show
              when={!props.state.installing}
              fallback={<span data-slot="titlebar-update-loader" aria-hidden="true" />}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 11V3M3.5 7.63128L7 11L10.5 7.63128" stroke="currentColor" />
              </svg>
            </Show>
          </span>
        </KobaltePopover.Trigger>
      </div>
      <KobaltePopover.Portal>
        <KobaltePopover.Content
          ref={(el) => {
            const theme = triggerElement?.closest("[data-theme]")?.getAttribute("data-theme")
            if (theme) el.setAttribute("data-theme", theme)
          }}
          data-component="titlebar-update-popover"
          class="z-50 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-v2-border-border-base bg-v2-background-bg-base text-v2-text-text-base shadow-[var(--v2-elevation-floating)] outline-none"
        >
          <div class="max-h-[min(520px,calc(var(--app-viewport-height)-56px))] overflow-y-auto p-4">
            <header class="border-b border-v2-border-border-base pb-3">
              <h2 class="text-14-medium text-v2-text-text-strong">
                {props.state.version ? props.state.title : props.state.label}
              </h2>
              <Show when={formatDate(release()?.date)}>
                {(date) => <time class="mt-1 block text-12-regular text-v2-text-text-muted">{date()}</time>}
              </Show>
            </header>

            <Show when={status() === "loading"}>
              <p class="py-4 text-13-regular text-v2-text-text-muted">{props.state.loadingLabel}</p>
            </Show>
            <Show when={status() === "unavailable" || (status() === "ready" && !release()?.sections.length)}>
              <p class="py-4 text-13-regular leading-5 text-v2-text-text-muted">{props.state.unavailableLabel}</p>
            </Show>
            <For each={release()?.sections ?? []}>
              {(section) => (
                <section class="pt-3">
                  <h3 class="mb-2 text-13-medium text-v2-text-text-strong">{sectionTitle(section.title)}</h3>
                  <ul class="list-disc space-y-1.5 pl-5 text-13-regular leading-5 text-v2-text-text-base">
                    <For each={section.items.slice(0, 6)}>{(item) => <li>{item}</li>}</For>
                  </ul>
                </section>
              )}
            </For>

            <footer class="mt-4 flex items-center justify-between gap-3 border-t border-v2-border-border-base pt-3">
              <a
                href={release()?.url ?? CHANGELOG_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="text-12-regular text-v2-text-text-muted underline decoration-v2-border-border-base underline-offset-2 hover:text-v2-text-text-base"
              >
                {props.state.moreLabel}
              </a>
              <ButtonV2
                type="button"
                size="small"
                variant="neutral"
                disabled={props.state.installing}
                onClick={() => {
                  setShown(false)
                  props.state.onInstall()
                }}
              >
                {props.state.installing ? props.state.installingLabel : props.state.installLabel}
              </ButtonV2>
            </footer>
          </div>
        </KobaltePopover.Content>
      </KobaltePopover.Portal>
    </KobaltePopover>
  )
}

function ChannelIndicator(props: { debugTools?: { visible: boolean; toggle: () => void } }) {
  const platform = usePlatform()
  const language = useLanguage()
  const channel = import.meta.env.VITE_OPENCTRLC_CHANNEL
  const [host, setHost] = createSignal(remoteHostName(platform.remoteSessionID))
  const [liteNet, setLiteNet] = createSignal(readNetworkQuality().lite)
  const [transport, setTransport] = createSignal<RemoteTransportStatus>(
    platform.remoteTransport?.getStatus() ?? "relay",
  )
  const desktops = createMemo(() => listRemoteDesktops())
  const activeId = createMemo(() => activeRemoteSessionID())

  onMount(() => {
    setLiteNet(readNetworkQuality().lite)
    const unsubscribeNetwork = onNetworkQualityChange((quality) => setLiteNet(quality.lite))
    const unsubscribe = platform.remoteTransport?.subscribe(setTransport)
    onCleanup(() => {
      unsubscribeNetwork()
      unsubscribe?.()
    })
  })

  const transportState = createMemo(() => {
    if (!platform.remoteSessionID) return
    const status = transport()
    if (status === "direct")
      return {
        label: language.t("remote.transport.direct"),
        hint: language.t("remote.transport.directHint"),
        class: "bg-v2-state-bg-success text-v2-state-fg-success",
        dot: "bg-v2-state-fg-success",
      }
    if (status === "turn")
      return {
        label: language.t("remote.transport.turn"),
        hint: language.t("remote.transport.turnHint"),
        class: "bg-v2-background-bg-layer-01 text-v2-text-text-muted",
        dot: "bg-v2-text-text-muted",
      }
    if (status === "checking")
      return {
        label: language.t("remote.transport.checking"),
        hint: language.t("remote.transport.checkingHint"),
        class: "bg-v2-state-bg-warning text-v2-state-fg-warning",
        dot: "bg-v2-state-fg-warning",
      }
    if (status === "connecting")
      return {
        label: language.t("remote.transport.connecting"),
        hint: language.t("remote.transport.connectingHint"),
        class: "bg-v2-state-bg-warning text-v2-state-fg-warning",
        dot: "bg-v2-state-fg-warning",
      }
    if (status === "unavailable")
      return {
        label: language.t("remote.transport.unavailable"),
        hint: language.t("remote.transport.unavailableHint"),
        class: "bg-v2-background-bg-layer-01 text-v2-text-text-muted",
        dot: "bg-v2-text-text-muted",
      }
    return {
      label: language.t("remote.transport.relay"),
      hint: language.t("remote.transport.relayHint"),
      class: "bg-v2-background-bg-layer-01 text-v2-text-text-muted",
      dot: "bg-v2-text-text-muted",
    }
  })

  const transportChip = () => (
    <Show when={transportState()}>
      {(state) => (
        <div
          class={`flex max-w-[150px] min-w-0 items-center gap-1.5 truncate rounded-sm px-2 text-12-regular ${state().class}`}
          title={state().hint}
          aria-label={state().hint}
          role="status"
          aria-live="polite"
        >
          <span class={`size-1.5 shrink-0 rounded-full ${state().dot}`} aria-hidden="true" />
          <span class="truncate">{state().label}</span>
        </div>
      )}
    </Show>
  )

  createEffect(() => {
    const known = remoteHostName(platform.remoteSessionID)
    if (known) {
      setHost(known)
      return
    }
    void platform.remoteAccess
      ?.getState()
      .then((state) => {
        if (state.hostName) setHost(state.hostName)
      })
      .catch(() => undefined)
  })

  const hostChip = createMemo(() => {
    const name = host()
    const list = desktops()
    if (list.length > 1) {
      return (
        <select
          class="max-w-[180px] truncate rounded-sm border-0 bg-v2-background-bg-layer-01 px-2 text-12-regular text-v2-text-text-base"
          title={name}
          value={activeId() ?? ""}
          onChange={(event) => {
            const id = event.currentTarget.value
            if (id) switchRemoteDesktop(id)
          }}
        >
          {list.map((item) => (
            <option value={item.sessionID} selected={item.sessionID === activeId()}>
              {item.hostName}
            </option>
          ))}
        </select>
      )
    }
    if (!name) return null
    return (
      <div
        class="max-w-[160px] truncate rounded-sm bg-v2-background-bg-layer-01 px-2 text-12-regular text-v2-text-text-base"
        title={name}
      >
        {name}
      </div>
    )
  })
  if (channel === "dev" && props.debugTools) {
    return (
      <>
        <button
          type="button"
          class="bg-icon-interactive-base text-[#FFF] font-medium px-2 rounded-sm uppercase font-mono cursor-pointer"
          onClick={props.debugTools.toggle}
          aria-label="Toggle debug tools"
          aria-pressed={props.debugTools.visible}
        >
          DEV
        </button>
        <Show when={liteNet()}>
          <div
            class="rounded-sm bg-v2-state-bg-warning px-2 text-12-regular text-v2-state-fg-warning"
            title={language.t("remote.liteNetworkHint")}
          >
            {language.t("remote.liteNetwork")}
          </div>
        </Show>
        {transportChip()}
        {hostChip()}
      </>
    )
  }

  return (
    <>
      {["beta", "dev"].includes(channel) && (
        <div class="bg-icon-interactive-base text-[#FFF] font-medium px-2 rounded-sm uppercase font-mono">
          {channel.toUpperCase()}
        </div>
      )}
      <Show when={liteNet()}>
        <div
          class="rounded-sm bg-v2-state-bg-warning px-2 text-12-regular text-v2-state-fg-warning"
          title={language.t("remote.liteNetworkHint")}
        >
          {language.t("remote.liteNetwork")}
        </div>
      </Show>
      {transportChip()}
      {hostChip()}
    </>
  )
}
