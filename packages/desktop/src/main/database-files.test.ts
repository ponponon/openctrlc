import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Brand } from "@openctrlc/identity"
import { discoverDatabaseFiles, getDatabaseFiles } from "./database-files"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("database file discovery", () => {
  test("lists supported database files and ignores SQLite sidecars and unrelated files", async () => {
    const root = await mkdtemp(join(tmpdir(), "openctrlc-database-files-"))
    roots.push(root)
    const nested = join(root, "nested")
    await mkdir(nested)
    await Promise.all([
      writeFile(join(root, "openctrlc-dev.db"), ""),
      writeFile(join(root, "drafts.sqlite"), ""),
      writeFile(join(root, "custom.sqlite3"), ""),
      writeFile(join(root, "openctrlc-dev.db-wal"), ""),
      writeFile(join(root, "settings.json"), ""),
      writeFile(join(nested, "ignored.sqlite"), ""),
    ])

    await expect(discoverDatabaseFiles([root])).resolves.toEqual([
      { name: "custom.sqlite3", path: join(root, "custom.sqlite3"), purpose: "unknown" },
      { name: "drafts.sqlite", path: join(root, "drafts.sqlite"), purpose: "drafts" },
      { name: "openctrlc-dev.db", path: join(root, "openctrlc-dev.db"), purpose: "openctrlc" },
    ])
  })

  test("only scans OpenCtrlC data and desktop user data, not the OpenCode data directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "openctrlc-database-files-"))
    roots.push(root)
    const dataHome = join(root, "data")
    const openctrlcData = join(dataHome, Brand.runtimeDirectory)
    const opencodeData = join(dataHome, "opencode")
    const userData = join(root, "desktop")
    await mkdir(dataHome)
    await Promise.all([mkdir(openctrlcData), mkdir(opencodeData), mkdir(userData)])
    await Promise.all([
      writeFile(join(openctrlcData, "openctrlc-dev.db"), ""),
      writeFile(join(opencodeData, "opencode.db"), ""),
      writeFile(join(userData, "drafts.sqlite"), ""),
    ])

    await expect(getDatabaseFiles(userData, dataHome)).resolves.toEqual([
      { name: "drafts.sqlite", path: join(userData, "drafts.sqlite"), purpose: "drafts" },
      { name: "openctrlc-dev.db", path: join(openctrlcData, "openctrlc-dev.db"), purpose: "openctrlc" },
    ])
  })

  test("deduplicates the same path across configured directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "openctrlc-database-files-"))
    roots.push(root)
    await writeFile(join(root, "openctrlc.db"), "")

    await expect(discoverDatabaseFiles([root, root])).resolves.toEqual([
      { name: "openctrlc.db", path: join(root, "openctrlc.db"), purpose: "openctrlc" },
    ])
  })

  test("marks files with no known application naming convention as unknown", async () => {
    const root = await mkdtemp(join(tmpdir(), "openctrlc-database-files-"))
    roots.push(root)
    await writeFile(join(root, "custom.sqlite3"), "")

    await expect(discoverDatabaseFiles([root])).resolves.toContainEqual({
      name: "custom.sqlite3",
      path: join(root, "custom.sqlite3"),
      purpose: "unknown",
    })
  })
})
