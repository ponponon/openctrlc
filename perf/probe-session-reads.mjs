// Measure session detail and message endpoints for the session currently open
// in the renderer. Never scans or prints stored URLs, IDs, credentials, or body
// text. Use a dev renderer with CDP bound to loopback on port 9222.
//
// Usage: node perf/probe-session-reads.mjs

const CDP = "http://127.0.0.1:9222"
const list = await fetch(`${CDP}/json/list`).then((response) => response.json())
const page = list.find((item) => item.type === "page")
if (!page) throw new Error("no page target")

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", () => reject(new Error("CDP connection failed")), { once: true })
})
let id = 0
const pending = new Map()
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  const entry = pending.get(message.id)
  if (!entry) return
  pending.delete(message.id)
  clearTimeout(entry.timer)
  message.error ? entry.reject(new Error("CDP command failed")) : entry.resolve(message.result)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const next = ++id
    const timer = setTimeout(() => {
      if (!pending.delete(next)) return
      reject(new Error("CDP command timed out"))
    }, 55_000)
    pending.set(next, { resolve, reject, timer })
    socket.send(JSON.stringify({ id: next, method, params }))
  })

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error("renderer evaluation failed")
  return result.result.value
}

try {
  const output = await evaluate(`(async () => {
  const route = location.pathname.split("/").filter(Boolean);
  const sessionIndex = route.lastIndexOf("session");
  const sessionID = sessionIndex >= 0 ? route[sessionIndex + 1] : undefined;
  if (!sessionID) return { selected: false, rows: [] };

  const init = await window.api.awaitInitialization();
  const headers = { Authorization: "Basic " + btoa((init.username ?? "") + ":" + (init.password ?? "")) };
  const encodedSessionID = encodeURIComponent(sessionID);
  const paths = [
    ["v2 session detail", "/api/session/" + encodedSessionID],
    ["legacy session detail", "/session/" + encodedSessionID],
    ["v2 first message page", "/api/session/" + encodedSessionID + "/message?limit=20"],
    ["legacy first message page", "/session/" + encodedSessionID + "/message?limit=20"],
  ];
  const rows = [];
  for (const [label, path] of paths) {
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let status = "network-error", bytes = 0, truncated = false;
    try {
      const response = await fetch(init.url + path, { headers, signal: controller.signal });
      status = response.status;
      const reader = response.body?.getReader();
      while (reader) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value?.byteLength ?? 0;
        if (bytes >= 4 * 1024 * 1024) {
          truncated = true;
          await reader.cancel();
          break;
        }
      }
    } catch (error) {
      status = error?.name === "AbortError" || error?.name === "TimeoutError" ? "timeout" : "network-error";
    } finally {
      clearTimeout(timeout);
    }
    rows.push({ label, status, ms: Math.round(performance.now() - started), bytes, truncated });
  }
  return { selected: true, rows };
})()`)

  console.log(
    output.selected ? "selected session: yes (identifier hidden)" : "selected session: no; open a session first",
  )
  if (output.rows.length) {
    console.log("\nstatus       ms     bytes  probe")
    for (const row of output.rows) {
      console.log(
        `${String(row.status).padStart(9)} ${String(row.ms).padStart(7)} ${String(row.bytes).padStart(9)}  ${row.label}${row.truncated ? " (capped at 4 MiB)" : ""}`,
      )
    }
  }
} finally {
  for (const entry of pending.values()) clearTimeout(entry.timer)
  pending.clear()
  socket.close()
}
