// Inspect live sync/timeline state inside the renderer to find what keeps the
// session skeleton mounted, and test the /global/event stream.
//
// Usage: node perf/diagnose-sync.mjs

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
  if (result.exceptionDetails) return { __exception: result.exceptionDetails.exception?.className ?? "Error" }
  return result.result.value
}

// 1. Does the SSE stream deliver anything at all?
const sse = await evaluate(`(async () => {
  const init = await window.api.awaitInitialization();
  const auth = "Basic " + btoa((init.username ?? "") + ":" + (init.password ?? ""));
  const controller = new AbortController();
  const started = performance.now();
  let firstChunkMs = null;
  let chunks = 0;
  let total = 0;
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(init.url + "/global/event", { headers: { Authorization: auth }, signal: controller.signal });
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstChunkMs === null) firstChunkMs = Math.round(performance.now() - started);
      chunks++;
      total += value?.length ?? 0;
      if (chunks >= 5) break;
    }
  } catch (error) {
    return { aborted: true, firstChunkMs, chunks, total, errorType: error?.name ?? "Error", ms: Math.round(performance.now() - started) };
  } finally { clearTimeout(timer) }
  return { firstChunkMs, chunks, total, ms: Math.round(performance.now() - started) };
})()`)
console.log("=== /global/event stream ===")
console.log(JSON.stringify(sse))

// 2. What does a raw message fetch return for the active session?
const msg = await evaluate(`(async () => {
  const init = await window.api.awaitInitialization();
  const auth = "Basic " + btoa((init.username ?? "") + ":" + (init.password ?? ""));
  const routeParts = new URL(location.href).pathname.split('/').filter(Boolean);
  const id = routeParts.length >= 2 && routeParts.at(-2) === 'session' ? routeParts.at(-1) : '';
  if (!id) return { status: "no-active-session" };
  const started = performance.now();
  const response = await fetch(init.url + "/session/" + id + "/message?limit=20", { headers: { Authorization: auth } });
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text) } catch {}
  return {
    status: response.status,
    ms: Math.round(performance.now() - started),
    bytes: text.length,
    isArray: Array.isArray(parsed),
    count: Array.isArray(parsed) ? parsed.length : null,
    itemTypes: Array.isArray(parsed) ? [...new Set(parsed.map((item) => item?.info?.role ?? item?.type ?? "unknown"))] : []
  };
})()`)
console.log("\n=== raw message fetch (active session) ===")
console.log(JSON.stringify(msg, null, 2))

// 3. Which URL is the active window actually on, and what does the DOM contain?
const dom = await evaluate(`(() => {
  const pulses = [...document.querySelectorAll(".animate-pulse")];
  const skeletonText = pulses.length ? (pulses[0].closest("div[role=status]")?.innerText ?? "(no role=status parent)") : "(none)";
  return {
    route: location.pathname.replace(/\\/session\\/[^/]+/, "/session/:redacted"),
    pulseCount: pulses.length,
    hasSkeletonStatusText: skeletonText !== "(none)" && skeletonText !== "(no role=status parent)",
    hasTimeline: !!document.querySelector('[data-component="message-timeline"]'),
    rootHtmlLength: (document.querySelector("#root")?.innerHTML ?? "").length
  };
})()`)
console.log("\n=== DOM ===")
console.log(JSON.stringify(dom, null, 2))

socket.close()
