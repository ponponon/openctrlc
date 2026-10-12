import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { stringify } from "yaml"
import { CHANNEL_FILES, collectResults, renderSummary } from "./verify-update-feed"

function channelYml(entryUrl: string, size?: number) {
  return stringify({
    version: "1.1.8",
    files: [{ url: entryUrl, sha512: "c2hh", size }],
    path: entryUrl,
    sha512: "c2hh",
    releaseDate: "2026-10-12T00:00:00.000Z",
  })
}

async function serve(files: Record<string, string>, installer?: () => Response) {
  const dir = await mkdtemp(join(tmpdir(), "openctrlc-verify-"))
  for (const [name, content] of Object.entries(files)) await Bun.write(join(dir, name), content)
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const name = new URL(request.url).pathname.slice(1)
      if (installer && name === "app.deb") return installer()
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
    await server.stop(true)
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
    await server.stop(true)
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
    await server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when a channel file has no files entries", async () => {
  const files: Record<string, string> = {}
  for (const name of CHANNEL_FILES) files[name] = stringify({ version: "1.1.8", files: [] })
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    expect(results.some((result) => result.kind === "installer")).toBe(false)
    expect(results.filter((result) => result.note === "no files entries").length).toBe(CHANNEL_FILES.length)
    expect(results.filter((result) => !result.ok).length).toBe(CHANNEL_FILES.length)
    expect(renderSummary(results, base)).toContain("❌")
  } finally {
    await server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when a channel file is not an object", async () => {
  const files: Record<string, string> = {}
  for (const name of CHANNEL_FILES) files[name] = stringify("just a scalar")
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    expect(results.some((result) => result.kind === "installer")).toBe(false)
    expect(results.filter((result) => result.note === "channel file is not an object").length).toBe(CHANNEL_FILES.length)
    expect(results.filter((result) => !result.ok).length).toBe(CHANNEL_FILES.length)
  } finally {
    await server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("fails when an entry is missing its size", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb")
  const { dir, server, base } = await serve(files)
  try {
    const results = await collectResults(base)
    const installers = results.filter((result) => result.kind === "installer")
    expect(installers.length).toBe(CHANNEL_FILES.length)
    expect(installers.every((result) => !result.ok)).toBe(true)
    expect(installers[0]?.note).toContain("entry missing size")
  } finally {
    await server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("turns fetch failures into failed result rows", async () => {
  const base = "http://127.0.0.1:1"
  const results = await collectResults(base)
  expect(results.length).toBe(CHANNEL_FILES.length)
  expect(results.some((result) => result.kind === "installer")).toBe(false)
  for (const result of results) {
    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
    expect(result.note).toContain("fetch error")
  }
  expect(renderSummary(results, base)).toContain("fetch error")
})

test("skips the size check when the response is compressed", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 99)
  const compressed = Bun.gzipSync(Buffer.from("abc"))
  const { dir, server, base } = await serve(files, () => new Response(compressed, { headers: { "content-encoding": "gzip" } }))
  try {
    const results = await collectResults(base)
    const installers = results.filter((result) => result.kind === "installer")
    expect(installers.length).toBe(CHANNEL_FILES.length)
    expect(installers.every((result) => result.ok)).toBe(true)
    expect(installers[0]?.note).toContain("content-encoding: gzip")
  } finally {
    await server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})

test("flags a missing content-length as unverified without failing", async () => {
  const yml = channelYml("app.deb", 3)
  const raw = createServer((socket) => {
    socket.on("error", () => {})
    let request = ""
    const respond = (chunk: Buffer) => {
      request += chunk.toString()
      if (!request.includes("\r\n\r\n")) return
      socket.off("data", respond)
      const path = request.split("\r\n")[0]?.split(" ")[1] ?? ""
      if (path.endsWith(".yml")) {
        socket.write(`HTTP/1.1 200 OK\r\nContent-Length: ${Buffer.byteLength(yml)}\r\nConnection: close\r\n\r\n${yml}`)
        return
      }
      socket.write("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n3\r\nabc\r\n0\r\n\r\n")
    }
    socket.on("data", respond)
  })
  await new Promise<void>((resolve) => raw.listen(0, "127.0.0.1", resolve))
  const address = raw.address()
  const base = address && typeof address === "object" ? `http://127.0.0.1:${address.port}` : ""
  try {
    const results = await collectResults(base)
    expect(results.every((result) => result.ok)).toBe(true)
    const installer = results.find((result) => result.kind === "installer")
    expect(installer?.note).toContain("no content-length (size unverified)")
  } finally {
    raw.close()
  }
})

test("main exits 1 and appends a failed summary when a channel is missing", async () => {
  const files: Record<string, string> = { "app.deb": "abc" }
  for (const name of CHANNEL_FILES) files[name] = channelYml("app.deb", 3)
  const { dir, server, base } = await serve(files)
  const summaryPath = join(dir, "summary.md")
  const run = () =>
    Bun.spawn([process.execPath, join(import.meta.dir, "verify-update-feed.ts")], {
      env: {
        ...process.env,
        GH_REPO: "x/y",
        RELEASE_TAG: "v1",
        UPDATE_FEED_BASE_URL: base,
        GITHUB_STEP_SUMMARY: summaryPath,
      },
      stdout: "pipe",
      stderr: "pipe",
    }).exited
  try {
    expect(await run()).toBe(0)
    expect(await Bun.file(summaryPath).text()).toContain("✅")

    await rm(join(dir, "latest-linux-arm64.yml"))
    expect(await run()).toBe(1)
    expect(await Bun.file(summaryPath).text()).toContain("❌")
  } finally {
    await server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
})
