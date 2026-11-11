// A browser tab navigating to a deep link must always receive HTML. Returning a
// plain-text 401 there makes iOS browsers (WKWebView) treat the response as a
// download instead of a page, leaving a blank screen with no recovery hint.
export function isDocumentNavigation(request: Request) {
  const destination = request.headers.get("sec-fetch-dest")
  if (destination !== null) return destination === "document"
  return (request.headers.get("accept") ?? "").includes("text/html")
}
