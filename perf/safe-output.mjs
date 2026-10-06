// Keep local diagnostics useful without exporting identifiers or query values.
export function safeUrl(value) {
  try {
    const url = new URL(value)
    const pathname = url.pathname
      .replace(/\/(session|join|pair)\/[^/]+/gi, "/$1/:redacted")
      .replace(/\/(?:v1\/)?sessions?\/[^/]+/gi, "/session/:redacted")
      .replace(/\/(Users|home)\/[^/]+/gi, "/$1/:user")
    const queryKeys = [...url.searchParams.keys()]
    const query = queryKeys.length ? `?${[...new Set(queryKeys)].map((key) => `${encodeURIComponent(key)}=[redacted]`).join("&")}` : ""
    return `${url.origin}${pathname}${query}`
  } catch {
    return "[unavailable]"
  }
}
