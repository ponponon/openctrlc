// Inspect the running renderer: active route, available tabs, and which
// transcript/composer selectors actually exist in the DOM.
//
// Usage: node perf/inspect-renderer.mjs [--screenshot]
// Local storage values, route identifiers, page titles, and page text are omitted.

const CDP = "http://127.0.0.1:9222"

const list = await fetch(`${CDP}/json/list`).then((r) => r.json())
const pages = list.filter((item) => item.type === "page")
const takeScreenshot = process.argv.includes("--screenshot")
console.log("renderer page count:", pages.length)

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

for (const [index, page] of pages.entries()) {
  const client = await connect(page.webSocketDebuggerUrl)
  const info = await evaluate(
    client,
    `(() => ({
      route: location.pathname.replace(/\\/session\\/[^/]+/, "/session/:redacted"),
      bodyLength: (document.body?.innerText || "").length,
      dataComponents: [...new Set([...document.querySelectorAll("[data-component]")].map((e) => e.getAttribute("data-component")))].slice(0, 60),
      textareas: [...document.querySelectorAll("textarea")].map((e) => ({ ph: e.getAttribute("placeholder"), dc: e.getAttribute("data-component") })).slice(0, 10),
      dataAttrs: [...new Set([...document.querySelectorAll("[data-testid],[data-timeline],[data-session],[data-message]")].flatMap((e) => [...e.attributes].map((a) => a.name)))].slice(0, 40),
      localStorageKeyCount: localStorage.length,
      skeletonCount: document.querySelectorAll(".animate-pulse").length,
      bodyLen: (document.body?.innerText || "").length
    }))()`,
  )
  console.log("\n=== page", index + 1, "===")
  console.log(JSON.stringify(info, null, 2))

  const shot = takeScreenshot ? await client.send("Page.captureScreenshot", { format: "png" }).catch(() => null) : null
  if (shot?.data) {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(`/tmp/renderer-page-${index + 1}.png`, Buffer.from(shot.data, "base64"))
    console.log("screenshot saved to /tmp (may contain visible conversation content)")
  }
  client.close()
}
