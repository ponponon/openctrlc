// A/B experiment: does warming the session route chunk from the very start of
// the page load actually make the restored session paint on a cold start?
//
// This injects the warm-up via CDP Page.addScriptToEvaluateOnNewDocument, i.e.
// exactly the mechanism a real fix would use, WITHOUT touching product code.
//
//   --baseline   no injection (cold start as today)
//   --warm       inject chunk warm-up before app code runs
//
// Usage: node perf/experiment-warm-vs-cold.mjs [--baseline|--warm]

import { spawn, execSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const REPO = "/Users/ponponon/Desktop/code/me/ai_agent/openctrlc"
const CDP = "http://127.0.0.1:9222"
const warm = process.argv.includes("--warm")
const budgetMs = 90_000

const pidsOn = (port) => {
  try {
    return execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`).toString().split("\n").map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}
const stopApp = () => {
  for (const port of ["9222", "5173"]) for (const pid of pidsOn(port)) {
    try { process.kill(Number(pid), "SIGTERM") } catch {}
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

// Runs before ANY app code on every new document. It mirrors the desktop
// initial URL check and starts fetching the session route module graph
// immediately, in parallel with the app shell.
const WARM_SOURCE = `
(() => {
  globalThis.__warm = { at: Math.round(performance.now()), done: null, error: null };
  const url = (() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.includes("last-active-url")) continue;
        const value = localStorage.getItem(key);
        if (value && value.includes("/session/")) return value;
      }
    } catch {}
    return "";
  })();
  if (!url) { globalThis.__warm.skipped = true; return }
  import("/@fs${REPO}/packages/app/src/pages/session-route-view.tsx")
    .then(() => { globalThis.__warm.done = Math.round(performance.now()) })
    .catch((error) => { globalThis.__warm.error = String(error).slice(0, 200) });
})()
`

const STATE = `(() => {
  const skeleton = document.querySelectorAll(".animate-pulse").length;
  const text = document.body?.innerText ?? "";
  return {
    skeleton,
    bodyLen: text.length,
    composer: !!document.querySelector('[data-component="prompt-input"]'),
    warm: globalThis.__warm ?? null,
    resources: performance.getEntriesByType("resource").length
  };
})()`

stopApp()
await new Promise((resolve) => setTimeout(resolve, 3000))

console.log(warm ? "=== VARIANT: cold start + injected warm-up ===" : "=== VARIANT: cold start baseline (no warm-up) ===")
const started = Date.now()
const child = spawn("bun", ["run", "dev:desktop"], {
  cwd: REPO,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  stdio: ["ignore", "pipe", "pipe"],
})
const logLines = []
const consume = (chunk) => {
  for (const line of chunk.toString().split("\n")) {
    logLines.push(line)
    if (/app starting/.test(line) && !consume.appAt) { consume.appAt = Date.now() - started; console.log(`${String(consume.appAt).padStart(7)}ms  main: app starting`) }
    if (/restoring windows/.test(line) && !consume.winAt) { consume.winAt = Date.now() - started; console.log(`${String(consume.winAt).padStart(7)}ms  main: restoring windows`) }
  }
}
child.stdout.on("data", consume)
child.stderr.on("data", consume)

let page = null
for (let i = 0; i < 1500; i++) {
  await new Promise((resolve) => setTimeout(resolve, 100))
  const list = await fetch(`${CDP}/json/list`).then((r) => r.json()).catch(() => null)
  page = list?.find((item) => item.type === "page")
  if (page) break
}
if (!page) {
  console.log("renderer never appeared")
  stopApp()
  process.exit(1)
}
const attachedAt = Date.now() - started
console.log(`${String(attachedAt).padStart(7)}ms  attached to renderer`)

const client = await connect(page.webSocketDebuggerUrl)
await client.send("Page.enable")

if (warm) {
  // The document is already loading, so register for the NEXT document and
  // reload: that gives a real cold-like first page load with warm-up applied
  // before app code, which is what the fix changes.
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: WARM_SOURCE })
  const reloadAt = Date.now()
  await client.send("Page.reload", { ignoreCache: false })
  console.log(`${String(Date.now() - started).padStart(7)}ms  reload issued with warm-up injected`)
  var t0 = reloadAt
} else {
  var t0 = started
}

let painted = null
let last = null
for (let i = 0; i < budgetMs / 200; i++) {
  await new Promise((resolve) => setTimeout(resolve, 200))
  last = await evaluate(client, STATE).catch(() => null)
  if (!last) continue
  if (last.skeleton === 0 && last.bodyLen > 5000) {
    painted = Date.now() - t0
    break
  }
}
console.log(`${String(Date.now() - t0).padStart(7)}ms  session content painted`)
console.log("final state:", JSON.stringify({ skeleton: last?.skeleton, bodyLen: last?.bodyLen, composer: last?.composer, resources: last?.resources }))
console.log("warm probe:", JSON.stringify(last?.warm))
console.log(painted === null ? "\nRESULT: still NOT painted within budget" : `\nRESULT: painted in ${painted} ms`)

writeFileSync(warm ? "/tmp/experiment-warm.json" : "/tmp/experiment-baseline.json", JSON.stringify({ warm, painted, last, logLines }, null, 2))
client.close()
stopApp()
