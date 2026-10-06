import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { isCliResourceCurrent, newestModifiedAt, resolveCliVersion } from "./utils"

test("uses the 0.1.2 CLI release by default", () => {
  expect(resolveCliVersion({})).toBe("0.1.2")
})

test("allows the CLI release to be overridden by the environment", () => {
  expect(resolveCliVersion({ OPENCTRLC_CLI_VERSION: "9.9.9" })).toBe("9.9.9")
})

test("reuses only a CLI resource for the requested version and target", () => {
  const metadata = { version: "0.1.2", target: "aarch64-apple-darwin", size: 10, mtimeMs: 100 }
  const expected = { version: "0.1.2", target: "aarch64-apple-darwin", size: 10, mtimeMs: 100 }
  expect(isCliResourceCurrent(metadata, expected)).toBe(true)
  expect(isCliResourceCurrent(metadata, { ...expected, version: "0.1.3" })).toBe(false)
  expect(isCliResourceCurrent(metadata, { ...expected, target: "x86_64-apple-darwin" })).toBe(false)
  expect(isCliResourceCurrent(metadata, { ...expected, size: 11 })).toBe(false)
  expect(isCliResourceCurrent(metadata, { ...expected, mtimeMs: 101 })).toBe(false)
  expect(isCliResourceCurrent(null, expected)).toBe(false)
})

test("includes nested directory changes when comparing source trees", async () => {
  const root = await mkdtemp(join(tmpdir(), "openctrlc-source-tree-"))
  try {
    const nested = join(root, "nested")
    const source = join(nested, "removed.ts")
    const old = new Date(Date.now() - 120_000)
    const fileChanged = new Date(Date.now() + 1_000)
    await mkdir(nested)
    await writeFile(source, "source")
    await utimes(root, old, old)
    await utimes(nested, old, old)
    await utimes(source, fileChanged, fileChanged)
    expect(await newestModifiedAt([root])).toBe((await stat(source)).mtimeMs)

    const changed = new Date(Date.now() + 3_000)
    await rm(source)
    await utimes(root, old, old)
    await utimes(nested, changed, changed)
    expect(await newestModifiedAt([root])).toBe((await stat(nested)).mtimeMs)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
