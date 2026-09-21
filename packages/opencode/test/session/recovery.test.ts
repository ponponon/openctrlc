import { describe, expect, test } from "bun:test"
import { SessionV1 } from "@openctrlc/core/v1/session"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { RESTART_INTERRUPTION_MESSAGE, recoverInterruptedMessages } from "../../src/session/recovery"

const sessionID = SessionID.make("ses_recovery")
const providerID = "provider:test" as SessionV1.Assistant["providerID"]
const modelID = "model:test" as SessionV1.Assistant["modelID"]

function assistant(completed?: number): SessionV1.Assistant {
  return {
    id: MessageID.make("msg_recovery"),
    sessionID,
    role: "assistant",
    time: { created: 100, ...(completed === undefined ? {} : { completed }) },
    parentID: MessageID.make("msg_user"),
    modelID,
    providerID,
    mode: "general",
    agent: "general",
    path: { cwd: "/tmp", root: "/tmp" },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
}

function tool(state: SessionV1.ToolState): SessionV1.ToolPart {
  return {
    id: PartID.make("prt_recovery"),
    messageID: MessageID.make("msg_recovery"),
    sessionID,
    type: "tool",
    callID: "call_recovery",
    tool: "read",
    state,
  }
}

describe("session recovery", () => {
  test("marks an incomplete running tool and assistant turn as interrupted", () => {
    const changes = recoverInterruptedMessages(
      [
        {
          info: assistant(),
          parts: [
            tool({
              status: "running",
              input: { filePath: "/tmp/file" },
              time: { start: 200 },
            }),
          ],
        },
      ],
      500,
    )

    expect(changes).toHaveLength(1)
    expect(changes[0]?.message.time.completed).toBe(500)
    expect(changes[0]?.message.finish).toBe("unknown")
    expect(changes[0]?.message.error).toEqual(
      new SessionV1.AbortedError({ message: RESTART_INTERRUPTION_MESSAGE }).toObject(),
    )
    expect(changes[0]?.parts[0]?.state).toEqual({
      status: "error",
      error: RESTART_INTERRUPTION_MESSAGE,
      input: { filePath: "/tmp/file" },
      metadata: { interrupted: true },
      time: { start: 200, end: 500 },
    })
  })

  test("recovers pending tools with a valid error interval", () => {
    const changes = recoverInterruptedMessages(
      [
        {
          info: assistant(),
          parts: [
            tool({
              status: "pending",
              input: { filePath: "/tmp/file" },
              raw: "{\"filePath\":\"/tmp/file\"}",
            }),
          ],
        },
      ],
      500,
    )

    expect(changes[0]?.parts[0]?.state).toMatchObject({
      status: "error",
      time: { start: 500, end: 500 },
      metadata: { interrupted: true },
    })
  })

  test("ignores completed turns and is idempotent", () => {
    const completed = {
      info: assistant(400),
      parts: [],
    }
    expect(recoverInterruptedMessages([completed], 500)).toEqual([])
    expect(recoverInterruptedMessages([{ info: { ...assistant(), finish: "stop" }, parts: [] }], 500)).toEqual([])

    const [change] = recoverInterruptedMessages(
      [
        {
          info: assistant(),
          parts: [
            tool({
              status: "running",
              input: {},
              time: { start: 200 },
            }),
          ],
        },
      ],
      500,
    )
    expect(
      recoverInterruptedMessages(
        [{ info: change!.message, parts: change!.parts }],
        600,
      ),
    ).toEqual([])
  })
})
