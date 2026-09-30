import { ButtonV2 } from "@openctrlc/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitleGroup } from "@openctrlc/ui/v2/dialog-v2"
import { Icon as IconV2 } from "@openctrlc/ui/v2/icon"
import { createEffect, createResource, For, on, onCleanup, onMount, Show, createSignal } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import QRCode from "qrcode"
import { TextInputV2 } from "@openctrlc/ui/v2/text-input-v2"
import { useLanguage } from "@/context/language"
import { usePlatform, type RemoteAccessState } from "@/context/platform"
import { useDialog } from "@openctrlc/ui/context/dialog"

const emptyState: RemoteAccessState = {
  status: "stopped",
  pendingRequests: [],
  authorizedDevices: 0,
  viewerLimit: 10,
  effectiveViewerLimit: 3,
  viewerLimitSupported: false,
}

function normalizeRemoteAccessState(next: Partial<RemoteAccessState>): RemoteAccessState {
  const viewerLimit = isViewerLimit(next.viewerLimit) ? next.viewerLimit : emptyState.viewerLimit
  const reportedEffectiveViewerLimit = isViewerLimit(next.effectiveViewerLimit) ? next.effectiveViewerLimit : undefined
  const authorizedDevices =
    typeof next.authorizedDevices === "number" && Number.isSafeInteger(next.authorizedDevices) && next.authorizedDevices >= 0
      ? next.authorizedDevices
      : emptyState.authorizedDevices

  return {
    ...emptyState,
    ...next,
    pendingRequests: Array.isArray(next.pendingRequests) ? next.pendingRequests : emptyState.pendingRequests,
    authorizedDevices,
    viewerLimit,
    effectiveViewerLimit: reportedEffectiveViewerLimit ?? emptyState.effectiveViewerLimit,
    viewerLimitSupported: next.viewerLimitSupported === true && reportedEffectiveViewerLimit !== undefined,
  }
}

function isViewerLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100
}

export function DialogRemoteAccess() {
  const language = useLanguage()
  const platform = usePlatform()
  const dialog = useDialog()
  const remoteAccess = platform.remoteAccess
  const [state, setState] = createStore(emptyState)
  const [copied, setCopied] = createSignal(false)
  const [revokingViewer, setRevokingViewer] = createSignal<string>()
  const [revokeFailed, setRevokeFailed] = createSignal(false)
  const [viewerLimitDraft, setViewerLimitDraft] = createSignal(String(emptyState.viewerLimit))
  const [viewerLimitInvalid, setViewerLimitInvalid] = createSignal(false)
  const [viewerLimitSaveFailed, setViewerLimitSaveFailed] = createSignal(false)
  const [savingViewerLimit, setSavingViewerLimit] = createSignal(false)
  const [qrCode] = createResource(
    () => state.url,
    (url) => QRCode.toDataURL(url, { errorCorrectionLevel: "Q", margin: 2, width: 264 }),
  )
  let unsubscribe: (() => void) | undefined
  let disposed = false

  onMount(() => {
    if (!remoteAccess) return
    void remoteAccess
      .subscribe((next) => setState(reconcile(normalizeRemoteAccessState(next))))
      .then((stop) => {
        if (disposed) return stop()
        unsubscribe = stop
      })
  })
  onCleanup(() => {
    disposed = true
    unsubscribe?.()
  })

  createEffect(
    on(
      () => state.viewerLimit,
      (limit) => setViewerLimitDraft(String(limit)),
    ),
  )

  const copyLink = async () => {
    if (!state.url) return
    if (platform.writeClipboardText) await platform.writeClipboardText(state.url)
    else await navigator.clipboard.writeText(state.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const shortLink = () => {
    if (!state.url) return ""
    const url = new URL(state.url)
    return `${url.origin}${url.pathname}`
  }

  const revokeViewer = async (viewerID: string) => {
    setRevokingViewer(viewerID)
    setRevokeFailed(false)
    try {
      await remoteAccess?.revokeViewer(viewerID)
    } catch {
      setRevokeFailed(true)
    } finally {
      setRevokingViewer(undefined)
    }
  }

  const saveViewerLimit = async () => {
    const limit = Number(viewerLimitDraft())
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      setViewerLimitInvalid(true)
      return
    }
    setSavingViewerLimit(true)
    setViewerLimitInvalid(false)
    setViewerLimitSaveFailed(false)
    try {
      await remoteAccess?.setViewerLimit(limit)
    } catch {
      setViewerLimitSaveFailed(true)
    } finally {
      setSavingViewerLimit(false)
    }
  }

  return (
    <Dialog size="large" fit containerClass="!w-[min(calc(100vw_-_32px),680px)]">
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitleGroup
          title={language.t("remoteAccess.title")}
          description={language.t("remoteAccess.description")}
        />
      </DialogHeader>
      <DialogBody class="gap-3 px-4 py-4">
        <Show when={remoteAccess}>
          <section class="flex min-w-0 flex-wrap items-end justify-between gap-3 rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-3">
            <div class="min-w-0 flex-1">
              <label for="remote-access-viewer-limit" class="text-14-medium text-v2-text-text-strong">
                {language.t("remoteAccess.viewerLimitLabel")}
              </label>
              <p class="mt-1 text-12-regular leading-5 text-v2-text-text-muted">
                {language.t("remoteAccess.viewerLimitDescription")}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <TextInputV2
                id="remote-access-viewer-limit"
                type="number"
                min={1}
                max={100}
                step={1}
                inputMode="numeric"
                numeric
                style={{ width: "96px" }}
                aria-label={language.t("remoteAccess.viewerLimitLabel")}
                aria-describedby="remote-access-viewer-limit-help"
                invalid={viewerLimitInvalid()}
                value={viewerLimitDraft()}
                onInput={(event) => {
                  setViewerLimitDraft(event.currentTarget.value)
                  setViewerLimitInvalid(false)
                  setViewerLimitSaveFailed(false)
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return
                  event.preventDefault()
                  void saveViewerLimit()
                }}
              />
              <ButtonV2
                size="small"
                variant="outline"
                disabled={savingViewerLimit() || Number(viewerLimitDraft()) === state.viewerLimit}
                onClick={() => void saveViewerLimit()}
              >
                {language.t(savingViewerLimit() ? "remoteAccess.viewerLimitSaving" : "remoteAccess.viewerLimitSave")}
              </ButtonV2>
            </div>
            <p id="remote-access-viewer-limit-help" class="w-full text-12-regular leading-5 text-v2-text-text-muted">
              {language.t("remoteAccess.viewerLimitRange")}
            </p>
            <Show when={viewerLimitInvalid()}>
              <p class="w-full text-12-regular leading-5 text-v2-state-fg-danger" role="alert">
                {language.t("remoteAccess.viewerLimitInvalid")}
              </p>
            </Show>
            <Show when={viewerLimitSaveFailed()}>
              <p class="w-full text-12-regular leading-5 text-v2-state-fg-danger" role="alert">
                {language.t("remoteAccess.viewerLimitSaveFailed")}
              </p>
            </Show>
            <Show when={state.status === "active" && !state.viewerLimitSupported}>
              <p class="w-full text-12-regular leading-5 text-v2-state-fg-warning" role="status">
                {language.t("remoteAccess.viewerLimitRelayUnsupported")}
              </p>
            </Show>
            <Show when={state.authorizedDevices >= state.effectiveViewerLimit}>
              <p class="w-full text-12-regular leading-5 text-v2-state-fg-warning" role="status">
                {language.t("remoteAccess.viewerLimitOverCapacity")}
              </p>
            </Show>
          </section>
        </Show>
        <Show when={state.status === "active"}>
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-v2-state-bg-success px-3 py-2.5">
            <span
              class="flex items-center gap-2 text-14-medium text-v2-state-fg-success"
              role="status"
              aria-live="polite"
            >
              <span class="size-2 rounded-full bg-v2-state-fg-success" aria-hidden="true" />
              {language.t("remoteAccess.active")}
            </span>
            <span class="text-12-regular text-v2-state-fg-success">
              {language.t("remoteAccess.deviceCount", {
                count: state.authorizedDevices,
                limit: state.effectiveViewerLimit,
              })}
            </span>
          </div>
          <Show when={state.pendingRequests.length > 0}>
            <section
              class="flex flex-col gap-2 rounded-xl border border-v2-state-border-warning bg-v2-state-bg-warning p-3 sm:p-4"
              aria-label={language.t("remoteAccess.pending")}
              aria-live="polite"
            >
              <div class="flex items-center gap-2 text-14-medium text-v2-state-fg-warning">
                <span aria-hidden="true">
                  <IconV2 name="smartphone" size="small" />
                </span>
                {language.t("remoteAccess.pending")}
              </div>
              <div class="flex flex-col gap-2">
                <For each={state.pendingRequests}>
                  {(request) => (
                    <div class="flex min-w-0 flex-col gap-3 rounded-lg bg-v2-background-bg-layer-01 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div class="min-w-0">
                        <div class="break-all text-14-medium text-v2-text-text-strong">{request.device}</div>
                        <p class="mt-1 text-12-regular leading-5 text-v2-text-text-muted">
                          {language.t("remoteAccess.pendingDescription")}
                        </p>
                      </div>
                      <div class="flex shrink-0 flex-wrap gap-2">
                        <ButtonV2
                          size="small"
                          disabled={state.authorizedDevices >= state.effectiveViewerLimit}
                          onClick={() => remoteAccess?.approve(request.id)}
                        >
                          {language.t("remoteAccess.approve")}
                        </ButtonV2>
                        <ButtonV2 size="small" variant="ghost" onClick={() => remoteAccess?.deny(request.id)}>
                          {language.t("remoteAccess.deny")}
                        </ButtonV2>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </section>
          </Show>
          <div class="grid min-h-0 gap-3 sm:grid-cols-2">
            <section class="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-4">
              <Show
                when={qrCode()}
                fallback={
                  <div class="size-[224px] animate-pulse rounded-lg bg-v2-background-bg-base" aria-hidden="true" />
                }
              >
                {(source) => (
                  <img
                    src={source()}
                    alt={language.t("remoteAccess.scan")}
                    class="size-[224px] rounded-lg bg-white p-1"
                  />
                )}
              </Show>
              <p class="text-center text-14-medium text-v2-text-text-strong">{language.t("remoteAccess.scan")}</p>
              <p
                class="w-full truncate rounded-md bg-v2-background-bg-base px-2.5 py-2 text-center text-12-regular text-v2-text-text-muted"
                title={shortLink()}
              >
                {shortLink()}
              </p>
              <div class="flex w-full flex-wrap justify-center gap-2">
                <ButtonV2 size="small" variant="outline" onClick={() => void copyLink()}>
                  {copied() ? language.t("remoteAccess.copySuccess") : language.t("remoteAccess.copyLink")}
                </ButtonV2>
                <ButtonV2 size="small" variant="outline" onClick={() => void remoteAccess?.rotatePairingLink()}>
                  {language.t("remoteAccess.refresh")}
                </ButtonV2>
              </div>
            </section>
            <section class="flex min-w-0 flex-col gap-3 rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-4">
              <div>
                <div class="text-14-medium text-v2-text-text-strong">{language.t("remoteAccess.securityTitle")}</div>
                <p class="mt-1 text-12-regular leading-5 text-v2-text-text-muted">
                  {language.t("remoteAccess.securityDescription")}
                </p>
              </div>
              <div class="rounded-lg bg-v2-background-bg-base p-3 text-12-regular leading-5 text-v2-text-text-muted">
                {language.t("remoteAccess.relayPrivacy")}
              </div>
              <Show when={state.authorizedViewers}>
                <section class="border-t border-v2-border-border-base pt-3">
                  <div class="text-14-medium text-v2-text-text-strong">
                    {language.t("remoteAccess.authorizedTitle")}
                  </div>
                  <p class="mt-1 text-12-regular leading-5 text-v2-text-text-muted">
                    {language.t("remoteAccess.authorizedDescription")}
                  </p>
                  <Show
                    when={(state.authorizedViewers?.length ?? 0) > 0}
                    fallback={
                      <p class="mt-2 rounded-lg bg-v2-background-bg-base p-3 text-12-regular text-v2-text-text-muted">
                        {language.t("remoteAccess.authorizedEmpty")}
                      </p>
                    }
                  >
                    <div class="mt-2 flex flex-col gap-2">
                      <For each={state.authorizedViewers}>
                        {(viewer) => (
                          <div class="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-v2-background-bg-base p-3">
                            <div class="min-w-0 flex-1">
                              <div
                                class="truncate text-14-medium text-v2-text-text-strong"
                                title={`${viewer.device} · #${viewer.id.slice(0, 6)}`}
                              >
                                {viewer.device} · #{viewer.id.slice(0, 6)}
                              </div>
                            </div>
                            <ButtonV2
                              size="small"
                              variant="danger"
                              class="shrink-0 whitespace-nowrap"
                              aria-label={`${language.t(
                                revokingViewer() === viewer.id ? "remoteAccess.revoking" : "remoteAccess.revoke",
                              )} ${viewer.device} #${viewer.id.slice(0, 6)}`}
                              disabled={revokingViewer() === viewer.id}
                              onClick={() => void revokeViewer(viewer.id)}
                            >
                              {language.t(
                                revokingViewer() === viewer.id ? "remoteAccess.revoking" : "remoteAccess.revoke",
                              )}
                            </ButtonV2>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <Show when={revokeFailed()}>
                    <p class="mt-2 text-12-regular leading-5 text-v2-state-fg-danger" role="alert">
                      {language.t("remoteAccess.revokeFailed")}
                    </p>
                  </Show>
                </section>
              </Show>
              <Show when={state.pendingRequests.length === 0}>
                <div class="border-t border-v2-border-border-base pt-3">
                  <div class="mb-2 text-14-medium text-v2-text-text-strong">
                    {language.t("remoteAccess.waitingTitle")}
                  </div>
                  <div class="flex items-start gap-2 rounded-lg bg-v2-background-bg-base p-3">
                    <span
                      class="mt-0.5 flex size-5 shrink-0 items-center justify-center text-v2-text-text-muted"
                      aria-hidden="true"
                    >
                      <IconV2 name="smartphone" size="small" />
                    </span>
                    <span class="text-12-regular leading-5 text-v2-text-text-muted">
                      {language.t("remoteAccess.waitingDescription")}
                    </span>
                  </div>
                </div>
              </Show>
            </section>
          </div>
        </Show>

        <Show when={state.status === "connecting"}>
          <div
            class="flex min-h-48 items-center justify-center rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-5"
            role="status"
            aria-live="polite"
          >
            <div class="flex max-w-sm flex-col items-center gap-3 text-center">
              <span
                class="flex size-12 items-center justify-center rounded-xl bg-v2-background-bg-accent/10 text-v2-icon-icon-accent"
                aria-hidden="true"
              >
                <IconV2 name="smartphone" size="large" />
              </span>
              <p class="text-14-medium text-v2-text-text-strong">{language.t("remoteAccess.starting")}</p>
            </div>
          </div>
        </Show>
        <Show when={state.status === "reconnecting"}>
          <div
            class="flex min-h-48 items-center justify-center rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-5"
            role="status"
            aria-live="polite"
          >
            <div class="flex max-w-sm flex-col items-center gap-3 text-center">
              <span
                class="flex size-12 items-center justify-center rounded-xl bg-v2-background-bg-accent/10 text-v2-icon-icon-accent"
                aria-hidden="true"
              >
                <IconV2 name="smartphone" size="large" />
              </span>
              <p class="text-14-medium text-v2-text-text-strong">{language.t("remoteAccess.reconnecting")}</p>
              <p class="text-12-regular leading-5 text-v2-text-text-muted">
                {language.t("remoteAccess.reconnectingDescription")}
              </p>
            </div>
          </div>
        </Show>
        <Show when={state.status === "stopped" || state.status === "error"}>
          <div class="grid gap-3 sm:grid-cols-2">
            <section class="flex flex-col gap-4 rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-4">
              <div class="flex items-center gap-3">
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-v2-background-bg-accent/10 text-v2-icon-icon-accent"
                  aria-hidden="true"
                >
                  <IconV2 name="smartphone" size="large" />
                </span>
                <div class="min-w-0">
                  <div class="text-14-medium text-v2-text-text-strong">{language.t("remoteAccess.setupTitle")}</div>
                </div>
              </div>
              <Show when={state.status === "error"}>
                <div
                  class="rounded-lg bg-v2-state-bg-danger px-3 py-2 text-12-regular leading-5 text-v2-state-fg-danger"
                  role="alert"
                >
                  {language.t(
                    state.error === "reconnect-failed" ? "remoteAccess.reconnectFailed" : "remoteAccess.error",
                  )}
                </div>
              </Show>
              <ol class="flex flex-col gap-3 border-t border-v2-border-border-base pt-4">
                <For each={["remoteAccess.stepEnable", "remoteAccess.stepScan", "remoteAccess.stepApprove"] as const}>
                  {(step, index) => (
                    <li class="flex items-center gap-3 text-12-regular text-v2-text-text-base">
                      <span
                        class="flex size-6 shrink-0 items-center justify-center rounded-full bg-v2-background-bg-base text-12-medium text-v2-text-text-muted"
                        aria-hidden="true"
                      >
                        {index() + 1}
                      </span>
                      {language.t(step)}
                    </li>
                  )}
                </For>
              </ol>
            </section>
            <section class="flex flex-col gap-3 rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-01 p-4">
              <div class="text-14-medium text-v2-text-text-strong">{language.t("remoteAccess.securityTitle")}</div>
              <p class="text-12-regular leading-5 text-v2-text-text-muted">
                {language.t("remoteAccess.securityDescription")}
              </p>
              <div class="rounded-lg bg-v2-background-bg-base p-3 text-12-regular leading-5 text-v2-text-text-muted">
                {language.t("remoteAccess.relayPrivacy")}
              </div>
            </section>
          </div>
        </Show>
      </DialogBody>
      <DialogFooter>
        <ButtonV2 variant="ghost" onClick={() => dialog.close()}>
          {language.t("common.close")}
        </ButtonV2>
        <Show when={state.status === "stopped" || state.status === "error" || state.status === "connecting"}>
          <ButtonV2
            variant="neutral"
            disabled={state.status === "connecting" || !remoteAccess}
            onClick={() => void remoteAccess?.start().catch(() => undefined)}
          >
            {language.t(state.status === "connecting" ? "remoteAccess.starting" : "remoteAccess.start")}
          </ButtonV2>
        </Show>
        <Show when={state.status === "active" || state.status === "reconnecting"}>
          <ButtonV2 variant="danger" onClick={() => void remoteAccess?.stop()}>
            {language.t("remoteAccess.stop")}
          </ButtonV2>
        </Show>
      </DialogFooter>
    </Dialog>
  )
}
