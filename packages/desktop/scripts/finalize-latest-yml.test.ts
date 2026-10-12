import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { stringify } from "yaml"
import { buildOutputs } from "./finalize-latest-yml"

async function makeFeedRoot() {
  const dir = await mkdtemp(join(tmpdir(), "openctrlc-finalize-"))
  const write = async (subdir: string, file: string, content: unknown) => {
    await mkdir(join(dir, subdir), { recursive: true })
    await Bun.write(join(dir, subdir, file), stringify(content))
  }
  const entry = (url: string) => ({ url, sha512: "c2hh", size: 1 })
  await write("latest-yml-x86_64-pc-windows-msvc", "latest.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-win-x64.exe")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-aarch64-pc-windows-msvc", "latest.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-win-arm64.exe")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-x86_64-unknown-linux-gnu", "latest-linux.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-linux-x64.deb")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-aarch64-unknown-linux-gnu", "latest-linux-arm64.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-linux-arm64.deb")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  await write("latest-yml-aarch64-apple-darwin", "latest-mac.yml", {
    version: "1.1.8",
    files: [entry("openctrlc-mac-arm64.zip")],
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
  return dir
}

test("merges windows arches and produces all four channel files", async () => {
  const dir = await makeFeedRoot()
  try {
    const output = await buildOutputs(dir)
    expect(Object.keys(output).sort()).toEqual([
      "latest-linux-arm64.yml",
      "latest-linux.yml",
      "latest-mac.yml",
      "latest.yml",
    ])
    expect(output["latest.yml"]).toContain("openctrlc-win-x64.exe")
    expect(output["latest.yml"]).toContain("openctrlc-win-arm64.exe")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when one channel file source is missing", async () => {
  const dir = await makeFeedRoot()
  try {
    await rm(join(dir, "latest-yml-aarch64-unknown-linux-gnu"), { recursive: true })
    await expect(buildOutputs(dir)).rejects.toThrow("missing channel files: latest-linux-arm64.yml")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("takes the release tag from RELEASE_TAG instead of deriving it", async () => {
  const source = await Bun.file(join(import.meta.dirname, "finalize-latest-yml.ts")).text()
  expect(source).toContain("RELEASE_TAG")
  expect(source).toContain("missing channel files")
  expect(source).not.toContain("OPENCTRLC_CHANNEL")
  expect(source).not.toContain("OPENCTRLC_VERSION")
})
