import type { Session } from "@openctrlc/sdk/v2/client"

/** Approximate transcript size from token counts (about 4 UTF-8 bytes per token). */
export function estimateSessionStorageBytes(session: Pick<Session, "tokens">) {
  const t = session.tokens
  if (!t) return undefined
  const tokens = (t.input ?? 0) + (t.output ?? 0) + (t.reasoning ?? 0) + (t.cache?.read ?? 0) + (t.cache?.write ?? 0)
  if (tokens <= 0) return undefined
  return tokens * 4
}

export function formatStorageBytes(bytes: number | undefined) {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
