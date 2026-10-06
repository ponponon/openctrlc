// Measure the exact session endpoints the app reads at startup, from inside the
// renderer, using the real session IDs from the restored window URLs.
//
// Usage: node perf/probe-session-reads.mjs

const CDP = "http://127.0.0.1:9222"

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
    setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 180000)
  })
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) return { exception: result.exceptionDetails.text ?? "failed" }
  return result.result.value
}

const out = await evaluate(`(async () => {
  const init = await window.api.awaitInitialization();
  const auth = "Basic " + btoa((init.username ?? "") + ":" + (init.password ?? ""));
  const base = init.url;
  const ids = new Set();
  for (const key of Object.keys(localStorage)) {
    const value = localStorage.getItem(key) ?? "";
    const match = value.match(/\\/session\\/(ses_[A-Za-z0-9]+)/);
    if (match) ids.add(match[1]);
  }
  const results = [];
  const probe = async (label, path, withSignal) => {
    const started = performance.now();
    let status = 0, bytes = 0;
    try {
      const options = { headers: { Authorization: auth } };
      if (withSignal) options.signal = AbortSignal.timeout(25000);
      const response = await fetch(base + path, options);
      status = response.status;
      const text = await response.text();
      bytes = text.length;
    } catch (error) {
      status = String(error).slice(0, 60);
    }
    results.push({ label, path: path.slice(0, 70), status, ms: Math.round(performance.now() - started), bytes });
  };
  for (const sessionID of ids) {
    await probe("session detail", "/session/" + sessionID, true);
    await probe("messages limit20", "/session/" + sessionID + "/message?limit=20", true);
  }
  await probe("session status", "/session/status", true);
  // Same reads again, now that any first-request cost is paid.
  for (const sessionID of ids) {
    await probe("session detail (2nd)", "/session/" + sessionID, true);
  }
  return { base, ids: [...ids], results };
})()`)

if (out.exception) {
  console.log("evaluate failed:", out.exception)
} else {
  console.log("sidecar:", out.base)
  console.log("restored session ids:", out.ids.join(", "))
  console.log("\n" + "status".padStart(10), "ms".padStart(8), "bytes".padStart(9), " endpoint")
  for (const row of out.results) {
    console.log(String(row.status).padStart(10), String(row.ms).padStart(8), String(row.bytes).padStart(9), ` ${row.label} ${row.path}`)
  }
}
socket.close()
