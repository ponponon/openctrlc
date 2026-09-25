import { describe, expect, test } from "bun:test"
import { capturePendingOutputMark, pendingOutputCount, type PendingOutputRow } from "./pending-output"

const rows = (...items: [string, number][]): PendingOutputRow[] => items.map(([key, size]) => ({ key, size }))

describe("pendingOutputCount", () => {
  test("is zero without a pause mark", () => {
    expect(pendingOutputCount({ mark: undefined, rows: rows(["a", 10], ["b", 20]) })).toBe(0)
  })

  test("counts unseen keys after the first surviving watermark row", () => {
    const mark = capturePendingOutputMark({
      rows: rows(["turn-gap:u", 10], ["user:u", 20], ["assistant-part:u:shell", 200], ["thinking:u", 12]),
    })
    expect(
      pendingOutputCount({
        mark,
        rows: rows(
          ["turn-gap:u", 10],
          ["user:u", 20],
          ["assistant-steps:u", 80],
          ["assistant-part:u:late", 40],
          ["thinking:u", 12],
        ),
      }),
    ).toBe(2)
  })

  test("ignores history prepends before the watermark", () => {
    const mark = capturePendingOutputMark({ rows: rows(["c", 30], ["d", 40], ["thinking:u", 12]) })
    expect(
      pendingOutputCount({ mark, rows: rows(["a", 80], ["b", 80], ["c", 30], ["d", 40], ["thinking:u", 12]) }),
    ).toBe(0)
  })

  test("ignores trailing thinking rows as the watermark content", () => {
    const mark = capturePendingOutputMark({ rows: rows(["shell", 200], ["thinking:u", 12]) })
    // 新文本插在 thinking 前面，thinking 仍是最后一行
    expect(pendingOutputCount({ mark, rows: rows(["shell", 200], ["late", 40], ["thinking:u", 12]) })).toBe(1)
  })

  test("counts watermark content-row growth past the threshold once", () => {
    const mark = capturePendingOutputMark({ rows: rows(["shell", 200], ["thinking:u", 12]) })
    expect(pendingOutputCount({ mark, rows: rows(["shell", 210], ["thinking:u", 12]) })).toBe(0)
    expect(pendingOutputCount({ mark, rows: rows(["shell", 230], ["thinking:u", 12]) })).toBe(1)
  })

  test("counts a replaced watermark content row as new output", () => {
    const mark = capturePendingOutputMark({ rows: rows(["shell", 200], ["thinking:u", 12]) })
    expect(
      pendingOutputCount({
        mark,
        rows: rows(["assistant-steps:u", 80], ["answer", 40], ["thinking:u", 12]),
      }),
    ).toBeGreaterThan(0)
  })

  test("treats everything as new when pausing on an empty timeline", () => {
    const mark = capturePendingOutputMark({ rows: [] })
    expect(pendingOutputCount({ mark, rows: [] })).toBe(0)
    expect(pendingOutputCount({ mark, rows: rows(["only", 40]) })).toBe(1)
  })
})
