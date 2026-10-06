// Log every renderer request/response with timestamps during a cold page load,
// so a stalled dependency can be identified when the app is launched fresh.
//
// Attaches to the renderer as early as possible, then records the request
// timeline (no per-request polling, so it does not perturb the load).
//
// Usage: run right after the app starts:
//   node perf/cold-request-log.mjs [seconds]

import { safeUrl } from "./safe-output.mjs"

const CDP = "http://127.0.0.1:9222"
const seconds = Number(process.argv[2] ?? 120)

let page = null
for (let i = 0; i < 1200; i++) {
  const list = await fetch(`${CDP}/json/list`).then((r) => r.json()).catch(() => null)
  page = list?.find((item) => item.type === "page")
  if (page) break
  await new Promise((resolve) => setTimeout(resolve, 100))
}
if (!page) throw new Error("no page target appeared")
console.log("attached to renderer at", new Date().toISOString())

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", reject, { once: true })
})

let id = 0
const pending = new Map()
const requests = new Map()
const t0 = Date.now()
const milestones = []

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
    requests.set(params.requestId, { url: params.request.url, at: Date.now() - t0, done: null, status: null, failed: null })
    if (/prompt-input|markdown|session-route-view|shiki|pierre/.test(params.request.url)) {
      milestones.push(`+${Date.now() - t0}ms REQ  ${safeUrl(params.request.url)}`)
    }
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
    setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 60000)
  })

await send("Network.enable").catch((error) => console.log("Network.enable failed:", error.message))

await new Promise((resolve) => setTimeout(resolve, seconds * 1000))

const rows = [...requests.values()].map((row) => ({ ...row, url: safeUrl(row.url) }))
const stuck = rows.filter((r) => r.done === null && !r.failed)
console.log(`\n=== ${rows.length} requests, ${stuck.length} never completed, window ${seconds}s ===`)

console.log("\n-- milestones (session-critical modules) --")
for (const line of milestones.slice(0, 60)) console.log("  " + line)

console.log("\n-- never completed --")
for (const r of stuck.slice(0, 30)) console.log(`  t+${String(r.at).padStart(7)}ms  ${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 120)}`)

console.log("\n-- slowest 20 completed --")
for (const r of rows.filter((r) => r.done !== null).sort((a, b) => b.done - b.at - (a.done - a.at)).slice(0, 20)) {
  console.log(`  ${String(r.done - r.at).padStart(7)}ms ${String(r.status).padStart(4)} ${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 110)}`)
}

const state = await send("Runtime.evaluate", {
  expression: `(() => ({ skeleton: document.querySelectorAll(".animate-pulse").length, bodyLen: (document.body?.innerText ?? "").length, composer: !!document.querySelector('[data-component="prompt-input"]') }))()`,
  returnByValue: true,
}).then((r) => r.result.value).catch(() => null)
console.log("\nfinal renderer state:", JSON.stringify(state))

socket.close()
