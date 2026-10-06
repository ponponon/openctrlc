// Measure the exact session-list request the app fires on restore:
// /session?directory=<dir>&roots=true&limit=55, isolated and concurrent.
//
// Usage: node perf/probe-session-list.mjs [directory ...]

const CDP = "http://127.0.0.1:9222"
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : [process.cwd()]

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
    setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 300000)
  })

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed")
  return result.result.value
}

const output = await evaluate(`(async () => {
  const init = await window.api.awaitInitialization();
  const auth = "Basic " + btoa((init.username ?? "") + ":" + (init.password ?? ""));
  const base = init.url;
  const dirs = ${JSON.stringify(dirs)};
  const url = (d) => base + "/session?directory=" + encodeURIComponent(d) + "&roots=true&limit=55";
  const rows = [];

  // Isolated: one at a time.
  for (const [index, d] of dirs.entries()) {
    const started = performance.now();
    let status = 0, bytes = 0, ids = 0;
    try {
      const response = await fetch(url(d), { headers: { Authorization: auth } });
      status = response.status;
      const body = await response.text();
      bytes = body.length;
      try { ids = JSON.parse(body).length } catch {}
    } catch (error) { status = error?.name ?? "Error" }
    rows.push({ dir: index + 1, ms: Math.round(performance.now() - started), status, bytes, ids, mode: "serial" });
  }

  // Concurrent: exactly what restore does.
  const started = performance.now();
  await Promise.all(dirs.map(async (d, index) => {
    const each = performance.now();
    const response = await fetch(url(d), { headers: { Authorization: auth } });
    const body = await response.text();
    rows.push({ dir: index + 1, ms: Math.round(performance.now() - each), status: response.status, bytes: body.length, ids: (() => { try { return JSON.parse(body).length } catch { return 0 } })(), mode: "concurrent" });
  }));
  const concurrentTotal = Math.round(performance.now() - started);

  return { rows, concurrentTotal };
})()`)

console.log("directory count:", dirs.length, "(paths omitted)")
console.log("\n-- serial (one at a time) --")
console.log(`${"ms".padStart(7)} ${"status".padStart(9)} ${"bytes".padStart(9)} ${"rows".padStart(5)}  directory`)
for (const row of output.rows.filter((r) => r.mode === "serial")) {
  console.log(
    `${String(row.ms).padStart(7)} ${String(row.status).padStart(9)} ${String(row.bytes).padStart(9)} ${String(row.ids).padStart(5)}  #${row.dir}`,
  )
}
console.log(`\n-- concurrent (${dirs.length} at once, like restore) --`)
console.log(`${"ms".padStart(7)} ${"status".padStart(9)} ${"bytes".padStart(9)} ${"rows".padStart(5)}  directory`)
for (const row of output.rows.filter((r) => r.mode === "concurrent").sort((a, b) => b.ms - a.ms)) {
  console.log(
    `${String(row.ms).padStart(7)} ${String(row.status).padStart(9)} ${String(row.bytes).padStart(9)} ${String(row.ids).padStart(5)}  #${row.dir}`,
  )
}
console.log("\nconcurrent wall total:", output.concurrentTotal, "ms")

socket.close()
