#!/usr/bin/env bun

import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const temp = await mkdtemp(path.join(os.tmpdir(), "openctrlc-runtime-"))
const roots = ["home", "data", "cache", "config", "state", "tmp", "legacy-sentinel"]
const directories = Object.fromEntries(roots.map((name) => [name, path.join(temp, name)]))
const sentinel = path.join(directories["legacy-sentinel"], "sentinel.txt")
const sentinelText = "openctrlc runtime sentinel\n"
const failures: string[] = []

try {
  await Promise.all(Object.values(directories).map((directory) => Bun.$`mkdir -p ${directory}`))
  await writeFile(sentinel, sentinelText)
  const before = await Bun.file(sentinel).arrayBuffer()
  const beforeHash = new Bun.CryptoHasher("sha256").update(before).digest("hex")
  const beforeSentinel = await snapshot(directories["legacy-sentinel"])
  const env = {
    HOME: directories.home,
    XDG_DATA_HOME: directories.data,
    XDG_CACHE_HOME: directories.cache,
    XDG_CONFIG_HOME: directories.config,
    XDG_STATE_HOME: directories.state,
    TMPDIR: directories.tmp,
    OPENCTRLC_TEST_HOME: directories.home,
    OPENCODE_TEST_HOME: directories["legacy-sentinel"],
    OPENCTRLC_DISABLE_MODELS_FETCH: "1",
    PATH: process.env.PATH ?? "",
  }
  const entry = path.join(root, "packages/opencode/src/index.ts")

  for (const args of [["--version"], ["--help"], ["serve", "--help"]]) {
    const result = Bun.spawnSync([process.execPath, "run", "--conditions=browser", entry, ...args], {
      cwd: root,
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = `${decode(result.stdout)}${decode(result.stderr)}`
    const command = args.join(" ")
    if (result.exitCode !== 0) failures.push(`${command} exited with ${result.exitCode}\n${output}`)
    if (output.length === 0) failures.push(`${command} returned no output`)
    if (/opencode/i.test(output)) failures.push(`${command} contains the legacy opencode identity`)
    if (args.length > 1 || args[0] === "--help") {
      if (!/openctrlc/i.test(output)) failures.push(`${command} does not contain openctrlc`)
    }
    console.log(`${command}: exit ${result.exitCode}`)
    console.log(output.trim())
  }

  for (const name of roots) {
    for (const relative of await walk(directories[name])) {
      if (/(?:^|[\\/])\.opencode(?:$|[\\/])|opencode/i.test(relative)) {
        failures.push(`legacy path created under ${name}: ${relative}`)
      }
    }
  }

  for (const name of ["data", "cache", "config", "state", "tmp"]) {
    if (!(await exists(path.join(directories[name], "openctrlc")))) {
      failures.push(`missing ${name}/openctrlc runtime directory`)
    }
  }

  const after = await Bun.file(sentinel).arrayBuffer()
  const afterHash = new Bun.CryptoHasher("sha256").update(after).digest("hex")
  const afterSentinel = await snapshot(directories["legacy-sentinel"])
  if (beforeHash !== afterHash || new TextDecoder().decode(after) !== sentinelText || beforeSentinel !== afterSentinel)
    failures.push("legacy sentinel changed")
  if (await exists(path.join(directories.cache, "bun")))
    console.log("cache/bun: Bun noise excluded from product assertions")

  console.log(`sentinel SHA-256 before: ${beforeHash}`)
  console.log(`sentinel SHA-256 after:  ${afterHash}`)

  if (failures.length > 0) {
    console.error(["OpenCtrlC runtime smoke failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"))
    process.exitCode = 1
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}

if (failures.length === 0) console.log("OpenCtrlC runtime smoke passed")

function decode(value: Uint8Array) {
  return new TextDecoder().decode(value)
}

async function exists(file: string) {
  return (await stat(file).catch(() => undefined)) !== undefined
}

async function walk(directory: string, relative = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  return Array.fromAsync(entries, async (entry) => {
    const current = path.join(relative, entry.name)
    if (!entry.isDirectory()) return [current]
    return [current, ...(await walk(path.join(directory, entry.name), current))]
  }).then((items) => items.flat())
}

async function snapshot(directory: string) {
  const entries = await walk(directory)
  return JSON.stringify(
    await Promise.all(
      entries.map(async (relative) => {
        const file = path.join(directory, relative)
        if ((await stat(file)).isDirectory()) return `${relative}/`
        const content = await Bun.file(file).arrayBuffer()
        return `${relative}:${new Bun.CryptoHasher("sha256").update(content).digest("hex")}`
      }),
    ),
  )
}
