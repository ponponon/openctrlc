import { describe, expect, test } from "bun:test"
import type { Part } from "@openctrlc/sdk/v2/client"
import { summarizeSessionSkills } from "./session-skills"

const skillPart = (input: { name?: string; status?: "completed" | "running" }): Part =>
  ({
    id: "part-skill",
    sessionID: "ses_test",
    messageID: "msg_assistant",
    type: "tool",
    callID: "call-skill",
    tool: "skill",
    state:
      input.status === "running"
        ? { status: "running", input: { name: input.name }, time: { start: 1 } }
        : {
            status: "completed",
            input: { name: input.name },
            output: "skill content",
            title: input.name ?? "skill",
            metadata: {},
            time: { start: 1, end: 2 },
          },
  }) as Part

describe("summarizeSessionSkills", () => {
  test("uses completed legacy skill tool parts when no activation event exists", () => {
    expect(
      summarizeSessionSkills({
        messages: [],
        parts: [skillPart({ name: "brainstorming" }), skillPart({ name: "writing-plans", status: "running" })],
      }),
    ).toEqual([{ id: "brainstorming", name: "brainstorming", count: 1 }])
  })

  test("prefers activation events so a compatibility projection is not counted twice", () => {
    expect(
      summarizeSessionSkills({
        messages: [
          {
            id: "skill-event",
            type: "skill",
            skill: "brainstorming",
            name: "brainstorming",
            text: "skill content",
            time: { created: 1 },
          },
        ],
        parts: [skillPart({ name: "brainstorming" })],
      }),
    ).toEqual([{ id: "brainstorming", name: "brainstorming", count: 1 }])
  })
})
