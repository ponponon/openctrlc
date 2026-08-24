// Smoke test: v1 SDK (the plugin contract) can actually reach core endpoints
// against the current server. v1 generation has been frozen since #5216
// (2025-12-07) so types may be stale, but runtime calls should still work
// for endpoints the v1 SDK was generated against.
import { afterEach, describe, expect, test } from "bun:test"
import path from "node:path"
import { createOpencodeClient } from "@openctrlc/sdk"
import { Server } from "../../src/server/server"
import { tmpdir, disposeAllInstances } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

function client(directory: string) {
  return createOpencodeClient({
    baseUrl: "http://test",
    directory,
    fetch: ((req: Request) => Server.Default().app.fetch(req)) as unknown as typeof fetch,
  })
}

describe("v1 SDK runtime smoke", () => {
  test("session.list reaches the server and returns 200", async () => {
    await using tmp = await tmpdir({ git: true, config: { formatter: false, lsp: false } })
    const sdk = client(tmp.path)
    const result = await sdk.session.list()
    expect(result.error).toBeUndefined()
    expect(Array.isArray(result.data)).toBe(true)
  })

  test("path.get reaches the server and returns 200", async () => {
    await using tmp = await tmpdir({ git: true, config: { formatter: false, lsp: false } })
    const sdk = client(tmp.path)
    const result = await sdk.path.get()
    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
  })

  test("config.get reaches the server and returns 200", async () => {
    await using tmp = await tmpdir({ git: true, config: { formatter: false, lsp: false } })
    const sdk = client(tmp.path)
    const result = await sdk.config.get()
    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
  })

  test("CLI smoke identity is OpenCtrlC and excludes the legacy product name", async () => {
    const process = Bun.spawn(
      ["bun", "run", "--conditions=browser", "./src/index.ts", "--help"],
      { cwd: path.resolve(import.meta.dir, "../.."), stdout: "pipe", stderr: "pipe" },
    )
    const output = `${await new Response(process.stdout).text()}\n${await new Response(process.stderr).text()}`
    expect(await process.exited).toBe(0)
    expect(output).toContain("openctrlc")
    expect(output.toLowerCase()).not.toContain("opencode")
  })

  test("session 404: result-tuple path returns the error body", async () => {
    await using tmp = await tmpdir({ git: true, config: { formatter: false, lsp: false } })
    const sdk = client(tmp.path)
    const result = await sdk.session.get({ path: { id: "ses_no_such" } as never })
    expect(result.error).toBeDefined()
    // wire body for 404 is NamedError-shaped
    expect(result.error).toMatchObject({ name: "NotFoundError" })
  })
})
