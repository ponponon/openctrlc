import { describe, expect, test } from "bun:test"
import { groupDatabaseFiles } from "./database-files"

describe("database file groups", () => {
  test("groups files once by purpose in a stable, user-oriented order", () => {
    const files = [
      { name: "drafts.sqlite", path: "/data/drafts.sqlite", purpose: "drafts" },
      { name: "openctrlc-dev.db", path: "/data/openctrlc-dev.db", purpose: "openctrlc" },
      { name: "custom.sqlite3", path: "/data/custom.sqlite3", purpose: "unknown" },
      { name: "openctrlc.db", path: "/data/openctrlc.db", purpose: "openctrlc" },
    ] as const

    expect(groupDatabaseFiles([...files])).toEqual([
      {
        purpose: "openctrlc",
        databases: [files[1], files[3]],
      },
      {
        purpose: "drafts",
        databases: [files[0]],
      },
      {
        purpose: "unknown",
        databases: [files[2]],
      },
    ])
  })

  test("does not create empty purpose groups", () => {
    expect(groupDatabaseFiles([{ name: "drafts.sqlite", path: "/data/drafts.sqlite", purpose: "drafts" }])).toEqual([
      {
        purpose: "drafts",
        databases: [{ name: "drafts.sqlite", path: "/data/drafts.sqlite", purpose: "drafts" }],
      },
    ])
  })
})
