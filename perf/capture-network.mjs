// Capture live network + console activity from the running renderer to find
// what stalls the restored session transcript.
//
// Usage: node perf/capture-network.mjs [seconds] [--reload]
// Reload is opt-in; console and exception bodies are intentionally omitted.

import { safeUrl } from "./safe-output.mjs"

const CDP = "http://127.0.0.1:9222"
const args = process.argv.slice(2)
const reload = args.includes("--reload")
const seconds = Number(args.find((arg) => !arg.startsWith("--")) ?? 12)

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
const events = []

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result)
    return
  }
  if (message.method === "Network.requestWillBeSent") {
    const { requestId, request, timestamp } = message.params
    requests.set(requestId, {
      url: request.url,
      method: request.method,
      started: timestamp,
      status: null,
      type: message.params.type,
    })
  }
  if (message.method === "Network.responseReceived") {
    const entry = requests.get(message.params.requestId)
    if (entry) {
      entry.status = message.params.response.status
      entry.mime = message.params.response.mimeType
      entry.finished = message.params.timestamp
    }
  }
  if (message.method === "Network.loadingFailed") {
    const entry = requests.get(message.params.requestId)
    if (entry) entry.failed = message.params.errorText
  }
  if (message.method === "Runtime.consoleAPICalled") {
    events.push({ kind: "console", type: message.params.type })
  }
  if (message.method === "Runtime.exceptionThrown") {
    events.push({ kind: "exception", type: message.params.exceptionDetails?.exception?.className ?? "Error" })
  }
  if (message.method === "Log.entryAdded") {
    events.push({ kind: "log", level: message.params.entry.level })
  }
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const next = ++id
    pending.set(next, { resolve, reject })
    socket.send(JSON.stringify({ id: next, method, params }))
    setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 30000)
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
const sessionRows = rows.filter((r) => /\/session/.test(r.url))
console.log(`=== ${rows.length} requests, ${sessionRows.length} session-related ===`)
const fmt = (r) => {
  const dur = r.finished ? Math.round((r.finished - r.started) * 1000) : null
  const state = r.failed ? `FAILED ${r.failed}` : r.status === null ? "PENDING" : r.status
  return `${String(state).padEnd(18)} ${dur === null ? "   ?" : String(dur).padStart(6)}ms  ${r.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, "").slice(0, 110)}`
}
console.log("\n-- session requests --")
for (const r of sessionRows.slice(0, 60)) console.log(fmt(r))
console.log("\n-- pending/failed (all) --")
for (const r of rows.filter((r) => r.failed || r.status === null).slice(0, 40)) console.log(fmt(r))
console.log("\n-- slowest completed --")
for (const r of rows
  .filter((r) => r.finished)
  .sort((a, b) => b.finished - b.started - (a.finished - a.started))
  .slice(0, 15))
  console.log(fmt(r))

console.log("\n-- console/exceptions --")
for (const e of events.slice(-40)) console.log(JSON.stringify(e))

socket.close()
