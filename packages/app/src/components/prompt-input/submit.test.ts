import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"
import { createStore } from "solid-js/store"
import type { Prompt, PromptStore } from "@/context/prompt"
import type { ModelSelection } from "@/context/local"

let createPromptSubmit: typeof import("./submit").createPromptSubmit
let isDefinitiveSessionCreateFailure: typeof import("./submit").isDefinitiveSessionCreateFailure

const createdClients: string[] = []
const createdSessions: string[] = []
const sessionCreateInputs: Array<{
  id?: string
  agent?: string
  model?: { id: string; providerID: string; variant?: string }
  location?: { directory: string }
}> = []
const optimistic: Array<{
  directory?: string
  sessionID?: string
  message: {
    agent: string
    model: { providerID: string; modelID: string }
    variant?: string
  }
}> = []
const optimisticSeeded: boolean[] = []
const storedSessions: Record<string, Array<{ id: string; title?: string }>> = {}
const promoted: Array<{ directory: string; sessionID: string }> = []
const sentShell: Array<{ sessionID: string; id?: string; command: string }> = []
const syncedDirectories: string[] = []
const promotedDrafts: Array<{ draftID: string; server: string; sessionId: string }> = []
const sentPrompts: string[] = []
const promptInputs: unknown[] = []
const sentCommands: unknown[] = []
const commands: Array<{ name: string }> = []
const toasts: Array<{ title: string; description?: string }> = []
const sessionCreateErrors: unknown[] = []
const sessionCreateGates: Array<Promise<void> | undefined> = []
const removedSessions: string[] = []
const removedSessionInputs: Array<{ sessionID: string; directory?: string }> = []
const removedWorktrees: string[] = []
let sessionCounter = 0
let serverSessionSyncs = 0

let params: { id?: string } = {}
let search: { draftId?: string } = {}
let selected = "/repo/worktree-a"
let variant: string | undefined
let createSessionGate: Promise<void> | undefined

let promptValue: Prompt = [{ type: "text", content: "ls", start: 0, end: 2 }]
const [promptStore, setPromptStore] = createStore<PromptStore>({
  prompt: promptValue,
  cursor: 0,
  context: { items: [] },
})
const prompt = {
  store: [() => promptStore, setPromptStore] as [() => PromptStore, typeof setPromptStore],
  ready: Object.assign(() => true, { promise: Promise.resolve(true) }),
  current: () => promptValue,
  cursor: () => 0,
  dirty: () => true,
  model: {
    current: () => undefined,
    set: () => undefined,
  },
  reset: () => undefined,
  set: () => undefined,
  context: {
    add: () => undefined,
    remove: () => undefined,
    removeComment: () => undefined,
    updateComment: () => undefined,
    replaceComments: () => undefined,
    items: () => [],
  },
  capture: () => prompt,
}

const clientFor = (directory: string) => {
  createdClients.push(directory)
  return {
    api: {
      session: {
        create: async (input: (typeof sessionCreateInputs)[number]) => {
          const id = `session-${++sessionCounter}`
          sessionCreateInputs.push(input)
          await (sessionCreateGates.shift() ?? createSessionGate)
          const location = input.location?.directory ?? directory
          const failure = sessionCreateErrors.shift()
          if (failure) throw failure
          createdSessions.push(location)
          return {
            id,
            projectID: "project",
            agent: input.agent,
            model: input.model,
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            time: { created: 1, updated: 1 },
            title: `New session ${createdSessions.length}`,
            location: { directory: location },
          }
        },
        remove: async (input: { sessionID: string; directory?: string }) => {
          removedSessions.push(input.sessionID)
          removedSessionInputs.push({ sessionID: input.sessionID, directory: input.directory })
          return { data: undefined }
        },
        prompt: async (input: unknown) => {
          sentPrompts.push(directory)
          promptInputs.push(input)
          return { data: undefined }
        },
        command: async (input: unknown) => {
          sentCommands.push(input)
        },
        shell: async (input: { sessionID: string; id?: string; command: string }) => {
          sentShell.push(input)
        },
      },
    },
    session: {
      command: async () => ({ data: undefined }),
      abort: async () => ({ data: undefined }),
    },
    worktree: {
      create: async () => ({ data: { directory: `${directory}/new` } }),
      remove: async (input: { worktreeRemoveInput?: { directory?: string } }) => {
        removedWorktrees.push(input.worktreeRemoveInput?.directory ?? "")
        return { data: undefined }
      },
    },
  }
}

beforeAll(async () => {
  const rootClient = clientFor("/repo/main")

  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => params,
    useLocation: () => ({}),
    useSearchParams: () => [search, () => undefined],
  }))

  mock.module("@openctrlc/sdk/v2/client", () => ({
    createOpencodeClient: (input: { directory: string }) => {
      createdClients.push(input.directory)
      return clientFor(input.directory)
    },
  }))

  mock.module("@openctrlc/ui/toast", () => ({
    Toast: { Region: () => null },
    showToast: () => 0,
    toaster: { show: () => 0, dismiss: () => undefined, promise: () => 0 },
  }))

  mock.module("@/utils/toast", () => ({
    showToast: (options: { title: string; description?: string }) => {
      toasts.push(options)
      return 0
    },
  }))

  mock.module("@openctrlc/core/util/encode", () => ({
    base64Encode: (value: string) => value,
  }))

  mock.module("@/context/local", () => ({
    useLocal: () => ({
      model: {
        current: () => ({ id: "model", provider: { id: "provider" } }),
        variant: { current: () => variant },
      },
      agent: {
        current: () => ({ name: "agent" }),
      },
      session: {
        promote(directory: string, sessionID: string) {
          promoted.push({ directory, sessionID })
        },
      },
    }),
  }))

  mock.module("@/context/server", () => ({
    useServer: () => ({ key: "server-key" }),
  }))

  mock.module("@/context/tabs", () => ({
    useTabs: () => ({
      draft: () => ({ server: "project-server" }),
      promoteDraft: (draftID: string, session: { server: string; sessionId: string }) => {
        promotedDrafts.push({ draftID, ...session })
      },
    }),
  }))

  mock.module("@/context/prompt", () => ({
    usePrompt: () => prompt,
  }))

  mock.module("@/context/layout", () => ({
    useLayout: () => ({
      handoff: {
        setTabs: () => undefined,
      },
    }),
  }))

  mock.module("@/context/sdk", () => ({
    useSDK: () => {
      const sdk = {
        scope: "local",
        directory: "/repo/main",
        client: rootClient,
        api: rootClient.api,
        url: "http://localhost:4096",
        createClient(opts: any) {
          return clientFor(opts.directory)
        },
      }
      return () => sdk
    },
  }))

  mock.module("@/context/sync", () => ({
    useSync: () => () => ({
      data: { command: commands },
      session: {
        optimistic: {
          add: (value: {
            directory?: string
            sessionID?: string
            message: { agent: string; model: { providerID: string; modelID: string; variant?: string } }
          }) => {
            optimistic.push(value)
            optimisticSeeded.push(
              !!value.directory &&
                !!value.sessionID &&
                !!storedSessions[value.directory]?.find((item) => item.id === value.sessionID)?.title,
            )
          },
          remove: () => undefined,
        },
      },
      set: () => undefined,
    }),
  }))

  mock.module("@/context/server-sync", () => ({
    useServerSync: () => () => ({
      session: {
        remember: () => undefined,
        set: () => undefined,
        sync: async () => {
          serverSessionSyncs++
        },
      },
      child: (directory: string) => {
        syncedDirectories.push(directory)
        storedSessions[directory] ??= []
        return [
          { session: storedSessions[directory] },
          (...args: unknown[]) => {
            if (args[0] !== "session") return
            const next = args[1]
            if (typeof next === "function") {
              storedSessions[directory] = next(storedSessions[directory]) as Array<{ id: string; title?: string }>
              return
            }
            if (Array.isArray(next)) {
              storedSessions[directory] = next as Array<{ id: string; title?: string }>
            }
          },
        ]
      },
    }),
  }))

  mock.module("@/context/platform", () => ({
    usePlatform: () => ({
      fetch: fetch,
    }),
  }))

  mock.module("@/context/language", () => ({
    useLanguage: () => ({
      t: (key: string) => key,
    }),
  }))

  const mod = await import("./submit")
  createPromptSubmit = mod.createPromptSubmit
  isDefinitiveSessionCreateFailure = mod.isDefinitiveSessionCreateFailure
})

beforeEach(() => {
  createdClients.length = 0
  createdSessions.length = 0
  sessionCreateInputs.length = 0
  optimistic.length = 0
  optimisticSeeded.length = 0
  promoted.length = 0
  promotedDrafts.length = 0
  sentPrompts.length = 0
  promptInputs.length = 0
  sentCommands.length = 0
  commands.length = 0
  promptValue = [{ type: "text", content: "ls", start: 0, end: 2 }]
  params = {}
  search = {}
  sentShell.length = 0
  syncedDirectories.length = 0
  selected = "/repo/worktree-a"
  variant = undefined
  createSessionGate = undefined
  serverSessionSyncs = 0
  toasts.length = 0
  sessionCreateErrors.length = 0
  sessionCreateGates.length = 0
  removedSessions.length = 0
  removedSessionInputs.length = 0
  removedWorktrees.length = 0
  sessionCounter = 0
  for (const key of Object.keys(storedSessions)) delete storedSessions[key]
})

describe("prompt submit worktree selection", () => {
  test("reads the latest worktree accessor value per submit", async () => {
    const submit = createPromptSubmit({
      prompt,
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "shell",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)
    selected = "/repo/worktree-b"
    await submit.handleSubmit(event)

    expect(createdClients).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(createdSessions).toEqual(["/repo/worktree-a", "/repo/worktree-b"])
    expect(sessionCreateInputs).toEqual([
      {
        id: expect.stringMatching(/^ses_/),
        agent: "agent",
        model: { id: "model", providerID: "provider", variant: undefined },
        location: { directory: "/repo/worktree-a" },
      },
      {
        id: expect.stringMatching(/^ses_/),
        agent: "agent",
        model: { id: "model", providerID: "provider", variant: undefined },
        location: { directory: "/repo/worktree-b" },
      },
    ])
    expect(sentShell).toEqual([
      expect.objectContaining({ sessionID: "session-1", id: expect.stringMatching(/^evt_/), command: "ls" }),
      expect.objectContaining({ sessionID: "session-2", id: expect.stringMatching(/^evt_/), command: "ls" }),
    ])
    expect(syncedDirectories).toEqual(["/repo/worktree-a", "/repo/worktree-a", "/repo/worktree-b", "/repo/worktree-b"])
    expect(serverSessionSyncs).toBe(0)
    expect(promoted).toEqual([
      { directory: "/repo/worktree-a", sessionID: "session-1" },
      { directory: "/repo/worktree-b", sessionID: "session-2" },
    ])
    expect(syncedDirectories).toEqual(["/repo/worktree-a", "/repo/worktree-a", "/repo/worktree-b", "/repo/worktree-b"])
  })

  test("promotes drafts using the selected project's server", async () => {
    search = { draftId: "draft-1" }
    const submit = createPromptSubmit({
      prompt,
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    await submit.handleSubmit({ preventDefault: () => undefined } as unknown as Event)

    expect(promotedDrafts).toEqual([{ draftID: "draft-1", server: "project-server", sessionId: "session-1" }])
  })

  test("includes the selected variant on optimistic prompts", async () => {
    params = { id: "session-1" }
    variant = "high"

    const submit = createPromptSubmit({
      prompt,
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)
    await Bun.sleep(0)

    expect(optimistic).toHaveLength(1)
    expect(optimistic[0]).toMatchObject({
      message: {
        agent: "agent",
        model: { providerID: "provider", modelID: "model", variant: "high" },
      },
    })
    expect(sentPrompts).toEqual(["/repo/main"])
    expect(promptInputs[0]).toMatchObject({
      sessionID: "session-1",
      text: "ls",
      files: [],
      agents: [],
      delivery: "queue",
    })
    expect((promptInputs[0] as { id?: string }).id).toStartWith("msg_")
    expect((promptInputs[0] as { legacyParts?: { id: string; type: string; text?: string }[] }).legacyParts).toEqual([
      { id: expect.stringMatching(/^prt_/), type: "text", text: "ls" },
    ])
  })

  test("preserves an explicit steer mode for an in-flight follow-up", async () => {
    params = { id: "session-1" }

    const submit = createPromptSubmit({
      prompt,
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      followup: () => "steer",
      onSubmit: () => undefined,
    })

    await submit.handleSubmit({ preventDefault: () => undefined } as unknown as Event)
    await Bun.sleep(0)

    expect((promptInputs[0] as { delivery?: string }).delivery).toBe("steer")
  })

  test("submits slash commands through the current session API", async () => {
    params = { id: "session-1" }
    variant = "high"
    commands.push({ name: "review" })
    promptValue = [{ type: "text", content: "/review staged changes", start: 0, end: 22 }]

    const submit = createPromptSubmit({
      prompt,
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
    })

    await submit.handleSubmit({ preventDefault: () => undefined } as unknown as Event)

    expect(sentCommands).toEqual([
      {
        sessionID: "session-1",
        id: expect.stringMatching(/^msg_/),
        command: "review",
        arguments: "staged changes",
        agent: "agent",
        model: { id: "model", providerID: "provider", variant: "high" },
        files: [],
      },
    ])
    expect(serverSessionSyncs).toBe(0)
  })

  test("uses an injected model selection", async () => {
    params = { id: "session-1" }
    const model = {
      current: () => ({ id: "draft-model", provider: { id: "draft-provider" } }),
      variant: { current: () => "draft-variant" },
    } as unknown as ModelSelection
    const submit = createPromptSubmit({
      prompt,
      info: () => ({ id: "session-1" }),
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      model,
    })

    await submit.handleSubmit({ preventDefault: () => undefined } as unknown as Event)

    expect(optimistic[0]).toMatchObject({
      message: {
        model: { providerID: "draft-provider", modelID: "draft-model", variant: "draft-variant" },
      },
    })
  })

  test("seeds new sessions before optimistic prompts are added", async () => {
    const submit = createPromptSubmit({
      prompt,
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "normal",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
    })

    const event = { preventDefault: () => undefined } as unknown as Event

    await submit.handleSubmit(event)

    expect(storedSessions["/repo/worktree-a"]).toHaveLength(1)
    expect(storedSessions["/repo/worktree-a"]?.[0]).toMatchObject({ id: "session-1", title: "New session 1" })
    expect(optimisticSeeded).toEqual([true])
  })
})

describe("isDefinitiveSessionCreateFailure", () => {
  test("classifies the real client error shapes", () => {
    // V2 已声明错误体（Schema.TaggedErrorClass 编码为 {_tag}）
    expect(isDefinitiveSessionCreateFailure({ _tag: "InvalidRequestError", message: "bad" })).toBe(true)
    expect(isDefinitiveSessionCreateFailure({ _tag: "UnauthorizedError", message: "auth" })).toBe(true)
    expect(isDefinitiveSessionCreateFailure({ _tag: "BadRequest" })).toBe(true)
    expect(isDefinitiveSessionCreateFailure({ name: "BadRequest" })).toBe(true)

    // V2 未声明状态：ClientError("UnexpectedStatus", { cause: { status } })
    const clientError = (status: number) =>
      Object.assign(new Error("UnexpectedStatus"), {
        name: "ClientError",
        reason: "UnexpectedStatus",
        cause: { status },
      })
    expect(isDefinitiveSessionCreateFailure(clientError(400))).toBe(true)
    expect(isDefinitiveSessionCreateFailure(clientError(404))).toBe(true)
    expect(isDefinitiveSessionCreateFailure(clientError(403))).toBe(true)
    expect(isDefinitiveSessionCreateFailure(clientError(500))).toBe(false)
    expect(isDefinitiveSessionCreateFailure(clientError(503))).toBe(false)
    expect(isDefinitiveSessionCreateFailure(clientError(429))).toBe(false)
    expect(isDefinitiveSessionCreateFailure(clientError(409))).toBe(false)
    expect(isDefinitiveSessionCreateFailure(clientError(408))).toBe(false)

    // V1 legacy：wrapClientError 包装出 Error + cause: { body, status, kind }
    const v1Wrapped = (status: number) =>
      new Error("boom", { cause: { body: { name: "Whatever" }, status, kind: "server", request: {} } })
    expect(isDefinitiveSessionCreateFailure(v1Wrapped(400))).toBe(true)
    expect(isDefinitiveSessionCreateFailure(v1Wrapped(500))).toBe(false)
    expect(isDefinitiveSessionCreateFailure(v1Wrapped(429))).toBe(false)

    // 网络失败：结果不确定，不应判为明确失败
    expect(
      isDefinitiveSessionCreateFailure(
        Object.assign(new Error("fetch failed"), {
          name: "ClientError",
          reason: "Transport",
          cause: new TypeError("fetch failed"),
        }),
      ),
    ).toBe(false)

    // 循环引用与字符串 reason 不应导致异常或误判
    const cyclic: Record<string, unknown> = { _tag: "Nope", reason: "UnexpectedStatus" }
    cyclic.cause = cyclic
    expect(isDefinitiveSessionCreateFailure(cyclic)).toBe(false)
    expect(isDefinitiveSessionCreateFailure(undefined)).toBe(false)
  })
})

describe("prompt submit session create retry", () => {
  const makeSubmit = (model?: ModelSelection, createTimeoutMs?: number) =>
    createPromptSubmit({
      prompt,
      info: () => undefined,
      imageAttachments: () => [],
      commentCount: () => 0,
      mode: () => "shell",
      working: () => false,
      editor: () => undefined,
      queueScroll: () => undefined,
      promptLength: (value) => value.reduce((sum, part) => sum + ("content" in part ? part.content.length : 0), 0),
      addToHistory: () => undefined,
      resetHistoryNavigation: () => undefined,
      setMode: () => undefined,
      setPopover: () => undefined,
      newSessionWorktree: () => selected,
      onNewSessionWorktreeReset: () => undefined,
      onSubmit: () => undefined,
      model,
      createTimeoutMs,
    })

  const event = { preventDefault: () => undefined } as unknown as Event

  test("definitive failure keeps the selected worktree on retry and issues a fresh id", async () => {
    const submit = makeSubmit()
    sessionCreateErrors.push({ _tag: "InvalidRequestError", message: "bad model" })

    await submit.handleSubmit(event)
    await submit.handleSubmit(event)

    expect(sessionCreateInputs.map((input) => input.location?.directory)).toEqual([
      "/repo/worktree-a",
      "/repo/worktree-a",
    ])
    expect(sessionCreateInputs[0]?.id).toMatch(/^ses_/)
    expect(sessionCreateInputs[1]?.id).toMatch(/^ses_/)
    expect(sessionCreateInputs[0]?.id).not.toBe(sessionCreateInputs[1]?.id)
    expect(createdSessions).toEqual(["/repo/worktree-a"])
    // 创建失败只提示一次，不再重复报“发送失败”
    expect(toasts.map((item) => item.title)).toEqual(["prompt.toast.sessionCreateFailed.title"])
  })

  test("uncertain failure reuses the same id and directory on retry", async () => {
    const submit = makeSubmit()
    sessionCreateErrors.push(Object.assign(new Error("fetch failed"), { name: "ClientError", reason: "Transport" }))

    await submit.handleSubmit(event)
    await submit.handleSubmit(event)

    expect(sessionCreateInputs.map((input) => input.location?.directory)).toEqual([
      "/repo/worktree-a",
      "/repo/worktree-a",
    ])
    expect(sessionCreateInputs[0]?.id).toBe(sessionCreateInputs[1]?.id)
    expect(createdSessions).toEqual(["/repo/worktree-a"])
    expect(toasts.map((item) => item.title)).toEqual(["prompt.toast.sessionCreateFailed.title"])
  })

  test("changing the worktree after an uncertain failure starts a fresh create there", async () => {
    const submit = makeSubmit()
    sessionCreateErrors.push(Object.assign(new Error("fetch failed"), { name: "ClientError", reason: "Transport" }))

    await submit.handleSubmit(event)
    selected = "/repo/worktree-b"
    await submit.handleSubmit(event)

    expect(sessionCreateInputs.map((input) => input.location?.directory)).toEqual([
      "/repo/worktree-a",
      "/repo/worktree-b",
    ])
    expect(sessionCreateInputs[0]?.id).not.toBe(sessionCreateInputs[1]?.id)
  })

  test("changing the model after an uncertain failure starts a fresh create with the new model", async () => {
    let current = { id: "model-a", provider: { id: "provider" } }
    const model = {
      current: () => current,
      variant: { current: () => undefined },
    } as unknown as ModelSelection
    const submit = makeSubmit(model)
    sessionCreateErrors.push(Object.assign(new Error("fetch failed"), { name: "ClientError", reason: "Transport" }))

    await submit.handleSubmit(event)
    current = { id: "model-b", provider: { id: "provider" } }
    await submit.handleSubmit(event)

    expect(sessionCreateInputs[0]?.model?.id).toBe("model-a")
    expect(sessionCreateInputs[1]?.model?.id).toBe("model-b")
    expect(sessionCreateInputs[0]?.id).not.toBe(sessionCreateInputs[1]?.id)
  })

  test("definitive failure in create mode reclaims the orphan worktree", async () => {
    selected = "create"
    const submit = makeSubmit()
    sessionCreateErrors.push({ _tag: "InvalidRequestError", message: "bad model" })

    await submit.handleSubmit(event)

    expect(sessionCreateInputs[0]?.location?.directory).toBe("/repo/main/new")
    expect(removedWorktrees).toEqual(["/repo/main/new"])

    await submit.handleSubmit(event)

    expect(sessionCreateInputs[1]?.location?.directory).toBe("/repo/main/new")
    expect(createdSessions).toEqual(["/repo/main/new"])
    expect(removedWorktrees).toEqual(["/repo/main/new"])
  })

  test("timeout then a changed option reaps the late orphan session", async () => {
    let release = () => {}
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    sessionCreateGates.push(undefined)
    let current = { id: "model-a", provider: { id: "provider" } }
    const submit = makeSubmit(
      { current: () => current, variant: { current: () => undefined } } as unknown as ModelSelection,
      5,
    )

    await submit.handleSubmit(event)
    expect(toasts.map((item) => item.title)).toEqual(["prompt.toast.sessionCreateTimeout.title"])

    current = { id: "model-b", provider: { id: "provider" } }
    await submit.handleSubmit(event)
    expect(createdSessions).toEqual(["/repo/worktree-a"])

    // 原请求迟到成功时其参数组已被放弃，必须回收，否则会留下两个会话
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(removedSessions).toEqual(["session-1"])
    expect(removedSessions).not.toContain("session-2")
    expect(removedSessionInputs).toEqual([{ sessionID: "session-1", directory: "/repo/worktree-a" }])
    // 用户自选的 worktree 不是本次自动建出的，不随会话回收
    expect(removedWorktrees).toEqual([])
  })

  test("timeout then an unchanged retry reuses the same id and never reaps", async () => {
    let release = () => {}
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    sessionCreateGates.push(undefined)
    const submit = makeSubmit(undefined, 5)

    await submit.handleSubmit(event)
    await submit.handleSubmit(event)

    expect(sessionCreateInputs[0]?.id).toBe(sessionCreateInputs[1]?.id)

    release()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(removedSessions).toEqual([])
    expect(createdSessions).toEqual(["/repo/worktree-a", "/repo/worktree-a"])
  })

  test("a late rejection from an earlier same-id create keeps the in-flight retry tracked", async () => {
    let releaseFirst = () => {}
    let releaseRetry = () => {}
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        releaseFirst = resolve
      }),
    )
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        releaseRetry = resolve
      }),
    )
    let current = { id: "model-a", provider: { id: "provider" } }
    const submit = makeSubmit({ current: () => current, variant: { current: () => undefined } } as unknown as ModelSelection, 5)

    // 同一 Session ID 先后有两个在途创建：原请求超时后重试
    await submit.handleSubmit(event)
    await submit.handleSubmit(event)
    expect(sessionCreateInputs[0]?.id).toBe(sessionCreateInputs[1]?.id)

    // 前一个请求迟到拒绝：只允许清理它自己的记录，不得把在途重试的记录一起删掉
    sessionCreateErrors.push(Object.assign(new Error("fetch failed"), { name: "ClientError", reason: "Transport" }))
    releaseFirst()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 此时用户改选项放弃这组参数，必须仍能找到在途重试并标记 abandoned
    current = { id: "model-b", provider: { id: "provider" } }
    await submit.handleSubmit(event)
    expect(createdSessions).toEqual(["/repo/worktree-a"])
    expect(sessionCreateInputs[2]?.id).not.toBe(sessionCreateInputs[0]?.id)

    // 重试的请求迟到成功：参数组已放弃，必须回收，否则会留下两个会话
    releaseRetry()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(removedSessions).toEqual(["session-2"])
    expect(removedSessions).not.toContain("session-3")
  })

  test("reaps a late orphan session against its own directory", async () => {
    let release = () => {}
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    const submit = makeSubmit(undefined, 5)

    // 迟到会话建在 worktree-a
    await submit.handleSubmit(event)
    expect(toasts.map((item) => item.title)).toEqual(["prompt.toast.sessionCreateTimeout.title"])

    // 用户切到另一个 worktree 重建，新会话建在 worktree-b
    selected = "/repo/worktree-b"
    await submit.handleSubmit(event)
    expect(createdSessions).toEqual(["/repo/worktree-b"])

    release()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 清理请求必须带上创建结果中的会话目录：V1 兼容层按 directory 路由删除，
    // 不传会回落到 SDK 默认目录，worktree-a 里的孤儿会话会被发到主工作区而漏删。
    expect(removedSessionInputs).toEqual([{ sessionID: "session-1", directory: "/repo/worktree-a" }])
    expect(removedSessions).toEqual(["session-1"])
  })

  test("reaps the auto-created worktree together with its late orphan session", async () => {
    selected = "create"
    let release = () => {}
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    sessionCreateGates.push(undefined)
    let current = { id: "model-a", provider: { id: "provider" } }
    const submit = makeSubmit({ current: () => current, variant: { current: () => undefined } } as unknown as ModelSelection, 5)

    // 旧请求为“创建工作区”模式自动建出 worktree，超时后原请求仍在途
    await submit.handleSubmit(event)
    expect(sessionCreateInputs[0]?.location?.directory).toBe("/repo/main/new")

    // 用户改选项重建：旧参数组被放弃，新请求又自动建出一个 worktree
    current = { id: "model-b", provider: { id: "provider" } }
    await submit.handleSubmit(event)
    expect(createdSessions).toEqual(["/repo/main/new"])

    release()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 迟到会话被回收后，为它自动建出的 worktree 必须一并回收，
    // 否则旧 worktree 一直留在项目里，再选“创建工作区”还会再建一个
    expect(removedSessions).toEqual(["session-1"])
    expect(removedWorktrees).toEqual(["/repo/main/new"])
  })

  test("reclaims the abandoned auto-created worktree on a definitive late failure", async () => {
    selected = "create"
    let release = () => {}
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    sessionCreateGates.push(undefined)
    let current = { id: "model-a", provider: { id: "provider" } }
    const submit = makeSubmit({ current: () => current, variant: { current: () => undefined } } as unknown as ModelSelection, 5)

    await submit.handleSubmit(event)
    current = { id: "model-b", provider: { id: "provider" } }
    await submit.handleSubmit(event)

    // 明确失败说明服务端没建成会话，worktree 无用途，迟到时也应随放弃的参数组回收
    sessionCreateErrors.push({ _tag: "InvalidRequestError", message: "bad model" })
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(removedSessions).toEqual([])
    expect(removedWorktrees).toEqual(["/repo/main/new"])
  })

  test("keeps the abandoned auto-created worktree on an uncertain late failure", async () => {
    selected = "create"
    let release = () => {}
    sessionCreateGates.push(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    sessionCreateGates.push(undefined)
    let current = { id: "model-a", provider: { id: "provider" } }
    const submit = makeSubmit({ current: () => current, variant: { current: () => undefined } } as unknown as ModelSelection, 5)

    await submit.handleSubmit(event)
    current = { id: "model-b", provider: { id: "provider" } }
    await submit.handleSubmit(event)

    // 不确定失败（网络中断）意味着服务端可能已建好会话，结果未知不回收
    sessionCreateErrors.push(Object.assign(new Error("fetch failed"), { name: "ClientError", reason: "Transport" }))
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(removedSessions).toEqual([])
    expect(removedWorktrees).toEqual([])
  })
})
