import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { parse, stringify } from "yaml"
import { rewriteFeed } from "./rewrite-update-feed"

const sha512 = (content: string) => createHash("sha512").update(content).digest("base64")

async function makeDist() {
  const dist = await mkdtemp(join(tmpdir(), "openctrlc-rewrite-"))
  await writeFile(join(dist, "openctrlc-linux-x64.deb"), "deb-bytes")
  await writeFile(join(dist, "openctrlc-linux-x64.AppImage"), "appimage-bytes")
  await writeFile(join(dist, "openctrlc-linux-x64.rpm"), "rpm-bytes")
  const yml = {
    version: "1.1.8",
    files: [
      { url: "openctrlc-linux-amd64.deb", sha512: sha512("deb-bytes"), size: 9 },
      { url: "openctrlc-linux-x86_64.AppImage", sha512: sha512("appimage-bytes"), size: 15 },
      { url: "openctrlc-linux-x86_64.rpm", sha512: sha512("rpm-bytes"), size: 9 },
    ],
    path: "openctrlc-linux-amd64.deb",
    sha512: sha512("deb-bytes"),
    releaseDate: "2026-10-12T00:00:00.000Z",
  }
  await Bun.write(join(dist, "latest-linux.yml"), stringify(yml))
  return dist
}

test("rewrites channel urls to renamed artifact names", async () => {
  const dist = await makeDist()
  try {
    const result = await rewriteFeed(dist)
    expect(result.rewritten).toEqual(["latest-linux.yml"])
    const updated = parse(await Bun.file(join(dist, "latest-linux.yml")).text())
    expect(updated.files.map((entry: { url: string }) => entry.url)).toEqual([
      "openctrlc-linux-x64.deb",
      "openctrlc-linux-x64.AppImage",
      "openctrlc-linux-x64.rpm",
    ])
    expect(updated.path).toBe("openctrlc-linux-x64.deb")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("is idempotent when urls already match", async () => {
  const dist = await makeDist()
  try {
    await rewriteFeed(dist)
    const second = await rewriteFeed(dist)
    expect(second.rewritten).toEqual([])
    expect(second.untouched).toEqual(["latest-linux.yml"])
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("fails when an entry sha512 has no matching file in dist", async () => {
  const dist = await makeDist()
  try {
    const ymlPath = join(dist, "latest-linux.yml")
    const yml = parse(await Bun.file(ymlPath).text())
    yml.files[0].sha512 = sha512("ghost")
    await Bun.write(ymlPath, stringify(yml))
    await expect(rewriteFeed(dist)).rejects.toThrow("no file in dist matches")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("fails when a linux channel file misses an installer extension", async () => {
  const dist = await makeDist()
  try {
    await rm(join(dist, "openctrlc-linux-x64.rpm"))
    const ymlPath = join(dist, "latest-linux.yml")
    const yml = parse(await Bun.file(ymlPath).text())
    yml.files = yml.files.filter((entry: { url: string }) => !entry.url.endsWith(".rpm"))
    await Bun.write(ymlPath, stringify(yml))
    await expect(rewriteFeed(dist)).rejects.toThrow("missing .rpm entry")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})

test("fails when dist has no channel file", async () => {
  const dist = await mkdtemp(join(tmpdir(), "openctrlc-rewrite-empty-"))
  try {
    await expect(rewriteFeed(dist)).rejects.toThrow("no channel file found")
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})
