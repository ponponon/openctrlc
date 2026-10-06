// Measures desktop renderer session-restore latency over the Chrome DevTools
// Protocol. Dev builds expose CDP on 127.0.0.1:9222 (see desktop main/index.ts).
//
// Usage: node perf/measure-session-load.mjs [--reload]
// Storage values, transcript text, session IDs, and query values are omitted.

import { safeUrl } from "./safe-output.mjs"

const CDP_HOST = "127.0.0.1:9222"
const reload = process.argv.includes("--reload")

async function target() {
  const response = await fetch(`http://${CDP_HOST}/json/list`)
  const list = await response.json()
  const page = list.find((item) => item.type === "page")
  if (!page) throw new Error("no CDP page target found")
  return page
}

class CDP {
  #socket
  #id = 0
  #pending = new Map()

  static async connect(url) {
    const client = new CDP()
    client.#socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      client.#socket.addEventListener("open", resolve, { once: true })
      client.#socket.addEventListener("error", reject, { once: true })
    })
    client.#socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data)
      const entry = client.#pending.get(message.id)
      if (!entry) return
      client.#pending.delete(message.id)
      if (message.error) entry.reject(new Error(message.error.message))
      else entry.resolve(message.result)
    })
    return client
  }

  send(method, params = {}) {
    const id = ++this.#id
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#socket.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (!this.#pending.delete(id)) return
        reject(new Error(`timeout: ${method}`))
      }, 120000)
    })
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed")
    return result.result.value
  }

  close() {
    this.#socket.close()
  }
}

// The probe is injected before any app code runs so we can observe the first
// session-related request and the first live transcript paint after a reload.
const PROBE = `
    globalThis.__probe = { t0: performance.timeOrigin, sessionRequests: [], firstTranscriptMs: null, observer: null };
    const origFetch = globalThis.fetch;
    globalThis.fetch = function (input, init) {
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (/\\/session/.test(url)) {
          globalThis.__probe.sessionRequests.push({ at: performance.now(), url: url.slice(0, 160) });
        }
      } catch {}
      return origFetch.apply(this, arguments);
    };
    const markTranscript = () => {
      if (globalThis.__probe.firstTranscriptMs !== null) return true;
      const el = document.querySelector('[data-component="message-timeline"], [data-timeline], [data-session-transcript]');
      const composer = document.querySelector('[data-component="composer"], textarea[data-composer], [data-composer]');
      const text = document.body ? document.body.innerText || "" : "";
      const hasLive = el !== null || composer !== null || /(Edit|编辑|Ask|发送|New session)/.test(text);
      if (hasLive) {
        globalThis.__probe.firstTranscriptMs = performance.now();
        return true;
      }
      return false;
    };
    document.addEventListener("DOMContentLoaded", () => {
      if (markTranscript()) return;
      globalThis.__probe.observer = new MutationObserver(() => {
        if (markTranscript()) globalThis.__probe.observer.disconnect();
      });
      globalThis.__probe.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
`

const main = async () => {
  const page = await target()
  const client = await CDP.connect(page.webSocketDebuggerUrl)

  const before = await client.evaluate(`(() => ({
    url: location.origin + location.pathname.replace(/\\/session\\/[^/]+/, "/session/:redacted"),
    storageKeys: Object.keys(localStorage),
    nav: (() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null })(),
    bodyLength: (document.body?.innerText || "").length
  }))()`)

  console.log("=== BEFORE ===")
  console.log("url:", before.url)
  console.log("nav:", JSON.stringify(before.nav))
  console.log("localStorage keys:", before.storageKeys)
  for (const key of before.storageKeys) console.log(`  ${key}`)
  console.log("body length:", before.bodyLength)

  if (!reload) {
    client.close()
    return
  }

  await client.send("Page.enable")
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE })
  const started = Date.now()
  await client.send("Page.reload", { ignoreCache: true })

  let result = null
  for (let i = 0; i < 240; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    try {
      result = await client.evaluate(`(() => {
        const p = globalThis.__probe;
        if (!p) return { ready: false };
        return {
          ready: p.firstTranscriptMs !== null,
          firstTranscriptMs: p.firstTranscriptMs,
          currentMs: performance.now(),
          sessionRequests: p.sessionRequests.slice(0, 12).map((item) => ({ at: item.at, url: item.url })),
          sessionRequestCount: p.sessionRequests.length,
          bodyLength: (document.body?.innerText || "").length,
          resources: performance.getEntriesByType("resource")
            .filter((r) => /session-route-view|\\.js(\\?|$)/.test(r.name))
            .map((r) => ({ name: r.name.split("/").pop().split("?")[0], dur: Math.round(r.duration), size: r.transferSize }))
            .sort((a, b) => b.dur - a.dur).slice(0, 8)
        };
      })()`)
    } catch (error) {
      console.log("evaluate error:", error.message)
    }
    if (result?.ready) break
  }

  console.log("\n=== AFTER RELOAD ===")
  console.log("wall clock from reload command:", Date.now() - started, "ms")
  if (!result) {
    console.log("probe missing (page did not finish loading)")
  } else {
    console.log("firstTranscriptMs:", result.firstTranscriptMs === null ? null : Math.round(result.firstTranscriptMs))
    console.log("session request count:", result.sessionRequestCount)
    for (const request of result.sessionRequests) console.log(`  +${Math.round(request.at)}ms ${safeUrl(request.url)}`)
    console.log("slowest resources:")
    for (const resource of result.resources ?? [])
      console.log(`  ${String(resource.dur).padStart(6)}ms ${String(resource.size).padStart(8)}B ${resource.name}`)
    console.log("body length:", result.bodyLength)
  }
  client.close()
}

await main()
