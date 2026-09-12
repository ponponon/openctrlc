import { describe, expect, test } from "bun:test"
import type { Message, Part, PermissionRequest } from "@openctrlc/sdk/v2/client"
import { diagnoseSessionStall } from "./session-stall"

type AssistantMessage = Extract<Message, { role: "assistant" }>
type ToolPart = Extract<Part, { type: "tool" }>

const assistant = (time: AssistantMessage["time"] = { created: 1_000 }): AssistantMessage => ({
  id: "assistant",
  sessionID: "session",
  role: "assistant",
  time,
  parentID: "user",
  modelID: "model",
  providerID: "provider",
  mode: "build",
  agent: "build",
  path: { cwd: "/project", root: "/project" },
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

const tool = (state: ToolPart["state"] = { status: "pending", input: {}, raw: "{}" }): ToolPart => ({
  id: "tool",
  sessionID: "session",
  messageID: "assistant",
  type: "tool",
  callID: "call",
  tool: "read",
  state,
})

const input = (messages: Message[], parts: Part[] = []) => ({
  sessionID: "session",
  status: { type: "busy" as const },
  messages,
  parts: () => parts,
  permissions: [],
  questions: [],
  now: 100_000,
  thresholdMs: 10_000,
})

describe("diagnoseSessionStall", () => {
  test("ignores idle and completed sessions", () => {
    expect(
      diagnoseSessionStall({
        ...input([assistant({ created: 1_000, completed: 2_000 })]),
        status: { type: "idle" },
      }),
    ).toBeUndefined()
  })

  test("ignores an older incomplete assistant after a completed assistant", () => {
    expect(
      diagnoseSessionStall(input([assistant({ created: 1_000 }), assistant({ created: 2_000, completed: 3_000 })])),
    ).toBeUndefined()
  })

  test("identifies a stale permission wait", () => {
    const result = diagnoseSessionStall({
      ...input([assistant()]),
      permissions: [
        {
          id: "permission",
          sessionID: "session",
          permission: "external_directory",
          patterns: ["/tmp/*"],
          metadata: {},
          always: [],
        } satisfies PermissionRequest,
      ],
    })

    expect(result).toMatchObject({ kind: "permission", permissionCount: 1, questionCount: 0 })
  })

  test("identifies a stale running tool and names it", () => {
    const result = diagnoseSessionStall({
      ...input(
        [assistant()],
        [tool({ status: "running", input: {}, title: "read", metadata: {}, time: { start: 1_000 } })],
      ),
    })

    expect(result).toMatchObject({ kind: "tool", toolNames: ["read"] })
  })

  test("identifies a stale model turn without active tools", () => {
    const result = diagnoseSessionStall(input([assistant()]))

    expect(result).toMatchObject({ kind: "model", toolNames: [] })
  })
})
