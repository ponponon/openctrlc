const THOUSAND = 1_000
const HUNDRED_THOUSAND = 100_000

/**
 * Compact token count for narrow columns: 950, 636K, 1.5M.
 * Values that would round to a four digit count move up to the next unit.
 */
export function formatTokenCount(tokens: number) {
  if (!Number.isFinite(tokens) || tokens <= 0) return ""
  if (tokens < THOUSAND) return `${Math.round(tokens)}`
  const millions = Math.round(tokens / HUNDRED_THOUSAND) / 10
  if (millions >= 1) return `${millions}M`
  return `${Math.round(tokens / THOUSAND)}K`
}

/**
 * Current context window usage of a Session, from the most recent completed step.
 * Renders the raw count when the model context limit is unknown.
 */
export function formatContextUsage(tokens?: number, limit?: number) {
  if (tokens === undefined || tokens <= 0) return undefined
  const current = formatTokenCount(tokens)
  if (!current) return undefined
  if (limit === undefined || limit <= 0) return current
  return `${current} / ${formatTokenCount(limit)}`
}

export function contextUsagePercent(tokens?: number, limit?: number) {
  if (tokens === undefined || tokens <= 0 || limit === undefined || limit <= 0) return undefined
  return Math.round((tokens / limit) * 100)
}
