export function copySessionID(
  sessionID: string | undefined,
  clipboard?: Pick<Clipboard, "writeText">,
) {
  if (!sessionID) return Promise.resolve(false)
  const target = clipboard ?? navigator.clipboard
  return target.writeText(sessionID).then(() => true)
}
