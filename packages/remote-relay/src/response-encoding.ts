export function shouldGzipToViewer(request: Request, responseHeaders: Headers) {
  if (responseHeaders.has("content-encoding")) return false
  const acceptedEncodings = new Map(
    (request.headers.get("accept-encoding") ?? "")
      .toLowerCase()
      .split(",")
      .map((item) => {
        const [encoding, ...parameters] = item.trim().split(";")
        const quality = parameters.find((parameter) => parameter.trim().startsWith("q="))
        return [encoding, quality === undefined ? 1 : Number(quality.trim().slice(2))] as const
      }),
  )
  const gzipQuality = acceptedEncodings.get("gzip") ?? acceptedEncodings.get("*") ?? 0
  if (!Number.isFinite(gzipQuality) || gzipQuality <= 0 || gzipQuality > 1) return false
  const contentType = (responseHeaders.get("content-type") ?? "").toLowerCase()
  if (contentType.includes("text/event-stream")) return false
  return /^(text\/|application\/(json|javascript|xml|jsonml|xhtml|x-ndjson))/.test(contentType)
}

export function sanitizeResponseHeaders(value: Record<string, string>) {
  const headers = new Headers(value)
  for (const name of [
    "connection",
    "content-length",
    "keep-alive",
    "set-cookie",
    "set-cookie2",
    "transfer-encoding",
    "upgrade",
  ])
    headers.delete(name)
  if (headers.get("content-encoding")?.toLowerCase() !== "gzip") headers.delete("content-encoding")
  return headers
}
