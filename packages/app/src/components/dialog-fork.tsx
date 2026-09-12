import { Component, createMemo, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { useSync } from "@/context/sync"
import type { useServerSync } from "@/context/server-sync"
import type { useSDK } from "@/context/sdk"
import type { usePrompt } from "@/context/prompt"
import type { useDialog } from "@openctrlc/ui/context/dialog"
import { Dialog } from "@openctrlc/ui/dialog"
import { List } from "@openctrlc/ui/list"
import { Button } from "@openctrlc/ui/button"
import { Icon } from "@openctrlc/ui/icon"
import { TextShimmer } from "@openctrlc/ui/text-shimmer"
import { showToast } from "@/utils/toast"
import { extractPromptFromParts } from "@/utils/prompt"
import { errorMessage } from "@/pages/layout/helpers"
import { Worktree as WorktreeState } from "@/utils/worktree"
import type { TextPart as SDKTextPart } from "@openctrlc/sdk/v2/client"
import { base64Encode } from "@openctrlc/core/util/encode"
import type { useLanguage } from "@/context/language"
import { forkBoundaryAfterMessage } from "@/utils/session-fork"

interface ForkableMessage {
  id: string
  text: string
  time: string
}

type ForkStep = "messages" | "locations"
type ForkLocation = "workspace" | "worktree"

interface ForkLocationOption {
  id: ForkLocation
  title: string
  description: string
  icon: "branch" | "fork"
}

interface DialogForkProps {
  sessionID?: string
  messageID?: string
  includeMessage?: boolean
  sync: ReturnType<typeof useSync>
  serverSync: ReturnType<typeof useServerSync>
  sdk: ReturnType<typeof useSDK>
  prompt: Pick<ReturnType<typeof usePrompt>, "set">
  dialog: ReturnType<typeof useDialog>
  language: ReturnType<typeof useLanguage>
  navigate: (path: string) => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { timeStyle: "short" })
}

export const DialogFork: Component<DialogForkProps> = (props) => {
  const [state, setState] = createStore({
    step: (props.messageID ? "locations" : "messages") as ForkStep,
    selectedMessageID: props.messageID,
    pending: false,
  })

  const sessionID = createMemo(() => props.sessionID)
  const projectRoot = createMemo(() => props.sync().project?.worktree ?? props.sdk().directory)
  const canCreateWorktree = createMemo(() => props.sync().project?.vcs === "git")

  const messages = createMemo((): ForkableMessage[] => {
    const id = sessionID()
    if (!id) return []

    const msgs = props.sync().data.message[id] ?? []
    const result: ForkableMessage[] = []

    for (const message of msgs) {
      if (message.role !== "user") continue

      const parts = props.sync().data.part[message.id] ?? []
      const textPart = parts.find((x): x is SDKTextPart => x.type === "text" && !x.synthetic && !x.ignored)
      if (!textPart) continue

      result.push({
        id: message.id,
        text: textPart.text.replace(/\n/g, " ").slice(0, 200),
        time: formatTime(new Date(message.time.created)),
      })
    }

    return result.reverse()
  })

  const locations = createMemo<ForkLocationOption[]>(() => {
    const result: ForkLocationOption[] = [
      {
        id: "workspace",
        title: props.language.t("dialog.fork.location.workspace.title"),
        description: props.language.t("dialog.fork.location.workspace.description"),
        icon: "branch",
      },
    ]

    if (canCreateWorktree()) {
      result.push({
        id: "worktree",
        title: props.language.t("dialog.fork.location.worktree.title"),
        description: props.language.t("dialog.fork.location.worktree.description"),
        icon: "fork",
      })
    }

    return result
  })

  const handleSelect = (item: ForkableMessage | undefined) => {
    if (!item || state.pending) return
    setState({ step: "locations", selectedMessageID: item.id })
  }

  const handleFork = async (location: ForkLocation) => {
    if (state.pending) return

    const sourceSessionID = sessionID()
    if (!sourceSessionID) return

    setState("pending", true)
    const sourceDirectory = props.sdk().directory
    const selectedMessageID = state.selectedMessageID
    const boundary =
      props.includeMessage && selectedMessageID
        ? forkBoundaryAfterMessage(props.sync().data.message[sourceSessionID] ?? [], selectedMessageID)
        : { found: true, messageID: selectedMessageID }
    if (!boundary.found) {
      setState("pending", false)
      showToast({
        title: props.language.t("common.requestFailed"),
        description: props.language.t("common.requestFailed"),
      })
      return
    }

    const parts = state.selectedMessageID ? (props.sync().data.part[state.selectedMessageID] ?? []) : []
    const restored =
      !props.includeMessage && state.selectedMessageID
        ? extractPromptFromParts(parts, {
            directory: sourceDirectory,
            attachmentName: props.language.t("common.attachment"),
          })
        : undefined
    let createdDirectory: string | undefined

    try {
      if (location === "worktree") {
        const created = await props
          .sdk()
          .client.worktree.create({ directory: projectRoot() })
          .then((result) => result.data)
        if (!created?.directory) throw new Error(props.language.t("common.requestFailed"))

        createdDirectory = created.directory
        WorktreeState.pending(props.sdk().scope, created.directory)
        props.serverSync().child(created.directory)
      }

      const directory = createdDirectory ?? sourceDirectory
      const forked =
        directory === sourceDirectory
          ? await props.sdk().api.session.fork({ sessionID: sourceSessionID, messageID: boundary.messageID })
          : await props
              .sdk()
              .createClient({ directory, throwOnError: true })
              .session.fork({ sessionID: sourceSessionID, messageID: boundary.messageID })
              .then((result) => result.data)
      if (!forked?.id) throw new Error(props.language.t("common.requestFailed"))

      const forkDirectory = "directory" in forked && typeof forked.directory === "string" ? forked.directory : directory
      const dir = base64Encode(forkDirectory)
      props.dialog.close()
      if (restored) props.prompt.set(restored, undefined, { dir, id: forked.id })
      props.navigate(`/${dir}/session/${forked.id}`)
    } catch (err) {
      if (createdDirectory) {
        await props
          .sdk()
          .client.worktree.remove({ directory: projectRoot(), worktreeRemoveInput: { directory: createdDirectory } })
          .catch(() => undefined)
      }
      setState("pending", false)
      showToast({
        title: props.language.t("common.requestFailed"),
        description: errorMessage(err, props.language.t("common.requestFailed")),
      })
    }
  }

  return (
    <Dialog
      title={
        state.step === "locations"
          ? props.language.t("dialog.fork.location.title")
          : props.language.t("command.session.fork")
      }
    >
      <Show when={state.step === "locations"}>
        <Show when={!props.messageID}>
          <Button
            type="button"
            size="small"
            variant="ghost"
            icon="arrow-left"
            class="mx-3 mt-1 mb-1 self-start"
            onClick={() => setState("step", "messages")}
            disabled={state.pending}
          >
            {props.language.t("dialog.fork.back")}
          </Button>
        </Show>
        <Show
          when={!state.pending}
          fallback={
            <div class="flex flex-1 items-center justify-center px-6">
              <TextShimmer text={props.language.t("dialog.fork.loading")} />
            </div>
          }
        >
          <List
            class="flex-1 px-3 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0"
            items={locations}
            key={(item) => item.id}
            onSelect={(item) => {
              if (!item) return
              void handleFork(item.id)
            }}
          >
            {(item) => (
              <div class="w-full flex items-center gap-3 py-2 text-left">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-base text-text-base">
                  <Icon name={item.icon} />
                </span>
                <span class="min-w-0 flex-1 flex flex-col gap-0.5">
                  <span class="text-14-medium text-text-strong">{item.title}</span>
                  <span class="truncate text-12-regular text-text-weak">{item.description}</span>
                </span>
                <Icon name="chevron-right" class="shrink-0 text-text-weak" />
              </div>
            )}
          </List>
        </Show>
      </Show>
      <Show when={state.step === "messages"}>
        <List
          class="flex-1 px-3 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0"
          search={{ placeholder: props.language.t("common.search.placeholder"), autofocus: true }}
          emptyMessage={props.language.t("dialog.fork.empty")}
          key={(item) => item.id}
          items={messages}
          filterKeys={["text"]}
          onSelect={handleSelect}
        >
          {(item) => (
            <div class="w-full flex items-center gap-2">
              <span class="truncate flex-1 min-w-0 text-left font-normal">{item.text}</span>
              <span class="text-text-weak shrink-0 font-normal">{item.time}</span>
            </div>
          )}
        </List>
      </Show>
    </Dialog>
  )
}
