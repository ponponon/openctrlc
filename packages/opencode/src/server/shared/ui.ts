import { FSUtil } from "@openctrlc/core/fs-util"
import { Effect, Stream } from "effect"
import { HttpBody, HttpClient, HttpClientRequest, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { createHash } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ProxyUtil } from "../proxy-util"

let embeddedUIPromise: Promise<Record<string, string> | null> | undefined

export const UI_UPSTREAM = new URL("https://app.opencode.ai")

// File-import URLs emitted by Bun are bundle-relative (./index-*.html). Resolve
// them against this module's location so cwd (homedir on macOS desktop) cannot
// break embedded UI reads.
const bundleDir = path.dirname(fileURLToPath(import.meta.url))

function resolveEmbeddedFileCandidates(file: string) {
  if (!file.startsWith("./") && !file.startsWith("../")) return [file]
  const name = file.replace(/^\.\//, "")
  return [path.join(bundleDir, name), path.join(bundleDir, "chunks", name), path.join(bundleDir, "..", "chunks", name)]
}

export const csp = (hash = "") =>
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${hash ? ` 'sha256-${hash}'` : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; media-src 'self' data:; connect-src * data: blob:`
export const DEFAULT_CSP = csp()

export function themePreloadHash(body: string) {
  return body.match(/<script\b(?![^>]*\bsrc\s*=)[^>]*\bid=(['"])oc-theme-preload-script\1[^>]*>([\s\S]*?)<\/script>/i)
}

export function cspForHtml(body: string) {
  const match = themePreloadHash(body)
  return csp(match ? createHash("sha256").update(match[2]).digest("base64") : "")
}

function requestBody(request: HttpServerRequest.HttpServerRequest) {
  if (request.method === "GET" || request.method === "HEAD") return HttpBody.empty
  const len = request.headers["content-length"]
  return HttpBody.stream(request.stream, request.headers["content-type"], len === undefined ? undefined : Number(len))
}

function proxyResponseHeaders(headers: Record<string, string>) {
  const result = new Headers(headers)
  // FetchHttpClient exposes decoded response bodies, so forwarding upstream
  // transfer metadata makes browsers decode already-decoded assets again.
  result.delete("content-encoding")
  result.delete("content-length")
  result.delete("transfer-encoding")
  return result
}

export function upstreamURL(path: string) {
  return new URL(path, UI_UPSTREAM).toString()
}

export function embeddedUI(disableEmbeddedWebUi: boolean) {
  if (disableEmbeddedWebUi) return Promise.resolve(null)
  return (embeddedUIPromise ??=
    // @ts-expect-error - generated file at build time
    import("openctrlc-web-ui.gen.ts").then((module) => module.default as Record<string, string>).catch(() => null))
}

function notFound() {
  return HttpServerResponse.jsonUnsafe({ error: "Not Found" }, { status: 404 })
}

function missingEmbeddedIndex() {
  return HttpServerResponse.text(
    `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpenCtrlC Web UI 不可用</title><body style="font:16px system-ui;padding:40px;max-width:40rem;margin:10vh auto"><h1>OpenCtrlC Web UI 资源不完整</h1><p>桌面端没有正确嵌入首页资源。请完全退出并重新启动 OpenCtrlC；开发版请从仓库运行 <code>bun run dev:desktop</code>。如果问题仍然存在，请检查桌面端构建日志。</p></body></html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-openctrlc-ui": "missing-index",
        "cache-control": "no-store",
      },
    },
  )
}

function embeddedUIResponse(file: string, body: Uint8Array) {
  const mime = FSUtil.mimeType(file)
  const headers = new Headers({ "content-type": mime, "x-openctrlc-ui": "embedded" })
  if (mime.startsWith("text/html")) {
    headers.set("content-security-policy", cspForHtml(new TextDecoder().decode(body)))
  }
  return HttpServerResponse.raw(body, { headers })
}

// Stale tabs from before an embedded-UI rebuild keep requesting old content-hashed
// asset URLs. Answering those with index.html would hand HTML to the CSS/JS parser
// and leave the page in a half-old, half-new state; they must fail loudly instead.
function isStaticAssetPath(pathname: string) {
  return pathname.startsWith("assets/") || /\.[a-z0-9]+$/i.test(pathname)
}

export function serveEmbeddedUIEffect(
  requestPath: string,
  fs: FSUtil.Interface,
  embeddedWebUI: Record<string, string>,
) {
  const pathname = requestPath.replace(/^\//, "")
  const mappedAsset = embeddedWebUI[pathname]
  const navigation = mappedAsset === undefined && !isStaticAssetPath(pathname)
  const mapped = mappedAsset ?? (navigation ? embeddedWebUI["index.html"] : undefined) ?? null
  const miss = () => (navigation || pathname === "index.html" ? missingEmbeddedIndex() : notFound())
  if (!mapped) return Effect.succeed(miss())
  const candidates = resolveEmbeddedFileCandidates(mapped)
  return readFirstEmbedded(fs, candidates).pipe(Effect.map((hit) => (hit ? embeddedUIResponse(hit.file, hit.body) : miss())))
}

function readFirstEmbedded(
  fs: FSUtil.Interface,
  candidates: string[],
  index = 0,
): Effect.Effect<{ file: string; body: Uint8Array } | undefined> {
  if (index >= candidates.length) return Effect.succeed(undefined)
  const file = candidates[index]!
  return fs.readFile(file).pipe(
    Effect.map((body) => ({ file, body })),
    Effect.catchCause(() => readFirstEmbedded(fs, candidates, index + 1)),
  )
}

export function serveUIEffect(
  request: HttpServerRequest.HttpServerRequest,
  services: { fs: FSUtil.Interface; client: HttpClient.HttpClient; disableEmbeddedWebUi: boolean },
) {
  return Effect.gen(function* () {
    const embeddedWebUI = yield* Effect.promise(() => embeddedUI(services.disableEmbeddedWebUi))
    const path = new URL(request.url, "http://localhost").pathname

    if (embeddedWebUI) return yield* serveEmbeddedUIEffect(path, services.fs, embeddedWebUI)

    // Optional upstream proxy is only for explicit debugging. The default is a
    // loud error so remote browsers never load the stock OpenCode shell and
    // silently fail to restore OpenCtrlC workspaces.
    if (process.env.OPENCTRLC_UI_ALLOW_UPSTREAM === "1") {
      console.warn(`[ui] embedded web UI unavailable; proxying ${path} to ${UI_UPSTREAM.host}`)
      const response = yield* services.client.execute(
        HttpClientRequest.make(request.method)(upstreamURL(path), {
          headers: ProxyUtil.headers(request.headers, { host: UI_UPSTREAM.host }),
          body: requestBody(request),
        }),
      )
      const headers = proxyResponseHeaders(response.headers)
      headers.set("x-openctrlc-ui", "upstream")

      if (response.headers["content-type"]?.includes("text/html")) {
        const body = yield* response.text
        headers.set("Content-Security-Policy", cspForHtml(body))
        return HttpServerResponse.text(body, { status: response.status, headers })
      }

      headers.set("Content-Security-Policy", csp())
      return HttpServerResponse.stream(response.stream.pipe(Stream.catchCause(() => Stream.empty)), {
        status: response.status,
        headers,
      })
    }

    console.error(`[ui] embedded OpenCtrlC web UI unavailable for ${path}`)
    const body = `<!doctype html><html><meta charset="utf-8"><title>OpenCtrlC</title><body style="font:16px system-ui;padding:40px;max-width:40rem;margin:10vh auto"><h1>OpenCtrlC Web UI 未构建</h1><p>本地服务没有打包 OpenCtrlC 前端，远程页面会因此空白。请在 <code>packages/opencode</code> 运行 <code>bun script/build-node.ts</code>（桌面 <code>predev</code>/<code>prebuild</code> 会自动做），然后重启桌面端。</p></body></html>`
    return HttpServerResponse.text(body, {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-openctrlc-ui": "missing",
      },
    })
  })
}
