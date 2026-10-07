// Capture live network + console activity from the running renderer to find
// what stalls the restored session transcript. Records both response-header
// time and full response-body completion; request and response bodies are never read.
//
// Usage: node perf/capture-network.mjs [seconds] [--reload]
// Reload is opt-in; console and exception bodies are intentionally omitted.

import { safeUrl } from "./safe-output.mjs"

const CDP = "http://127.0.0.1:9222"
const args = process.argv.slice(2)
const reload = args.includes("--reload")
const seconds = Number(args.find((arg) => !arg.startsWith("--")) ?? 12)

const list = await fetch(`${CDP}/json/list`).then((r) => r.json())
const page = list.find((item) => {
  if (item.type !== "page") return false
  try {
    const url = new URL(item.url)
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "5173" &&
      (url.pathname === "/" || url.pathname.endsWith("/index.html"))
    )
  } catch {
    return false
  }
})
if (!page) throw new Error("no dev desktop renderer target on localhost:5173")

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
      headersAt: null,
      finishedAt: null,
      status: null,
      type: message.params.type,
    })
  }
  if (message.method === "Network.responseReceived") {
    const entry = requests.get(message.params.requestId)
    if (entry) {
      entry.status = message.params.response.status
      entry.mime = message.params.response.mimeType
      entry.headersAt = message.params.timestamp
    }
  }
  if (message.method === "Network.loadingFinished") {
    const entry = requests.get(message.params.requestId)
    if (entry) {
      entry.finishedAt = message.params.timestamp
      entry.encodedBytes = message.params.encodedDataLength
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
    const timer = setTimeout(() => {
      if (!pending.delete(next)) return
      reject(new Error(`timeout ${method}`))
    }, 30000)
    pending.set(next, {
      resolve: (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      reject: (error) => {
        clearTimeout(timer)
        reject(error)
      },
    })
    socket.send(JSON.stringify({ id: next, method, params }))
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
  const headersMs = r.headersAt ? `${Math.round((r.headersAt - r.started) * 1000)}ms` : "?"
  const totalMs = r.finishedAt ? `${Math.round((r.finishedAt - r.started) * 1000)}ms` : "pending"
  const state = r.failed ? `FAILED ${r.failed}` : r.status === null ? "PENDING" : r.status
  const bytes = r.encodedBytes === undefined ? "? B" : `${r.encodedBytes} B`
  return `${String(state).padEnd(18)} headers ${headersMs.padStart(7)} total ${totalMs.padStart(8)} ${bytes.padStart(10)}  ${r.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, "").slice(0, 110)}`
}
console.log("\n-- session requests --")
for (const r of sessionRows.slice(0, 60)) console.log(fmt(r))
console.log("\n-- pending/failed (all) --")
for (const r of rows.filter((r) => r.failed || r.finishedAt === null).slice(0, 40)) console.log(fmt(r))
console.log("\n-- slowest completed --")
for (const r of rows
  .filter((r) => r.finishedAt)
  .sort((a, b) => b.finishedAt - b.started - (a.finishedAt - a.started))
  .slice(0, 15))
  console.log(fmt(r))

console.log("\n-- console/exceptions --")
for (const e of events.slice(-40)) console.log(JSON.stringify(e))

socket.close()
