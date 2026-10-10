const maxRelayURLLength = 2_048

/**
 * Accept what people actually paste — a bare host, an https origin, or a full
 * ws(s) endpoint — and return the relay WebSocket URL the desktop connects to.
 * Returns undefined when the input cannot be a relay address.
 */
export function parseRelayURLInput(value: unknown) {
  if (typeof value !== "string") return
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxRelayURLLength) return
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return
  }
  if (url.username || url.password || !url.hostname) return
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) return
  const secure = url.protocol === "https:" || url.protocol === "wss:"
  // A pasted pairing link (/join/<id>#token) points at the same Relay as its origin.
  const path = url.pathname === "/" || url.pathname.startsWith("/join/") ? "/v1/host" : url.pathname
  return `${secure ? "wss" : "ws"}://${url.host}${path}`
}
