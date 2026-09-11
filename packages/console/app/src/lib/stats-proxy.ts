const UNAVAILABLE_MESSAGE = "Usage statistics are not available on this self-managed deployment."

export function statsProxy() {
  return new Response(UNAVAILABLE_MESSAGE, {
    status: 410,
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "text/plain; charset=utf-8",
    },
  })
}

export function statsRedirect() {
  return statsProxy()
}
