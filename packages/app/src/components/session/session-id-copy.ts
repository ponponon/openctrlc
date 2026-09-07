export function copyText(text: string | undefined, clipboard?: Pick<Clipboard, "writeText">) {
  if (!text) return Promise.resolve(false)

  const fallback = () => {
    const body = typeof document === "undefined" ? undefined : document.body
    if (body && typeof document.execCommand === "function") {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.setAttribute("readonly", "")
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      textarea.style.pointerEvents = "none"
      body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand("copy")
      body.removeChild(textarea)
      if (copied) return Promise.resolve(true)
    }

    return navigator.clipboard.writeText(text).then(() => true)
  }

  if (!clipboard) return fallback()
  return clipboard.writeText(text).then(
    () => true,
    () => fallback(),
  )
}

export function copySessionID(sessionID: string | undefined, clipboard?: Pick<Clipboard, "writeText">) {
  return copyText(sessionID, clipboard)
}
