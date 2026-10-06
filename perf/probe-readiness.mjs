// Lean readiness probe: attaches to the already-running renderer and reports
// fixed, bounded DOM milestones. Much cheaper than the full cold-start harness,
// so it does not meaningfully perturb the load it is measuring.
//
// Usage: node perf/probe-readiness.mjs [seconds]

const CDP = "http://127.0.0.1:9222"
const seconds = Number(process.argv[2] ?? 45)

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
    setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 30000)
  })
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed")
  return result.result.value
}

// One shot: what is the current state?
const state = await evaluate(`(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const route = performance.getEntriesByType("resource").filter((r) => /session-route-view/.test(r.name));
  return {
    href: location.href,
    navDomContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    skeleton: document.querySelectorAll(".animate-pulse").length,
    bodyLen: (document.body?.innerText ?? "").length,
    composer: !!document.querySelector('[data-component="prompt-input"]'),
    routeChunkRequests: route.map((r) => ({ name: r.name.split("/").pop(), end: Math.round(r.responseEnd), dur: Math.round(r.duration), size: r.transferSize })),
    routeChunkCount: route.length,
    resources: performance.getEntriesByType("resource").length
  };
})()`)

console.log("=== renderer state now ===")
console.log(JSON.stringify(state, null, 2))

// Watch the composer/transcript for a bounded window.
console.log(`\n=== watching ${seconds}s for readiness ===`)
const started = Date.now()
let done = null
while (Date.now() - started < seconds * 1000) {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const now = await evaluate(
    `(() => ({ skeleton: document.querySelectorAll(".animate-pulse").length, bodyLen: (document.body?.innerText ?? "").length, composer: !!document.querySelector('[data-component="prompt-input"]') }))()`,
  ).catch(() => null)
  if (!now) continue
  const at = Math.round((Date.now() - started) / 1000)
  if (now.composer) { done = at; console.log(`  t+${at}s composer mounted, bodyLen=${now.bodyLen}`); break }
  if (at % 5 === 0) console.log(`  t+${at}s skeleton=${now.skeleton} bodyLen=${now.bodyLen}`)
}
console.log(done === null ? "\nRESULT: composer never mounted in window" : `\nRESULT: composer mounted at t+${done}s`)
socket.close()
