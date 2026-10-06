// Compare an isolated dev launch with and without early session-route warming.
// The script refuses to attach to, reload, or stop an existing app instance.
//
// Usage: node perf/experiment-warm-vs-cold.mjs [--baseline|--warm] [--keep]

import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { fileURLToPath } from "node:url"

const REPO = fileURLToPath(new URL("../", import.meta.url))
const CDP = "http://127.0.0.1:9222"
const warm = process.argv.includes("--warm")
const keep = process.argv.includes("--keep")
const budgetMs = 90_000
let child
let client
let stopping = false
let keepChild = false

const freePort = (port) =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") return resolve(false)
      reject(error)
    })
    server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolve(true)))
  })

const connect = async (url) => {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", () => reject(new Error("CDP connection failed")), { once: true })
  })
  let id = 0
  const pending = new Map()
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.error) entry.reject(new Error("CDP command failed"))
    else entry.resolve(message.result)
  })
  return {
    send(method, params = {}) {
      const next = ++id
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.delete(next)) return
          reject(new Error("CDP command timed out"))
        }, 30_000)
        pending.set(next, { resolve, reject, timer })
        socket.send(JSON.stringify({ id: next, method, params }))
      })
    },
    close() {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.reject(new Error("CDP connection closed"))
      }
      pending.clear()
      socket.close()
    },
  }
}

const evaluate = async (expression) => {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error("Renderer measurement failed")
  return result.result.value
}

const stopChild = async () => {
  if (stopping || !child?.pid) return
  stopping = true
  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM")
  } catch {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, 0)
    process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL")
  } catch {}
}

const WARM_SOURCE = `
(() => {
  globalThis.__warm = { startedAt: Math.round(performance.now()), doneAt: null, failed: false };
  const sessionTab = (() => {
    try {
      return Object.keys(localStorage).some((key) =>
        key.endsWith(".last-active-url") && (localStorage.getItem(key) ?? "").includes("/session/"),
      );
    } catch { return false }
  })();
  if (!sessionTab) { globalThis.__warm.skipped = true; return }
  import("/@fs${REPO.replaceAll("\\", "/")}packages/app/src/pages/session-route-view.tsx")
    .then(() => { globalThis.__warm.doneAt = Math.round(performance.now()) })
    .catch(() => { globalThis.__warm.failed = true });
})()
`

const STATE = `(() => ({
  isSessionRoute: location.pathname.includes("/session/"),
  skeleton: document.querySelectorAll(".animate-pulse").length,
  composer: !!document.querySelector('[data-component="prompt-input"]'),
  timeline: !!document.querySelector('[data-component="message-timeline"], [data-timeline]'),
  bodyLength: (document.body?.innerText ?? "").length,
  warm: globalThis.__warm ?? null
}))()`

const main = async () => {
  if (!(await freePort(9222)) || !(await freePort(5173))) {
    console.log("CDP/Vite 开发端口已被占用。为保护现有桌面进程，本次测量已停止；不会连接、刷新或结束现有进程。")
    process.exitCode = 2
    return
  }

  const started = Date.now()
  const milestones = new Set()
  const record = (label) => {
    if (milestones.has(label)) return
    milestones.add(label)
    console.log(`${String(Date.now() - started).padStart(7)}ms  ${label}`)
  }
  child = spawn("bun", ["run", "dev:desktop"], {
    cwd: REPO,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  })
  const consume = (chunk) => {
    const output = chunk.toString()
    for (const [pattern, label] of [
      [/app starting/, "main: app starting"],
      [/app ready/, "main: app ready"],
      [/restoring windows/, "main: restoring windows"],
      [/server ready/, "main: server ready"],
    ]) {
      if (pattern.test(output)) record(label)
    }
  }
  child.stdout.on("data", consume)
  child.stderr.on("data", consume)

  let page
  for (let i = 0; i < 900; i++) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const targets = await fetch(`${CDP}/json/list`).then((response) => response.json()).catch(() => [])
    page = targets.find((target) => {
      if (target.type !== "page") return false
      try {
        const url = new URL(target.url)
        return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.port === "5173"
      } catch {
        return false
      }
    })
    if (page) break
    if (child.exitCode !== null) break
  }
  if (!page) {
    console.log("本次启动没有产生本项目的 Vite renderer；未连接任何现有页面。")
    process.exitCode = 1
    return
  }
  record("attached to isolated renderer")

  client = await connect(page.webSocketDebuggerUrl)
  await client.send("Page.enable")
  if (warm) {
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: WARM_SOURCE })
    await client.send("Page.reload", { ignoreCache: false })
    record("isolated renderer reloaded with early warm-up")
  }

  let last
  let paintedAt
  for (let i = 0; i < budgetMs / 200; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    last = await evaluate(STATE).catch(() => undefined)
    if (last?.isSessionRoute && last.composer && last.skeleton === 0) {
      paintedAt = Date.now() - started
      break
    }
  }
  console.log(paintedAt === undefined ? "RESULT: session UI not ready within 90s" : `RESULT: session UI ready in ${paintedAt} ms`)
  console.log("renderer summary:", JSON.stringify({
    isSessionRoute: last?.isSessionRoute ?? false,
    skeleton: last?.skeleton ?? null,
    composer: last?.composer ?? false,
    timeline: last?.timeline ?? false,
    bodyLength: last?.bodyLength ?? null,
    warm: last?.warm ?? null,
  }))
  client.close()
  client = undefined
  if (keep) {
    keepChild = true
    console.log("isolated dev app left running (--keep)")
  }
}

process.once("SIGINT", () => {
  void stopChild().finally(() => process.exit(130))
})

try {
  console.log(warm ? "=== isolated launch: early route warm-up ===" : "=== isolated launch: baseline ===")
  await main()
} catch (error) {
  console.log(`Measurement stopped safely (${error instanceof Error ? error.name : "unknown error"}).`)
  process.exitCode = 1
} finally {
  client?.close()
  if (!keepChild) await stopChild()
}
