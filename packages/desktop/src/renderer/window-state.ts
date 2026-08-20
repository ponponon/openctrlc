export function windowLastActiveUrlKey(windowID: string) {
  return `openctrlc.desktop.window.${windowID}.last-active-url`
}

export function getLastActiveUrl(storage: Storage | undefined, windowID: string) {
  if (!storage) return "/"
  try {
    const value = storage.getItem(windowLastActiveUrlKey(windowID))
    if (value?.startsWith("/") && !value.startsWith("//")) return value
  } catch {}
  return "/"
}

export function setLastActiveUrl(storage: Storage | undefined, windowID: string, value: string) {
  if (!storage) return
  try {
    storage.setItem(windowLastActiveUrlKey(windowID), value)
  } catch {}
}
