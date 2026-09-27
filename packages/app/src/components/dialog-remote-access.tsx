import { ButtonV2 } from "@openctrlc/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitleGroup } from "@openctrlc/ui/v2/dialog-v2"
import { createResource, For, onCleanup, onMount, Show, createSignal } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import QRCode from "qrcode"
import { useLanguage } from "@/context/language"
import { usePlatform, type RemoteAccessState } from "@/context/platform"
import { useDialog } from "@openctrlc/ui/context/dialog"

const emptyState: RemoteAccessState = {
  status: "stopped",
  pendingRequests: [],
  authorizedDevices: 0,
}

export function DialogRemoteAccess() {
  const language = useLanguage()
  const platform = usePlatform()
  const dialog = useDialog()
  const remoteAccess = platform.remoteAccess
  const [state, setState] = createStore(emptyState)
  const [copied, setCopied] = createSignal(false)
  const [qrCode] = createResource(
    () => state.url,
    (url) => QRCode.toDataURL(url, { errorCorrectionLevel: "Q", margin: 2, width: 264 }),
  )
  let unsubscribe: (() => void) | undefined
  let disposed = false

  onMount(() => {
    if (!remoteAccess) return
    void remoteAccess
      .subscribe((next) => setState(reconcile(next)))
      .then((stop) => {
        if (disposed) return stop()
        unsubscribe = stop
      })
  })
  onCleanup(() => {
    disposed = true
    unsubscribe?.()
  })

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

  return (
    <Dialog size="large" fit class="w-[min(calc(100vw-32px),680px)] max-h-[calc(100vh-32px)]">
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitleGroup
          title={language.t("remoteAccess.title")}
          description={language.t("remoteAccess.description")}
        />
      </DialogHeader>
      <DialogBody class="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
        <Show when={state.status === "active"}>
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-v2-background-bg-base px-3 py-2.5">
            <span class="text-13-medium text-v2-text-text-strong">{language.t("remoteAccess.active")}</span>
            <span class="text-12-regular text-v2-text-text-muted">
              {language.t("remoteAccess.deviceCount", { count: state.authorizedDevices })}
            </span>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <section class="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-v2-border-border-base p-4">
              <Show
                when={qrCode()}
                fallback={<div class="size-[264px] animate-pulse rounded-lg bg-v2-background-bg-base" />}
              >
                {(source) => (
                  <img src={source()} alt={language.t("remoteAccess.scan")} class="size-[264px] rounded-lg" />
                )}
              </Show>
              <p class="text-center text-13-medium text-v2-text-text-strong">{language.t("remoteAccess.scan")}</p>
              <p class="max-w-full truncate text-12-regular text-v2-text-text-muted" title={shortLink()}>
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
            <section class="flex min-w-0 flex-col gap-3 rounded-xl border border-v2-border-border-base p-4">
              <div class="text-13-medium text-v2-text-text-strong">{language.t("remoteAccess.securityTitle")}</div>
              <p class="text-13-regular leading-5 text-v2-text-text-muted">
                {language.t("remoteAccess.securityDescription")}
              </p>
              <p class="rounded-lg bg-v2-background-bg-base p-3 text-12-regular leading-5 text-v2-text-text-muted">
                {language.t("remoteAccess.relayPrivacy")}
              </p>
              <Show when={state.pendingRequests.length > 0}>
                <div class="mt-1 border-t border-v2-border-border-base pt-3">
                  <div class="mb-2 text-13-medium text-v2-text-text-strong">{language.t("remoteAccess.pending")}</div>
                  <For each={state.pendingRequests}>
                    {(request) => (
                      <div class="flex flex-col gap-2 rounded-lg bg-v2-background-bg-base p-3">
                        <div class="break-all text-12-regular text-v2-text-text-base">{request.device}</div>
                        <div class="flex gap-2">
                          <ButtonV2 size="small" onClick={() => remoteAccess?.approve(request.id)}>
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
              </Show>
            </section>
          </div>
        </Show>

        <Show when={state.status === "connecting"}>
          <div class="rounded-xl bg-v2-background-bg-base p-5 text-center text-13-regular text-v2-text-text-muted">
            {language.t("remoteAccess.starting")}
          </div>
        </Show>
        <Show when={state.status === "stopped" || state.status === "error"}>
          <div class="rounded-xl bg-v2-background-bg-base p-5 text-13-regular leading-5 text-v2-text-text-muted">
            {state.status === "error" ? language.t("remoteAccess.error") : language.t("remoteAccess.description")}
          </div>
        </Show>
      </DialogBody>
      <DialogFooter>
        <div class="flex justify-end gap-2 px-4 pb-4">
          <ButtonV2 variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.close")}
          </ButtonV2>
          <Show when={state.status !== "active"}>
            <ButtonV2
              variant="neutral"
              disabled={state.status === "connecting" || !remoteAccess}
              onClick={() => void remoteAccess?.start().catch(() => undefined)}
            >
              {language.t(state.status === "connecting" ? "remoteAccess.starting" : "remoteAccess.start")}
            </ButtonV2>
          </Show>
          <Show when={state.status === "active"}>
            <ButtonV2 variant="danger" onClick={() => void remoteAccess?.stop()}>
              {language.t("remoteAccess.stop")}
            </ButtonV2>
          </Show>
        </div>
      </DialogFooter>
    </Dialog>
  )
}
