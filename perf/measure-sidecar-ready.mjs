// Measure how long the desktop sidecar takes to become HTTP-responsive after
// `dev:desktop` is launched. Polls the sidecar port directly (401 means the
// handler answered), so it separates "port open" from "server responding".
//
// Usage: run from the repository root with no existing desktop dev instance:
// node perf/measure-sidecar-ready.mjs

import { spawn, execSync } from "node:child_process"

const REPO = process.cwd()

const pidsOn = (port) => {
  try {
    return execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`)
      .toString()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const occupied = ["9222", "5173"].filter((port) => pidsOn(port).length > 0)
if (occupied.length)
  throw new Error(
    "CDP/Vite ports already occupied; close the existing dev app manually. This script never kills unrelated processes.",
  )

const started = Date.now()
const child = spawn("bun", ["run", "dev:desktop"], {
  cwd: REPO,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
})
const stopChild = () => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return
  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM")
  } catch {
    child.kill("SIGTERM")
  }
}
process.on("SIGINT", () => {
  stopChild()
  process.exit(130)
})
process.on("exit", stopChild)

let sidecarUrl = null
const consume = (chunk) => {
  for (const line of chunk.toString().split("\n")) {
    const match = line.match(/spawning sidecar \{ url: 'http:\/\/127\.0\.0\.1:(\d+)'/)
    if (match && !sidecarUrl) {
      sidecarUrl = `http://127.0.0.1:${match[1]}`
      console.log(`${String(Date.now() - started).padStart(7)}ms  main: sidecar spawned (${sidecarUrl})`)
    }
    if (/server ready/.test(line) && !consume.readyLogged) {
      consume.readyLogged = true
      console.log(`${String(Date.now() - started).padStart(7)}ms  main: server ready`)
    }
  }
}
child.stdout.on("data", consume)
child.stderr.on("data", consume)

// Poll for the sidecar's first successful HTTP response.
let ready = null
for (let i = 0; i < 1200; i++) {
  await new Promise((resolve) => setTimeout(resolve, 250))
  if (!sidecarUrl) continue
  const probe = await fetch(`${sidecarUrl}/path`, { signal: AbortSignal.timeout(2000) })
    .then((r) => ({ ok: true, status: r.status }))
    .catch((error) => ({ ok: false, error: error.name }))
  if (probe.ok) {
    ready = Date.now() - started
    console.log(`${String(ready).padStart(7)}ms  sidecar answered HTTP (status ${probe.status})`)
    break
  }
}

// Sample repeated latency after readiness, plus the session list the app calls.
if (sidecarUrl) {
  for (let round = 1; round <= 3; round++) {
    const times = []
    for (let i = 0; i < 5; i++) {
      const at = Date.now()
      await fetch(`${sidecarUrl}/path`).catch(() => null)
      times.push(Date.now() - at)
    }
    console.log(`  round ${round} /path latency: ${times.join(", ")} ms`)
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

console.log("\nsummary:")
console.log("  sidecar HTTP-ready after:", ready, "ms from dev:desktop launch")

stopChild()
