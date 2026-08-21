import type { DownloadPlatform } from "./types"

export type OS = "macOS" | "Windows" | "Linux" | null
export type Arch = "x64" | "arm64"

export function detectOS(): OS {
  if (typeof navigator === "undefined") return null
  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()

  if (platform.includes("mac") || userAgent.includes("mac")) return "macOS"
  if (platform.includes("win") || userAgent.includes("win")) return "Windows"
  if (platform.includes("linux") || userAgent.includes("linux")) return "Linux"
  return null
}

export function detectArch(): Arch {
  if (typeof navigator === "undefined") return "x64"
  const value = `${navigator.platform} ${navigator.userAgent}`.toLowerCase()
  return value.includes("arm64") || value.includes("aarch64") || value.includes("armv8") ? "arm64" : "x64"
}

export function getDownloadPlatform(os: OS, arch: Arch): DownloadPlatform {
  switch (os) {
    case "macOS":
      return arch === "arm64" ? "darwin-aarch64-dmg" : "darwin-x64-dmg"
    case "Windows":
      return "windows-x64-nsis"
    case "Linux":
      return `linux-${arch}-deb`
    default:
      return "darwin-aarch64-dmg"
  }
}

export function getDownloadHref(platform: DownloadPlatform, channel: "stable" | "beta" = "stable") {
  return `/download/${channel}/${platform}`
}
