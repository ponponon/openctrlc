import { afterEach, describe, expect, test } from "bun:test"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Layer, Logger } from "effect"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { fileLogger, KEEP_ROTATED_LOGS, MAX_LOG_AGE_DAYS, MAX_LOG_BYTES } from "../../src/observability/logging"
import { resource } from "../../src/observability/otlp"
import { Global } from "../../src/global"
import { Brand } from "@openctrlc/identity"

const otelResourceAttributes = process.env.OTEL_RESOURCE_ATTRIBUTES
const opencodeClient = process.env.OPENCTRLC_CLIENT

afterEach(() => {
  if (otelResourceAttributes === undefined) delete process.env.OTEL_RESOURCE_ATTRIBUTES
  else process.env.OTEL_RESOURCE_ATTRIBUTES = otelResourceAttributes

  if (opencodeClient === undefined) delete process.env.OPENCTRLC_CLIENT
  else process.env.OPENCTRLC_CLIENT = opencodeClient
})

describe("resource", () => {
  test("parses and decodes OTEL resource attributes", () => {
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "service.namespace=anomalyco,team=platform%2Cobservability,label=hello%3Dworld,key%2Fname=value%20here"

    expect(resource().attributes).toMatchObject({
      "service.namespace": "anomalyco",
      team: "platform,observability",
      label: "hello=world",
      "key/name": "value here",
    })
  })

  test("drops OTEL resource attributes when any entry is invalid", () => {
    process.env.OTEL_RESOURCE_ATTRIBUTES = "service.namespace=anomalyco,broken"

    expect(resource().attributes["service.namespace"]).toBeUndefined()
    expect(resource().attributes["opencode.client"]).toBeDefined()
  })

  test("keeps built-in attributes when env values conflict", () => {
    process.env.OPENCTRLC_CLIENT = "cli"
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "opencode.client=web,service.instance.id=override,service.namespace=anomalyco"

    expect(resource().attributes).toMatchObject({
      "opencode.client": "cli",
      "service.namespace": "anomalyco",
    })
    expect(resource().attributes["service.instance.id"]).not.toBe("override")
    expect(resource().attributes["opencode.run"]).toMatch(/^[0-9a-f]{8}$/)
  })
})

test("file logger appends concurrent runs with a run on every line", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openctrlc-log-test-"))
  await using _ = {
    async [Symbol.asyncDispose]() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
  const file = path.join(dir, "openctrlc.log")
  const write = (runID: string) =>
    Effect.forEach(
      Array.from({ length: 50 }, (_, index) => index),
      (index) => Effect.logInfo(`entry-${index}`),
    ).pipe(
      Effect.provide(Logger.layer([fileLogger(file, runID)]).pipe(Layer.provide(NodeFileSystem.layer), Layer.orDie)),
      Effect.scoped,
    )

  await Effect.runPromise(Effect.all([write("run-a"), write("run-b")], { concurrency: "unbounded" }))

  const lines = (await Bun.file(file).text()).trim().split("\n")
  expect(lines).toHaveLength(100)
  expect(lines.filter((line) => line.includes("run=run-a"))).toHaveLength(50)
  expect(lines.filter((line) => line.includes("run=run-b"))).toHaveLength(50)
  expect(lines.every((line) => line.startsWith("timestamp=") && line.includes(" level=INFO "))).toBe(true)
  expect(lines.every((line) => !line.includes(" fiber="))).toBe(true)
  expect(lines.every((line) => !line.startsWith("{"))).toBe(true)
})

test("file logger flattens nested objects", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openctrlc-log-test-"))
  await using _ = {
    async [Symbol.asyncDispose]() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
  const file = path.join(dir, "openctrlc.log")

  await Effect.logInfo("request complete", {
    request: { method: "GET", timing: { duration: 42 } },
    tags: ["api", "test"],
  }).pipe(
    Effect.annotateLogs({ session: { id: "session-1" } }),
    Effect.provide(Logger.layer([fileLogger(file, "run-a")]).pipe(Layer.provide(NodeFileSystem.layer), Layer.orDie)),
    Effect.scoped,
    Effect.runPromise,
  )

  const line = (await Bun.file(file).text()).trim()
  expect(line).toContain('message="request complete"')
  expect(line).toContain("request.method=GET")
  expect(line).toContain("request.timing.duration=42")
  expect(line).toContain('tags="[\\\"api\\\",\\\"test\\\"]"')
  expect(line).toContain("session.id=session-1")
  expect(line).not.toContain("request={")
})

test("default file logger writes under the OpenCtrlC log path", async () => {
  const file = path.join(Global.Path.log, `${Brand.runtimeDirectory}.log`)
  await fs.rm(file, { force: true })
  await Effect.logInfo("default logger path").pipe(
    Effect.provide(Logger.layer([fileLogger()]).pipe(Layer.provide(NodeFileSystem.layer), Layer.orDie)),
    Effect.scoped,
    Effect.runPromise,
  )

  expect(await Bun.file(file).exists()).toBe(true)
  await fs.rm(file, { force: true })
})

test("file logger rotates an oversized file into the first rotated slot", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openctrlc-log-test-"))
  await using _ = {
    async [Symbol.asyncDispose]() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
  const file = path.join(dir, "openctrlc.log")
  await fs.writeFile(file, "x".repeat(MAX_LOG_BYTES + 1024))

  const logger = fileLogger(file, "run-a")
  expect(await Bun.file(`${file}.1`).exists()).toBe(true)
  expect(await Bun.file(file).exists()).toBe(false)

  await Effect.logInfo("after rotation").pipe(
    Effect.provide(Logger.layer([logger]).pipe(Layer.provide(NodeFileSystem.layer), Layer.orDie)),
    Effect.scoped,
    Effect.runPromise,
  )

  const lines = (await Bun.file(file).text()).trim().split("\n")
  expect(lines).toHaveLength(1)
  expect(lines[0]).toContain("after rotation")
  expect(lines[0]).toContain("run=run-a")
  expect((await Bun.file(`${file}.1`).text()).startsWith("x")).toBe(true)
})

test("file logger drops a legacy file far past the rotation limit", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openctrlc-log-test-"))
  await using _ = {
    async [Symbol.asyncDispose]() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
  const file = path.join(dir, "openctrlc.log")
  await fs.writeFile(file, "x".repeat(MAX_LOG_BYTES * 3))

  fileLogger(file, "run-a")

  expect(await Bun.file(file).exists()).toBe(false)
  expect(await Bun.file(`${file}.1`).exists()).toBe(false)
})

test("file logger prunes rotated copies past the retention window", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openctrlc-log-test-"))
  await using _ = {
    async [Symbol.asyncDispose]() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
  const file = path.join(dir, "openctrlc.log")
  const stale = `${file}.1`
  const recent = `${file}.2`
  await fs.writeFile(stale, "old")
  await fs.writeFile(recent, "newer")
  const expired = new Date(Date.now() - (MAX_LOG_AGE_DAYS + 1) * 24 * 60 * 60 * 1000)
  await fs.utimes(stale, expired, expired)

  fileLogger(file, "run-a")

  expect(await Bun.file(stale).exists()).toBe(false)
  expect(await Bun.file(recent).exists()).toBe(true)
  expect(KEEP_ROTATED_LOGS).toBe(2)
})

test("file logger rotates mid-run once a batch pushes it past the limit", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openctrlc-log-test-"))
  await using _ = {
    async [Symbol.asyncDispose]() {
      await fs.rm(dir, { recursive: true, force: true })
    },
  }
  const file = path.join(dir, "openctrlc.log")
  const megabyte = "y".repeat(1024 * 1024)

  await Effect.scoped(
    Effect.gen(function* () {
      const logger = yield* fileLogger(file, "run-a")
      yield* Effect.logInfo(megabyte).pipe(Effect.repeat({ times: 11 }), Effect.provide(Logger.layer([logger])))
      // Let the first window flush the big batch, then keep the logger alive
      // across a second window so the size check runs against that batch.
      yield* Effect.sleep(1200)
      yield* Effect.logInfo("mid-run rotation").pipe(Effect.provide(Logger.layer([logger])))
      yield* Effect.sleep(1200)
    }),
  ).pipe(Effect.runPromise)

  expect(await Bun.file(`${file}.1`).exists()).toBe(true)
  const current = (await Bun.file(file).text()).trim()
  expect(current).toContain("mid-run rotation")
  expect(current.split("\n")).toHaveLength(1)
}, 15_000)
