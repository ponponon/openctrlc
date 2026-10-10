import { describe, expect, test } from "bun:test"
import { CONNECTION_EXPAND_SPARE, nextConnectionCompact } from "./titlebar-connection-compact"

describe("nextConnectionCompact", () => {
  test("compacts while tabs overflow regardless of the current state", () => {
    expect(nextConnectionCompact(false, { overflowing: true, freeSpace: -40 })).toBe(true)
    expect(nextConnectionCompact(true, { overflowing: true, freeSpace: -40 })).toBe(true)
  })

  test("keeps a full entry closed while tabs only fit because it is compact", () => {
    // Expanding would hand ~282px back to the entry and overflow the tabs again.
    expect(nextConnectionCompact(true, { overflowing: false, freeSpace: 100 })).toBe(true)
    expect(nextConnectionCompact(true, { overflowing: false, freeSpace: CONNECTION_EXPAND_SPARE })).toBe(true)
  })

  test("expands once the tab strip has room to spare", () => {
    expect(nextConnectionCompact(true, { overflowing: false, freeSpace: CONNECTION_EXPAND_SPARE + 1 })).toBe(false)
  })

  test("leaves a fitting entry alone", () => {
    expect(nextConnectionCompact(false, { overflowing: false, freeSpace: 0 })).toBe(false)
    expect(nextConnectionCompact(false, { overflowing: false, freeSpace: 400 })).toBe(false)
  })

  test("never expands into an overflow: worst-case reclaim stays inside the spare budget", () => {
    // Full entry max width 320px, compact content floor 38px -> 282px reclaimed.
    const worstCaseReclaim = 320 - 38
    const freeSpaceAfterExpand = CONNECTION_EXPAND_SPARE - worstCaseReclaim
    expect(freeSpaceAfterExpand).toBeGreaterThan(0)
    expect(nextConnectionCompact(true, { overflowing: false, freeSpace: CONNECTION_EXPAND_SPARE + 1 })).toBe(false)
  })
})
