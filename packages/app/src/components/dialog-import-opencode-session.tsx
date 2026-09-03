import { Button } from "@openctrlc/ui/button"
import { Icon } from "@openctrlc/ui/icon"
import { useDialog } from "@openctrlc/ui/context/dialog"
import { Dialog } from "@openctrlc/ui/dialog"
import { TextField } from "@openctrlc/ui/text-field"
import { createMemo, createSignal, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useServerSync } from "@/context/server-sync"
import { useTabs } from "@/context/tabs"
import { isOpenCodeSessionID } from "@/utils/opencode-import"
import { showToast } from "@/utils/toast"

type LookupState = "idle" | "loading" | "found" | "not-found" | "error"

export function DialogImportOpenCodeSession(props: { directory: string }) {
  const dialog = useDialog()
  const language = useLanguage()
  const layout = useLayout()
  const platform = usePlatform()
  const server = useServer()
  const serverSync = useServerSync()
  const tabs = useTabs()
  const [sessionID, setSessionID] = createSignal("")
  const [databasePath, setDatabasePath] = createSignal("")
  const [targetDirectory, setTargetDirectory] = createSignal(props.directory)
  const [targetSource, setTargetSource] = createSignal<"current" | "session" | "custom">("current")
  const [sessionInfo, setSessionInfo] = createSignal<{
    sessionID: string
    title: string
    directory: string
    messageCount: number
  }>()
  const [lookupState, setLookupState] = createSignal<LookupState>("idle")
  const [error, setError] = createSignal<string>()
  const [importing, setImporting] = createSignal(false)
  const normalizedSessionID = createMemo(() => sessionID().trim())
  const validSessionID = createMemo(() => isOpenCodeSessionID(normalizedSessionID()))
  let lookupRequest = 0

  const resetLookup = () => {
    lookupRequest += 1
    setSessionInfo(undefined)
    setLookupState("idle")
    setTargetDirectory(props.directory)
    setTargetSource("current")
  }

  const lookup = async () => {
    const id = normalizedSessionID()
    if (!isOpenCodeSessionID(id)) {
      resetLookup()
      setError(language.t("dialog.session.importOpencode.error.sessionID"))
      return
    }

    const getInfo = platform.getOpenCodeSessionInfo
    if (!getInfo) {
      setLookupState("error")
      setError(language.t("dialog.session.importOpencode.error.unavailable"))
      return
    }

    const request = ++lookupRequest
    setLookupState("loading")
    setSessionInfo(undefined)
    setError(undefined)
    try {
      const info = await getInfo({
        sessionID: id,
        databasePath: databasePath() || undefined,
      })
      if (request !== lookupRequest) return
      if (!info) {
        setLookupState("not-found")
        return
      }

      setSessionInfo(info)
      setLookupState("found")
      if (info.directory) {
        setTargetDirectory(info.directory)
        setTargetSource("session")
      }
    } catch (cause) {
      if (request !== lookupRequest) return
      setLookupState("error")
      setError(formatImportError(cause))
    }
  }

  const chooseDatabase = async () => {
    const path = await platform.openFilePickerDialog?.({
      title: language.t("dialog.session.importOpencode.database.choose"),
      extensions: ["db"],
    })
    if (!path) return

    setDatabasePath(path)
    resetLookup()
    setError(undefined)
    if (validSessionID()) void lookup()
  }

  const resetDatabase = () => {
    setDatabasePath("")
    resetLookup()
    setError(undefined)
    if (validSessionID()) void lookup()
  }

  const chooseTargetDirectory = async () => {
    if (platform.platform !== "desktop") return
    const selected = await platform.openDirectoryPickerDialog({
      title: language.t("dialog.session.importOpencode.target.choose"),
      defaultPath: targetDirectory(),
    })
    const directory = Array.isArray(selected) ? selected[0] : selected
    if (!directory) return
    setTargetDirectory(directory)
    setTargetSource("custom")
  }

  const resetTargetDirectory = () => {
    const directory = sessionInfo()?.directory || props.directory
    setTargetDirectory(directory)
    setTargetSource(sessionInfo()?.directory ? "session" : "current")
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (importing()) return

    const id = normalizedSessionID()
    if (!isOpenCodeSessionID(id)) {
      setError(language.t("dialog.session.importOpencode.error.sessionID"))
      return
    }

    const importSession = platform.importOpenCodeSession
    if (!importSession) {
      setError(language.t("dialog.session.importOpencode.error.unavailable"))
      return
    }

    if (!sessionInfo()) {
      await lookup()
      if (!sessionInfo()) return
    }

    setImporting(true)
    setError(undefined)
    try {
      const result = await importSession({
        sessionID: id,
        directory: targetDirectory(),
        databasePath: databasePath() || undefined,
      })
      layout.projects.open(targetDirectory())
      server.projects.touch(targetDirectory())
      await serverSync().project.loadSessions(targetDirectory())
      await serverSync().ensureDirSyncContext(targetDirectory()).session.sync(result.sessionID, { force: true })
      const tab = tabs.addSessionTab({ server: server.key, sessionId: result.sessionID })
      tabs.select(tab)
      dialog.close()
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("dialog.session.importOpencode.success.title"),
        description: language.t("dialog.session.importOpencode.success.description", { id: result.sessionID }),
      })
    } catch (cause) {
      setError(formatImportError(cause))
      setImporting(false)
    }
  }

  return (
    <Dialog
      title={language.t("dialog.session.importOpencode.title")}
      description={language.t("dialog.session.importOpencode.description")}
      class="w-full max-w-[520px]"
      transition
    >
      <form onSubmit={submit} class="flex flex-col gap-5 px-2.5 pb-3">
        <section class="flex flex-col gap-3" aria-labelledby="opencode-source-heading">
          <div class="flex items-center justify-between gap-3">
            <h2 id="opencode-source-heading" class="text-12-medium text-text-weak">
              {language.t("dialog.session.importOpencode.source.label")}
            </h2>
            <Show when={lookupState() === "found"}>
              <span class="flex items-center gap-1 text-11-medium text-text-on-success-base">
                <Icon name="check-small" size="small" />
                {language.t("dialog.session.importOpencode.source.found")}
              </span>
            </Show>
          </div>

          <div class="flex items-end gap-2">
            <div class="min-w-0 flex-1">
              <TextField
                autofocus
                label={language.t("dialog.session.importOpencode.sessionID.label")}
                placeholder={language.t("dialog.session.importOpencode.sessionID.placeholder")}
                value={sessionID()}
                onChange={(value) => {
                  setSessionID(value)
                  resetLookup()
                  setError(undefined)
                }}
                validationState={sessionID() && !validSessionID() ? "invalid" : undefined}
                error={
                  sessionID() && !validSessionID()
                    ? language.t("dialog.session.importOpencode.error.sessionID")
                    : undefined
                }
                onKeyDown={(event: KeyboardEvent) => {
                  if (event.key !== "Enter") return
                  event.preventDefault()
                  void lookup()
                }}
                spellcheck={false}
                disabled={importing()}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="large"
              icon="magnifying-glass"
              onClick={() => void lookup()}
              disabled={!validSessionID() || lookupState() === "loading" || importing()}
            >
              {lookupState() === "loading"
                ? language.t("dialog.session.importOpencode.lookup.loading")
                : language.t("dialog.session.importOpencode.lookup")}
            </Button>
          </div>

          <Show when={lookupState() === "not-found"}>
            <div
              class="flex items-start gap-2 rounded-md bg-surface-warning-weak px-3 py-2 text-12-regular text-text-base"
              role="alert"
            >
              <Icon name="warning" size="small" class="mt-0.5 shrink-0 text-text-on-warning-strong" />
              <span>{language.t("dialog.session.importOpencode.source.notFound")}</span>
            </div>
          </Show>

          <Show when={sessionInfo()}>
            {(info) => (
              <div class="rounded-md border border-border-weak-base bg-surface-panel px-3 py-3">
                <div class="flex items-start gap-2.5">
                  <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-info-weak text-icon-info-active">
                    <Icon name="bubble-5" size="small" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-14-medium text-text-strong" title={info().title}>
                      {info().title || info().sessionID}
                    </div>
                    <div class="mt-0.5 text-12-regular text-text-weak">
                      {language.t("dialog.session.importOpencode.source.messages", { count: info().messageCount })}
                    </div>
                  </div>
                </div>
                <div class="mt-3 flex items-start gap-2 border-t border-border-weak-base pt-3">
                  <Icon name="folder" size="small" class="mt-0.5 shrink-0 text-icon-weak" />
                  <div class="min-w-0">
                    <div class="text-11-medium text-text-weak">
                      {language.t("dialog.session.importOpencode.source.workdir")}
                    </div>
                    <div class="mt-0.5 break-all text-12-regular leading-5 text-text-base">{info().directory}</div>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </section>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3">
            <div class="text-12-medium text-text-weak">
              {language.t("dialog.session.importOpencode.database.label")}
            </div>
            <Show when={databasePath()}>
              <Button
                type="button"
                variant="ghost"
                size="small"
                icon="reset"
                onClick={resetDatabase}
                disabled={importing()}
              >
                {language.t("dialog.session.importOpencode.database.reset")}
              </Button>
            </Show>
          </div>
          <div class="flex items-center gap-3 rounded-md border border-border-weak-base px-3 py-2">
            <div class="min-w-0 flex-1 text-12-regular text-text-base">
              <Show when={databasePath()} fallback={language.t("dialog.session.importOpencode.database.default")}>
                <span class="block truncate" title={databasePath()}>
                  {databasePath()}
                </span>
              </Show>
            </div>
            <Button type="button" variant="secondary" size="small" onClick={chooseDatabase} disabled={importing()}>
              {language.t("dialog.session.importOpencode.database.choose")}
            </Button>
          </div>
        </div>

        <section class="flex flex-col gap-2" aria-labelledby="opencode-target-heading">
          <div class="flex items-center justify-between gap-3">
            <h2 id="opencode-target-heading" class="text-12-medium text-text-weak">
              {language.t("dialog.session.importOpencode.target.label")}
            </h2>
            <Show when={targetSource() === "session"}>
              <span class="text-11-regular text-text-on-success-base">
                {language.t("dialog.session.importOpencode.target.fromSession")}
              </span>
            </Show>
          </div>
          <div class="flex items-center gap-3 rounded-md border border-border-weak-base bg-surface-panel px-3 py-2">
            <Icon name="folder" size="small" class="shrink-0 text-icon-weak" />
            <div class="min-w-0 flex-1 truncate text-12-regular text-text-base" title={targetDirectory()}>
              {targetDirectory()}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="small"
              icon="folder"
              onClick={chooseTargetDirectory}
              disabled={importing()}
            >
              {language.t("dialog.session.importOpencode.target.choose")}
            </Button>
          </div>
          <div class="flex items-start justify-between gap-3">
            <div class="text-11-regular leading-4 text-text-weak">
              {targetSource() === "session"
                ? language.t("dialog.session.importOpencode.target.hintSession")
                : language.t("dialog.session.importOpencode.target.hintCurrent")}
            </div>
            <Show when={targetSource() === "custom" && sessionInfo()}>
              <Button
                type="button"
                variant="ghost"
                size="small"
                icon="reset"
                onClick={resetTargetDirectory}
                disabled={importing()}
              >
                {language.t("dialog.session.importOpencode.target.reset")}
              </Button>
            </Show>
          </div>
        </section>

        <Show when={error()}>
          {(message) => (
            <div role="alert" class="rounded-md bg-surface-danger-base px-3 py-2 text-12-regular text-text-danger-base">
              {message()}
            </div>
          )}
        </Show>

        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="large" onClick={() => dialog.close()} disabled={importing()}>
            {language.t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="large"
            disabled={!validSessionID() || !sessionInfo() || !targetDirectory() || importing()}
          >
            {importing() ? language.t("common.loading") : language.t("common.open")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function formatImportError(error: unknown) {
  if (error instanceof Error && error.message) {
    if (typeof error === "object" && "stderr" in error && typeof error.stderr === "string" && error.stderr.trim()) {
      return error.stderr.trim()
    }
    return error.message
  }
  return String(error)
}
