// Watch the module-graph load on a cold renderer load, sampling request counts
// over time to locate the stall that keeps the session skeleton mounted.
//
// Usage: node perf/watch-module-load.mjs [seconds]
// Reload only when --reload is supplied.

import { safeUrl } from "./safe-output.mjs"

const CDP = "http://127.0.0.1:9222"
const args = process.argv.slice(2)
const reload = args.includes("--reload")
const seconds = Number(args.find((arg) => !arg.startsWith("--")) ?? 45)

const list = await fetch(`${CDP}/json/list`).then((r) => r.json())
const page = list.find((item) => item.type === "page")
if (!page) throw new Error("no page target")

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", reject, { once: true })
})

let id = 0
const pending = new Map()
const requests = new Map()
const t0 = Date.now()

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result)
    return
  }
  const params = message.params
  if (message.method === "Network.requestWillBeSent") {
    requests.set(params.requestId, { url: params.request.url, at: Date.now() - t0, done: null, status: null, failed: null, type: params.type })
  }
  if (message.method === "Network.responseReceived") {
    const entry = requests.get(params.requestId)
    if (entry) { entry.status = params.response.status; entry.done = Date.now() - t0 }
  }
  if (message.method === "Network.loadingFailed") {
    const entry = requests.get(params.requestId)
    if (entry) entry.failed = params.errorText
  }
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const next = ++id
    pending.set(next, { resolve, reject })
    socket.send(JSON.stringify({ id: next, method, params }))
    setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 120000)
  })

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed")
  return result.result.value
}

await send("Network.enable")
if (reload) {
  await send("Page.enable")
  await send("Page.reload", { ignoreCache: false })
}

console.log(`t+     reqs  done  pending  vitePending   skeleton  bodyLen`)
let lastReport = 0
for (let i = 0; i < seconds * 2; i++) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const elapsed = Math.round((Date.now() - t0) / 1000)
  if (elapsed === lastReport) continue
  lastReport = elapsed
  const rows = [...requests.values()]
  const vite = rows.filter((r) => /localhost:5173/.test(r.url))
  const state = await evaluate(`(() => ({ skeleton: document.querySelectorAll(".animate-pulse").length, bodyLen: (document.body?.innerText ?? "").length }))()`).catch(() => null)
  const doneCount = rows.filter((r) => r.done !== null || r.failed).length
  const vitePending = vite.filter((r) => r.done === null && !r.failed).length
  console.log(
    `${String(elapsed).padStart(4)}s ${String(rows.length).padStart(6)} ${String(doneCount).padStart(5)} ${String(rows.length - doneCount).padStart(8)} ${String(vitePending).padStart(12)} ${String(state?.skeleton ?? "?").padStart(9)} ${String(state?.bodyLen ?? "?").padStart(8)}`,
  )
}

const rows = [...requests.values()].map((row) => ({ ...row, url: safeUrl(row.url) }))
const stuck = rows.filter((r) => r.done === null && !r.failed)
console.log(`\n-- ${stuck.length} requests never completed --`)
for (const r of stuck.slice(0, 25)) console.log(`  t+${String(r.at).padStart(6)}ms ${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 110)}`)

console.log("\n-- slowest 15 completed --")
for (const r of rows.filter((r) => r.done !== null).sort((a, b) => b.done - b.at - (a.done - a.at)).slice(0, 15)) {
  console.log(`  ${String(r.done - r.at).padStart(6)}ms ${String(r.status).padStart(4)} ${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 110)}`)
}

socket.close()
