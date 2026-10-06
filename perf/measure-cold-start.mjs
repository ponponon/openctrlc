// Cold-start measurement: launches dev:desktop, then times how long the
// restored session actually takes to appear.
//
// Reports the full chain: process start -> main ready -> server ready ->
// transcript painted, plus DOM-observed milestones inside the renderer.
//
// Usage: run from the repository root: node perf/measure-cold-start.mjs [--keep] [--warm]

import { spawn, execSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { safeUrl } from "./safe-output.mjs"

const REPO = process.cwd()
const CDP = "http://127.0.0.1:9222"
const keep = process.argv.includes("--keep")
const warm = process.argv.includes("--warm")

const rows = []
const record = (label, ms) => {
  rows.push({ label, ms })
  console.log(`${String(ms).padStart(7)}ms  ${label}`)
}

// Never stop processes merely because they own the conventional dev ports.
let child
const stopChild = () => {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  try { process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM") } catch { child.kill("SIGTERM") }
}

const portFree = async (port) => {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`).toString()
    return out.trim() === ""
  } catch {
    return true
  }
}

const connect = async (url) => {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  let id = 0
  const pending = new Map()
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result)
  })
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const next = ++id
        pending.set(next, { resolve, reject })
        socket.send(JSON.stringify({ id: next, method, params }))
        setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 60000)
      }),
    close: () => socket.close(),
  }
}

const evaluate = async (client, expression) => {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed")
  return result.result.value
}

const STATE = `(() => {
  const composer = document.querySelector('[data-component="prompt-input"]');
  const skeleton = document.querySelectorAll(".animate-pulse").length;
  const text = document.body?.innerText ?? "";
  const timelineText = (() => {
    const el = document.querySelector('[data-slot*="timeline"], [data-component*="timeline"], main');
    return el ? el.innerText.length : 0;
  })();
  return {
    composer: composer !== null,
    skeleton,
    bodyLen: text.length,
    timelineText,
    route: location.origin + location.pathname.replace(/\/session\/[^/]+/, "/session/:redacted")
  };
})()`

const main = async () => {
  if (!(await portFree("9222")) || !(await portFree("5173"))) {
    console.log("CDP/Vite ports 9222 or 5173 are already occupied. Close the existing dev app manually, then retry; this script never kills unrelated processes.")
    process.exitCode = 2
    return
  }

  const started = Date.now()
  const marks = { composer: null, painted: null, skeletonGone: null }
  child = spawn("bun", ["run", "dev:desktop"], {
    cwd: REPO,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, ELECTRON_ENABLE_LOGGING: undefined },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  })
  const consume = (chunk) => {
    for (const incoming of chunk.toString().split("\n")) {
      for (const [pattern, label] of [
        [/app starting/, "main: app starting"],
        [/app ready/, "main: app ready"],
        [/restoring windows/, "main: restoring windows"],
        [/server ready/, "main: server ready"],
        [/startup sequence complete/, "main: startup sequence complete"],
      ]) {
        if (pattern.test(incoming) && !rows.some((row) => row.label === label)) record(label, Date.now() - started)
      }
    }
  }
  child.stdout.on("data", consume)
  child.stderr.on("data", consume)

  // Wait for renderer CDP target.
  let page = null
  for (let i = 0; i < 900; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const list = await fetch(`${CDP}/json/list`).then((r) => r.json()).catch(() => null)
    page = list?.find((item) => item.type === "page")
    if (page) break
  }
  if (!page) {
    console.log("renderer never appeared")
    writeFileSync("/tmp/cold-start.json", JSON.stringify({ rows, marks }, null, 2))
    if (!keep) stopChild()
    return
  }
  record("renderer CDP target available", Date.now() - started)

  const client = await connect(page.webSocketDebuggerUrl)
  let last = null
  for (let i = 0; i < 1800; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    last = await evaluate(client, STATE).catch(() => null)
    if (!last) continue
    last.route = safeUrl(last.route)
    const at = Date.now() - started
    if (marks.composer === null && last.composer) {
      marks.composer = at
      record("renderer: composer mounted", at)
    }
    if (marks.skeletonGone === null && last.skeleton === 0) {
      marks.skeletonGone = at
      record("renderer: loading skeleton gone", at)
    }
    if (marks.painted === null && last.skeleton === 0 && last.bodyLen > 5000) {
      marks.painted = at
      record("renderer: session content painted", at)
      break
    }
  }

  console.log("\nfinal DOM state:", JSON.stringify(last))
  console.log("bodyLen:", last?.bodyLen, "skeleton:", last?.skeleton)

  if (warm) {
    const warmStarted = Date.now()
    await client.send("Page.enable")
    await client.send("Page.reload", { ignoreCache: false })
    for (let i = 0; i < 900; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const state = await evaluate(client, STATE).catch(() => null)
      if (state?.route) state.route = safeUrl(state.route)
      if (state && state.skeleton === 0 && state.bodyLen > 5000) {
        record("warm reload: session content painted", Date.now() - warmStarted)
        break
      }
    }
  }

  writeFileSync("/tmp/cold-start.json", JSON.stringify({ rows, last, marks }, null, 2))
  console.log("\nwrote /tmp/cold-start.json")
  client.close()
  if (keep) {
    console.log("leaving app running (--keep)")
    return
  }
  stopChild()
}

process.on("SIGINT", () => {
  stopChild()
  process.exit(130)
})

try {
  await main()
} finally {
  if (!keep) stopChild()
}
