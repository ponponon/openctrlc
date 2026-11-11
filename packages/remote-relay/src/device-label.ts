// iOS browsers all use WebKit and end their UA with "Safari/...", but Chrome,
// Firefox and Edge ship their own CriOS/FxiOS/EdgiOS tokens. Check those first,
// otherwise every iOS browser is reported as Safari.
export function deviceLabel(value: string | null) {
  const agent = value ?? ""
  const device = /iPhone/i.test(agent)
    ? "iPhone"
    : /iPad/i.test(agent)
      ? "iPad"
      : /Android/i.test(agent)
        ? "Android"
        : /Macintosh|Mac OS/i.test(agent)
          ? "Mac"
          : /Windows/i.test(agent)
            ? "Windows"
            : /Linux/i.test(agent)
              ? "Linux"
              : "Device"
  const browser = /Edg\/|EdgiOS\//i.test(agent)
    ? "Edge"
    : /Firefox\/|FxiOS\//i.test(agent)
      ? "Firefox"
      : /Chrome\/|CriOS\//i.test(agent)
        ? "Chrome"
        : /Safari\//i.test(agent)
          ? "Safari"
          : "Browser"
  return `${device} · ${browser}`
}
