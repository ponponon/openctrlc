const PERCENT = 100

/** Share of the model context window a Session's most recent step filled. */
export function contextUsagePercent(tokens?: number, limit?: number) {
  if (tokens === undefined || tokens <= 0 || limit === undefined || limit <= 0) return undefined
  return Math.round((tokens / limit) * PERCENT)
}
