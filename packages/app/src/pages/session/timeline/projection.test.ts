import { describe, expect, test } from "bun:test"
import type { PartGroup } from "@openctrlc/session-ui/message-part"
import { reuseTimelineRows } from "./row-reconciliation"
import { TimelineRow } from "./timeline-row"
import { includeUserMessageRow, indexUserMessageRows } from "./user-message-row-index"

const context = (key: string, partIDs: string[], userMessageID = "user-1") =>
  new TimelineRow.AssistantPart({
    userMessageID,
    group: {
      key,
      type: "context",
      refs: partIDs.map((partID) => ({ messageID: "assistant-1", partID })),
    } satisfies PartGroup,
    previousAssistantPart: false,
  })

const user = (userMessageID = "user-1") => new TimelineRow.UserMessage({ userMessageID, anchor: true })
const keys = (rows: TimelineRow.TimelineRow[]) => rows.map(TimelineRow.key)

describe("reuseTimelineRows", () => {
  test.each([
    {
      name: "reuses an unchanged context group",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:a", ["a", "b"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [[0, 0]],
    },
    {
      name: "preserves the group key when a member is appended",
      previous: [context("context:a", ["a"])],
      rows: [context("context:a", ["a", "b"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "preserves the group key when the first member is removed",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:b", ["b"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "lets only the natural owner retain an old key after a split",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:a", ["a"]), context("context:b", ["b"])],
      expected: ["assistant-part:user-1:context:a", "assistant-part:user-1:context:b"],
      reused: [],
    },
    {
      name: "chooses the earliest prior key when groups merge",
      previous: [context("context:a", ["a"]), context("context:b", ["b"])],
      rows: [context("context:b", ["b", "a"])],
      expected: ["assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "reserves an old key for its natural owner when two new groups compete",
      previous: [context("context:a", ["a", "b"])],
      rows: [context("context:b", ["b"]), context("context:a", ["a"])],
      expected: ["assistant-part:user-1:context:b", "assistant-part:user-1:context:a"],
      reused: [],
    },
    {
      name: "does not reuse context identity across user messages",
      previous: [context("context:a", ["a", "b"], "user-1")],
      rows: [context("context:b", ["b"], "user-2")],
      expected: ["assistant-part:user-2:context:b"],
      reused: [],
    },
    {
      name: "reuses an unaffected ordinary row",
      previous: [user()],
      rows: [user()],
      expected: ["user-message:user-1"],
      reused: [[0, 0]],
    },
    {
      name: "does not create accidental key collisions",
      previous: [context("context:a", ["a", "b", "c"])],
      rows: [context("context:b", ["b"]), context("context:a", ["a"]), context("context:c", ["c"])],
      expected: [
        "assistant-part:user-1:context:b",
        "assistant-part:user-1:context:a",
        "assistant-part:user-1:context:c",
      ],
      reused: [],
    },
  ])("$name", ({ previous, rows, expected, reused }) => {
    const result = reuseTimelineRows([...previous], [...rows])

    expect(keys(result)).toEqual([...expected])
    expect(new Set(keys(result)).size).toBe(result.length)
    reused.forEach(([resultIndex, previousIndex]) => expect(result[resultIndex]).toBe(previous[previousIndex]))
  })
})

test("indexes the actual user-message row when a turn has preceding rows", () => {
  const rows = [
    new TimelineRow.TurnGap({ userMessageID: "user-2" }),
    new TimelineRow.CommentStrip({ userMessageID: "user-2" }),
    new TimelineRow.UserMessage({ userMessageID: "user-2", anchor: false }),
    new TimelineRow.AssistantPart({
      userMessageID: "user-2",
      group: { key: "part:1", type: "context", refs: [] },
      previousAssistantPart: false,
    }),
  ]

  expect(indexUserMessageRows(rows)).toEqual(new Map([["user-2", 2]]))
})

test("adds the marker row without dropping the projected range boundaries", () => {
  const rows = [
    new TimelineRow.TurnGap({ userMessageID: "user-2" }),
    new TimelineRow.CommentStrip({ userMessageID: "user-2" }),
    new TimelineRow.UserMessage({ userMessageID: "user-2", anchor: false }),
  ]
  const userRows = indexUserMessageRows(rows)

  expect(includeUserMessageRow([0, 4], "user-2", userRows, rows.length + 3)).toEqual([0, 2, 4])
  expect(includeUserMessageRow([0, 4], "missing", userRows, rows.length + 3)).toEqual([0, 4])
})
