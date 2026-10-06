// End-to-end desktop start timing: from launching dev:desktop to the moment the
// restored session transcript is actually painted in the renderer.
//
// Usage: run from the repository root: node perf/measure-desktop-boot.mjs [--keep]
// Requires no other dev instance running (single-instance lock) and CDP on 9222.

import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { safeUrl } from "./safe-output.mjs"

const REPO = process.cwd()
const CDP = "http://127.0.0.1:9222"
const results = []
const keep = process.argv.includes("--keep")
let child
const stopChild = () => {
  if (!child?.pid) return
  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM")
  } catch {
    if (process.platform === "win32") child.kill("SIGTERM")
  }
}
const portFree = (port) =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") return resolve(false)
      reject(error)
    })
    server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolve(true)))
  })
const record = (label, ms, extra = {}) => {
  results.push({ label, ms, ...extra })
  console.log(`${String(ms).padStart(7)}ms  ${label}${Object.keys(extra).length ? "  " + JSON.stringify(extra) : ""}`)
}

const probe = `
globalThis.__probe = { t0: performance.now(), marks: [], nav: null };
const snap = (name) => globalThis.__probe.marks.push({ name, at: Math.round(performance.now()) });
addEventListener("DOMContentLoaded", () => snap("domContentLoaded"), { once: true });
addEventListener("load", () => snap("load"), { once: true });
const origFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  if (/\\/session/.test(url)) {
    const at = Math.round(performance.now());
    if (globalThis.__probe.firstSessionRequest === undefined) globalThis.__probe.firstSessionRequest = at;
  }
  return origFetch.apply(this, arguments);
};
const composerReady = () => {
  const el = document.querySelector('[data-component="composer"], textarea[data-composer], [data-composer]');
  if (el) { globalThis.__probe.composerMs = Math.round(performance.now()); return true }
  return false;
};
const transcriptReady = () => {
  const el = document.querySelector('[data-component="message-timeline"], [data-timeline]');
  if (el) { globalThis.__probe.transcriptMs = Math.round(performance.now()); return true }
  return false;
};
const check = () => {
  const a = composerReady(), b = transcriptReady();
  if (a && b) { globalThis.__probe.observer?.disconnect(); return true }
  return false;
};
addEventListener("DOMContentLoaded", () => {
  if (check()) return;
  globalThis.__probe.observer = new MutationObserver(() => check());
  globalThis.__probe.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
});
`

const connect = async (url) => {
  const socket = new WebSocket(url)
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
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const next = ++id
        pending.set(next, { resolve, reject })
        socket.send(JSON.stringify({ id: next, method, params }))
        setTimeout(() => pending.delete(next) && reject(new Error(`timeout ${method}`)), 60000)
      }),
    close: () => socket.close(),
  }
}

const evaluate = async (client, expression) => {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed")
  return result.result.value
}

const main = async () => {
  // Refuse to start if an instance is already up; the single-instance lock would
  // just focus the existing window and make the measurement meaningless.
  if (!(await portFree(9222)) || !(await portFree(5173))) {
    console.log("CDP/Vite 开发端口已被占用。为保护现有桌面进程，本次测量已停止；不会连接、刷新或结束现有进程。")
    process.exitCode = 2
    return
  }

  const started = Date.now()
  child = spawn("bun", ["run", "dev:desktop"], {
    cwd: REPO,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  })
  const onLog = (chunk) => {
    const text = chunk.toString()
    for (const [pattern, label] of [
      [/app ready/, "main: app ready"],
      [/restoring windows/, "main: restoring windows"],
      [/server ready/, "main: server ready"],
      [/startup sequence complete/, "main: startup sequence complete"],
    ]) {
      if (pattern.test(text) && !results.some((row) => row.label === label)) record(label, Date.now() - started)
    }
  }
  child.stdout.on("data", onLog)
  child.stderr.on("data", onLog)

  // Wait for the renderer CDP target to appear.
  let page = null
  for (let i = 0; i < 600; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const list = await fetch(`${CDP}/json/list`)
      .then((r) => r.json())
      .catch(() => null)
    page = list?.find((item) => item.type === "page")
    if (page) break
  }
  if (!page) {
    console.log("renderer never appeared")
    stopChild()
    process.exit(1)
  }
  record("renderer target available", Date.now() - started)

  const client = await connect(page.webSocketDebuggerUrl)
  await client.send("Page.enable")
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: probe })
  // The app is already loading; re-run the probe now so it applies immediately.
  await evaluate(client, probe)

  let snapshot = null
  for (let i = 0; i < 480; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    snapshot = await evaluate(
      client,
      `(() => ({
        composer: globalThis.__probe?.composerMs ?? null,
        transcript: globalThis.__probe?.transcriptMs ?? null,
        firstSessionRequest: globalThis.__probe?.firstSessionRequest ?? null,
        marks: globalThis.__probe?.marks ?? [],
        route: location.origin + location.pathname.replace(/\/session\/[^/]+/, "/session/:redacted"),
        bodyLength: (document.body?.innerText || "").length
      }))()`,
    ).catch(() => null)
    if (snapshot?.transcript !== null && snapshot?.transcript !== undefined) break
  }

  const nav = await evaluate(
    client,
    `(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? {
      domContentLoaded: Math.round(n.domContentLoadedEventEnd),
      load: Math.round(n.loadEventEnd),
      responseEnd: Math.round(n.responseEnd)
    } : null })()`,
  ).catch(() => null)

  if (snapshot?.route) snapshot.route = safeUrl(snapshot.route)
  record("renderer transcript painted", Date.now() - started, { probeMs: snapshot?.transcript ?? null })
  record("renderer composer ready", Date.now() - started, { probeMs: snapshot?.composer ?? null })
  console.log("\nrenderer-relative marks:", JSON.stringify(snapshot?.marks ?? []))
  console.log("navigation timing:", JSON.stringify(nav))
  console.log("first session request (probe ms):", snapshot?.firstSessionRequest)
  console.log("final route:", snapshot?.route)
  console.log("body length:", snapshot?.bodyLength)

  writeFileSync("/tmp/boot-measure.json", JSON.stringify({ results, nav, snapshot }, null, 2))
  console.log("\nwrote /tmp/boot-measure.json")

  if (!keep) stopChild()
}

process.once("SIGINT", () => {
  stopChild()
  process.exit(130)
})
if (!keep) process.on("exit", stopChild)

await main()
