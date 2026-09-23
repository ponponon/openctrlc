export type TitlebarTabStatus = "complete" | "error"

export function titlebarTabStatus(unseen: boolean, hasError: boolean): TitlebarTabStatus | undefined {
  if (!unseen) return
  return hasError ? "error" : "complete"
}
