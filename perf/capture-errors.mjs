// Capture only errors/exceptions plus a coarse request waterfall during a
// session-restore reload, to explain why the transcript never paints.
//
// Usage: node perf/capture-errors.mjs [seconds] [--reload]
// Reload is opt-in; output omits raw console/exception text and URL values.

import { safeUrl } from "./safe-output.mjs"

const CDP = "http://127.0.0.1:9222"
const args = process.argv.slice(2)
const reload = args.includes("--reload")
const seconds = Number(args.find((arg) => !arg.startsWith("--")) ?? 20)

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
const errors = []
let firstModuleAt = null

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
    const url = params.request.url
    requests.set(params.requestId, { url, started: params.timestamp, finished: null, status: null, failed: null, type: params.type })
    if (firstModuleAt === null && /localhost:5173/.test(url)) firstModuleAt = params.timestamp
  }
  if (message.method === "Network.responseReceived") {
    const entry = requests.get(params.requestId)
    if (entry) { entry.status = params.response.status; entry.finished = params.timestamp }
  }
  if (message.method === "Network.loadingFailed") {
    const entry = requests.get(params.requestId)
    if (entry) entry.failed = params.errorText
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = params.exceptionDetails
    errors.push({ kind: "exception", type: details?.exception?.className ?? "Error" })
  }
  if (message.method === "Log.entryAdded" && (params.entry.level === "error" || params.entry.level === "warning")) {
    errors.push({ kind: `log:${params.entry.level}` })
  }
  if (message.method === "Runtime.consoleAPICalled" && (params.type === "error" || params.type === "warning")) {
    errors.push({ kind: `console:${params.type}` })
  }
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const next = ++id
    pending.set(next, { resolve, reject })
    socket.send(JSON.stringify({ id: next, method, params }))
    setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 60000)
  })

await send("Network.enable")
await send("Runtime.enable")
await send("Log.enable")
if (reload) {
  await send("Page.enable")
  await send("Page.reload", { ignoreCache: false })
}
await new Promise((resolve) => setTimeout(resolve, seconds * 1000))

const rows = [...requests.values()].map((row) => ({ ...row, url: safeUrl(row.url) }))
const vite = rows.filter((r) => /localhost:5173/.test(r.url))
const api = rows.filter((r) => !/localhost:5173/.test(r.url))
console.log(`=== total ${rows.length} requests: ${vite.length} vite modules, ${api.length} api/other ===`)
console.log("first vite module request at t+", firstModuleAt ? Math.round((firstModuleAt - Math.min(...rows.map((r) => r.started))) * 1000) : null, "ms")

const byDuration = rows.filter((r) => r.finished).map((r) => ({ ...r, dur: Math.round((r.finished - r.started) * 1000) })).sort((a, b) => b.dur - a.dur)
console.log("\n-- slowest 20 requests --")
for (const r of byDuration.slice(0, 20)) console.log(`${String(r.dur).padStart(7)}ms ${String(r.status ?? r.failed).padStart(14)} ${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 100)}`)

const pendingRows = rows.filter((r) => !r.finished && !r.failed)
console.log(`\n-- still pending at ${seconds}s: ${pendingRows.length} --`)
for (const r of pendingRows.slice(0, 20)) console.log(`        ${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 100)}`)

const failed = rows.filter((r) => r.failed || (r.status && r.status >= 400))
console.log(`\n-- failed / >=400: ${failed.length} --`)
for (const r of failed.slice(0, 30)) console.log(`${String(r.status ?? r.failed).padStart(16)} ${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 110)}`)

console.log(`\n-- errors/exceptions captured: ${errors.length} --`)
for (const e of errors.slice(0, 30)) console.log(`[${e.kind}] ${e.type ?? "diagnostic text omitted"}`)

socket.close()
