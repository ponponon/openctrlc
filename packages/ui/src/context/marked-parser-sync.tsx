import { Marked } from "marked"
import { adjacentStrong, markdownOptions } from "./marked-parser-common"

// Use a light parser for the first paint and worker-unavailable fallback. The
// worker's full parser replaces it after parsing, including KaTeX math output.
const syncParser = new Marked(markdownOptions, adjacentStrong)

export function parseMarkdownSyncFallback(text: string) {
  return syncParser.parse(text, { async: false })
}
