import { readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { extname, join } from "node:path"
import { Brand } from "@openctrlc/identity"
import type { DesktopDatabaseFile } from "../preload/types"

const DATABASE_EXTENSIONS = new Set([".db", ".sqlite", ".sqlite3"])

export async function getDatabaseFiles(userDataPath: string) {
  const dataHome = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share")
  return discoverDatabaseFiles([
    join(dataHome, Brand.runtimeDirectory),
    join(dataHome, "opencode"),
    userDataPath,
  ])
}

export async function discoverDatabaseFiles(directories: readonly string[]): Promise<DesktopDatabaseFile[]> {
  const files = await Promise.all(
    directories.map(async (directory) => {
      const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
      return entries
        .filter((entry) => entry.isFile() && DATABASE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
        .map((entry) => ({ name: entry.name, path: join(directory, entry.name) }))
    }),
  )

  return Array.from(new Map(files.flat().map((file) => [file.path, file])).values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}
