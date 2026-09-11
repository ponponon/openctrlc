import type { APIEvent } from "@solidjs/start"
import type { DownloadPlatform } from "../types"

export const releaseTag = (channel: "stable" | "beta") => (channel === "stable" ? "latest" : "beta")
export const releaseUrl = (channel: "stable" | "beta", assetName: string) =>
  channel === "stable"
    ? `https://github.com/ponponon/openctrlc/releases/latest/download/${assetName}`
    : `https://github.com/ponponon/openctrlc/releases/download/${releaseTag(channel)}/${assetName}`

const prodAssetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "openctrlc-mac-arm64.dmg",
  "darwin-x64-dmg": "openctrlc-mac-x64.dmg",
  "windows-x64-nsis": "openctrlc-win-x64.exe",
  "windows-arm64-nsis": "openctrlc-win-arm64.exe",
  "linux-x64-deb": "openctrlc-linux-x64.deb",
  "linux-x64-appimage": "openctrlc-linux-x64.AppImage",
  "linux-x64-rpm": "openctrlc-linux-x64.rpm",
  "linux-arm64-deb": "openctrlc-linux-arm64.deb",
  "linux-arm64-appimage": "openctrlc-linux-arm64.AppImage",
  "linux-arm64-rpm": "openctrlc-linux-arm64.rpm",
} satisfies Record<DownloadPlatform, string>

const betaAssetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "openctrlc-mac-arm64.dmg",
  "darwin-x64-dmg": "openctrlc-mac-x64.dmg",
  "windows-x64-nsis": "openctrlc-win-x64.exe",
  "windows-arm64-nsis": "openctrlc-win-arm64.exe",
  "linux-x64-deb": "openctrlc-linux-x64.deb",
  "linux-x64-appimage": "openctrlc-linux-x64.AppImage",
  "linux-x64-rpm": "openctrlc-linux-x64.rpm",
  "linux-arm64-deb": "openctrlc-linux-arm64.deb",
  "linux-arm64-appimage": "openctrlc-linux-arm64.AppImage",
  "linux-arm64-rpm": "openctrlc-linux-arm64.rpm",
} satisfies Record<DownloadPlatform, string>

export async function GET({ params: { platform, channel } }: APIEvent) {
  const assetName = channel === "stable" ? prodAssetNames[platform] : betaAssetNames[platform]
  if (!assetName) return new Response(null, { status: 404 })

  const releaseUrl =
    channel === "stable"
      ? `https://github.com/ponponon/openctrlc/releases/latest/download/${assetName}`
      : `https://github.com/ponponon/openctrlc/releases/download/beta/${assetName}`

  return Response.redirect(releaseUrl, 302)
}
