import { Button } from "@openctrlc/ui/button"
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
  const [error, setError] = createSignal<string>()
  const [importing, setImporting] = createSignal(false)
  const validSessionID = createMemo(() => isOpenCodeSessionID(sessionID()))

  const chooseDatabase = async () => {
    const path = await platform.openFilePickerDialog?.({
      title: language.t("dialog.session.importOpencode.database.choose"),
      extensions: ["db"],
    })
    if (path) {
      setDatabasePath(path)
      setError(undefined)
    }
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (importing()) return

    const id = sessionID().trim()
    if (!isOpenCodeSessionID(id)) {
      setError(language.t("dialog.session.importOpencode.error.sessionID"))
      return
    }

    const importSession = platform.importOpenCodeSession
    if (!importSession) {
      setError(language.t("dialog.session.importOpencode.error.unavailable"))
      return
    }

    setImporting(true)
    setError(undefined)
    try {
      const result = await importSession({
        sessionID: id,
        directory: props.directory,
        databasePath: databasePath() || undefined,
      })
      layout.projects.open(props.directory)
      server.projects.touch(props.directory)
      await serverSync().project.loadSessions(props.directory)
      await serverSync().ensureDirSyncContext(props.directory).session.sync(result.sessionID, { force: true })
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
      class="w-full max-w-[480px]"
      transition
    >
      <form onSubmit={submit} class="flex flex-col gap-6 px-2.5 pb-3">
        <div class="flex flex-col gap-4">
          <TextField
            autofocus
            label={language.t("dialog.session.importOpencode.sessionID.label")}
            placeholder={language.t("dialog.session.importOpencode.sessionID.placeholder")}
            value={sessionID()}
            onChange={(value) => {
              setSessionID(value)
              setError(undefined)
            }}
            validationState={sessionID() && !validSessionID() ? "invalid" : undefined}
            error={sessionID() && !validSessionID() ? language.t("dialog.session.importOpencode.error.sessionID") : undefined}
            spellcheck={false}
            disabled={importing()}
          />

          <div class="flex flex-col gap-2">
            <div class="text-12-medium text-text-weak">
              {language.t("dialog.session.importOpencode.database.label")}
            </div>
            <div class="flex items-center gap-3 rounded-md border border-border-weak-base px-3 py-2">
              <div class="min-w-0 flex-1 text-12-regular text-text-base">
                <Show
                  when={databasePath()}
                  fallback={language.t("dialog.session.importOpencode.database.default")}
                >
                  <span class="block truncate">{databasePath()}</span>
                </Show>
              </div>
              <Button type="button" variant="secondary" size="small" onClick={chooseDatabase} disabled={importing()}>
                {language.t("dialog.session.importOpencode.database.choose")}
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <div class="text-12-medium text-text-weak">{language.t("dialog.session.importOpencode.target.label")}</div>
            <div class="truncate text-12-regular text-text-base" title={props.directory}>
              {props.directory}
            </div>
          </div>
        </div>

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
          <Button type="submit" variant="primary" size="large" disabled={!validSessionID() || importing()}>
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
