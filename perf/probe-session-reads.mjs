// Measure the bounded first-page session reads for the session currently open
// in a dev desktop renderer. Never scans or prints stored URLs, IDs, credentials,
// or response text. Use a dev renderer with CDP bound to loopback on port 9222.
//
// Usage: node perf/probe-session-reads.mjs

const CDP = "http://127.0.0.1:9222"
const list = await fetch(`${CDP}/json/list`).then((response) => response.json())
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
if (!page) throw new Error("no CDP page target")

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
  const api = window.api;
  let pathname = location.pathname;
  if (typeof api?.getWindowID === "function") {
    const windowID = await api.getWindowID();
    const lastActiveURL = localStorage.getItem("openctrlc.desktop.window." + windowID + ".last-active-url");
    if (lastActiveURL?.startsWith("/") && !lastActiveURL.startsWith("//"))
      pathname = new URL(lastActiveURL, location.origin).pathname;
  }
  const route = pathname.split("/").filter(Boolean);
  const sessionIndex = route.lastIndexOf("session");
  const sessionID = sessionIndex >= 0 ? route[sessionIndex + 1] : undefined;
  if (!sessionID || typeof api?.awaitInitialization !== "function") return { selected: false, rows: [] };

  const init = await api.awaitInitialization();
  const headers = { Authorization: "Basic " + btoa((init.username ?? "") + ":" + (init.password ?? "")) };
  const encodedSessionID = encodeURIComponent(sessionID);
  const maxProbeBytes = 512 * 1024;
  const read = async (label, path) => {
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let status = "network-error", bytes = 0, truncated = false;
    try {
      const response = await fetch(new URL(path, init.url), {
        headers,
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      status = response.status;
      if (response.status === 404) {
        await response.body?.cancel().catch(() => {});
      } else {
        const reader = response.body?.getReader();
        while (reader) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value?.byteLength ?? 0;
          if (bytes >= maxProbeBytes) {
            truncated = true;
            await reader.cancel();
            break;
          }
        }
      }
    } catch (error) {
      status = error?.name === "AbortError" || error?.name === "TimeoutError" ? "timeout" : "network-error";
    } finally {
      clearTimeout(timeout);
    }
    return { label, status, ms: Math.round(performance.now() - started), bytes, truncated };
  };

  const detail = await read("V2 session detail", "/api/session/" + encodedSessionID);
  const detailRow = detail.status === 404
    ? await read("V1 session detail (404 fallback)", "/session/" + encodedSessionID)
    : detail;
  const message = await read(
    "V2 first message (limit 1)",
    "/api/session/" + encodedSessionID + "/message?limit=1&order=desc",
  );
  const messageRow = message.status === 404
    ? await read("V1 first message (404 fallback)", "/session/" + encodedSessionID + "/message?limit=1")
    : message;
  return { selected: true, rows: [detailRow, messageRow] };
})()`)

  console.log(
    output.selected ? "selected session: yes (identifier hidden)" : "selected session: no; open a session first",
  )
  if (output.rows.length) {
    console.log("\nstatus       ms  body bytes (decoded)  probe")
    for (const row of output.rows) {
      console.log(
        `${String(row.status).padStart(9)} ${String(row.ms).padStart(7)} ${String(row.bytes).padStart(20)}  ${row.label}${row.truncated ? " (stopped at 512 KiB)" : ""}`,
      )
    }
  }
} finally {
  for (const entry of pending.values()) clearTimeout(entry.timer)
  pending.clear()
  socket.close()
}
