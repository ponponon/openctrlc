export function remoteAcceptEncoding(
  headers: Headers,
  path: "relay" | "peer",
  relaySupportsGzipResponseUpload: boolean,
) {
  if (path === "peer") return headers.get("x-openctrlc-remote-accept-encoding")
  if (!relaySupportsGzipResponseUpload) return null
  return headers.get("accept-encoding")
}

export function shouldCompressRemoteResponse(acceptEncoding: string | null, contentType: string, hasBody: boolean) {
  if (!hasBody) return false
  const acceptedEncodings = new Map(
    (acceptEncoding ?? "").toLowerCase().split(",").map((item) => {
      const [encoding, ...parameters] = item.trim().split(";")
      const quality = parameters.find((parameter) => parameter.trim().startsWith("q="))
      return [encoding, quality === undefined ? 1 : Number(quality.trim().slice(2))] as const
    }),
  )
  const gzipQuality = acceptedEncodings.get("gzip") ?? acceptedEncodings.get("*") ?? 0
  if (!Number.isFinite(gzipQuality) || gzipQuality <= 0 || gzipQuality > 1) return false
  const normalizedContentType = contentType.toLowerCase()
  if (normalizedContentType.includes("text/event-stream")) return false
  return /^(text\/|application\/(json|javascript|xml|jsonml|xhtml|x-ndjson))/.test(normalizedContentType)
}
