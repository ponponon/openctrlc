import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { stringify } from "yaml"
import { collectResults, renderSummary } from "./verify-update-feed"

const CHANNEL_FILES = ["latest.yml", "latest-mac.yml", "latest-linux.yml", "latest-linux-arm64.yml"]

function channelYml(entryUrl: string, size: number) {
  return stringify({
    version: "1.1.8",
    files: [{ url: entryUrl, sha512: "c2hh", size }],
    path: entryUrl,
    sha512: "c2hh",
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
}

async function serve(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), "openctrlc-verify-"))
  for (const [name, content] of Object.entries(files)) await Bun.write(join(dir, name), content)
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const name = new URL(request.url).pathname.slice(1)
      const file = Bun.file(join(dir, name))
      if (!(await file.exists())) return new Response("not found", { status: 404 })
      return new Response(file)
    },
  })
  return { dir, server, base: `http://localhost:${server.port}` }
}

test("passes when every channel file and installer is reachable", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 3)
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    expect(results.length).toBeGreaterThan(4)
    expect(results.every((result) => result.ok)).toBe(true)
    expect(renderSummary(results, base)).toContain("✅")
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when a channel file is missing", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 3)
  delete files["latest-linux-arm64.yml"]
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    const missing = results.find((result) => result.target === "latest-linux-arm64.yml")
    expect(missing?.ok).toBe(false)
    expect(missing?.status).toBe(404)
    expect(renderSummary(results, base)).toContain("❌")
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when the installer size disagrees with the channel file", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 99)
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    const installer = results.find((result) => result.kind === "installer")
    expect(installer?.ok).toBe(false)
    expect(installer?.note).toContain("size mismatch")
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})
