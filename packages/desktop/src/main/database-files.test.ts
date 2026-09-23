import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { discoverDatabaseFiles } from "./database-files"

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
      writeFile(join(root, "openctrlc-dev.db-wal"), ""),
      writeFile(join(root, "settings.json"), ""),
      writeFile(join(nested, "ignored.sqlite"), ""),
    ])

    await expect(discoverDatabaseFiles([root])).resolves.toEqual([
      { name: "drafts.sqlite", path: join(root, "drafts.sqlite") },
      { name: "openctrlc-dev.db", path: join(root, "openctrlc-dev.db") },
    ])
  })

  test("deduplicates the same path across configured directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "openctrlc-database-files-"))
    roots.push(root)
    await writeFile(join(root, "openctrlc.db"), "")

    await expect(discoverDatabaseFiles([root, root])).resolves.toEqual([
      { name: "openctrlc.db", path: join(root, "openctrlc.db") },
    ])
  })
})
