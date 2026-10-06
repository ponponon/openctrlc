// Measure authenticated sidecar endpoint latency from inside the renderer,
// where the app already holds the sidecar credentials.
//
// Usage: node perf/probe-sidecar.mjs
// The script probes only the session currently open in the renderer and never
// prints its identifier, the sidecar URL, credentials, or response content.

const CDP = "http://127.0.0.1:9222"

const list = await fetch(CDP + "/json/list").then((r) => r.json())
const page = list.find((item) => item.type === "page")
if (!page) throw new Error("no page target")

const socket = new WebSocket(page.webSocketDebuggerUrl)
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

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const next = ++id
    pending.set(next, { resolve, reject })
    socket.send(JSON.stringify({ id: next, method, params }))
    setTimeout(() => {
      if (!pending.delete(next)) return
      reject(new Error("CDP request timed out"))
    }, 120000)
  })

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error("renderer evaluation failed")
  return result.result.value
}

const output = await evaluate(
  "(async () => {" +
    "const init = await window.api.awaitInitialization();" +
    "const auth = 'Basic ' + btoa((init.username ?? '') + ':' + (init.password ?? ''));" +
    "const base = init.url;" +
    "const routeParts = new URL(location.href).pathname.split('/').filter(Boolean);" +
    "const sessionId = routeParts.length >= 2 && routeParts.at(-2) === 'session' ? routeParts.at(-1) : '';" +
    "const results = [];" +
    "const probe = async (label, path) => {" +
    "const started = performance.now();" +
    "try {" +
    "const response = await fetch(base + path, { headers: { Authorization: auth } });" +
    "const body = await response.arrayBuffer();" +
    "results.push({ label, status: response.status, ms: Math.round(performance.now() - started), bytes: body.byteLength });" +
    "} catch (error) {" +
    "results.push({ label, status: error?.name ?? 'Error', ms: Math.round(performance.now() - started) });" +
    "}" +
    "};" +
    "await probe('path', '/path');" +
    "await probe('session status', '/session/status');" +
    "if (sessionId) {" +
    "await probe('current session detail', '/session/' + encodeURIComponent(sessionId));" +
    "await probe('current session detail (repeat)', '/session/' + encodeURIComponent(sessionId));" +
    "await probe('current session messages', '/session/' + encodeURIComponent(sessionId) + '/message?limit=20');" +
    "}" +
    "await probe('project', '/project');" +
    "await probe('provider summary', '/provider?view=summary');" +
    "let parallelMs = null;" +
    "if (sessionId) {" +
    "const started = performance.now();" +
    "await Promise.all([1, 2, 3].map(() => fetch(base + '/session/' + encodeURIComponent(sessionId), { headers: { Authorization: auth } }).then((r) => r.arrayBuffer())));" +
    "parallelMs = Math.round(performance.now() - started);" +
    "}" +
    "return { hasSelectedSession: Boolean(sessionId), results, parallelMs };" +
    "})()",
)

console.log(
  "selected session:",
  output.hasSelectedSession ? "yes (identifier hidden)" : "no; open a session to include session requests",
)
console.log("\nstatus       ms     bytes  probe")
for (const row of output.results) {
  console.log(
    String(row.status).padStart(9) +
      " " +
      String(row.ms).padStart(7) +
      " " +
      String(row.bytes ?? "").padStart(9) +
      "  " +
      row.label,
  )
}
if (output.parallelMs !== null) console.log("\n3 concurrent requests took: " + output.parallelMs + " ms")

socket.close()
