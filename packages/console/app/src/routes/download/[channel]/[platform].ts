import type { APIEvent } from "@solidjs/start"
import type { DownloadPlatform } from "../types"

export const releaseTag = (channel: "stable" | "beta") => (channel === "stable" ? "latest" : "beta")
export const releaseUrl = (channel: "stable" | "beta", assetName: string) =>
  channel === "stable"
    ? `https://github.com/ponponon/openctrlc/releases/latest/download/${assetName}`
    : `https://github.com/ponponon/openctrlc/releases/download/${releaseTag(channel)}/${assetName}`

const r2ManifestUrl = "https://openctrlc-releases.quniv.cn/openctrlc/releases/download-manifest.json"
const r2PublicBaseUrl = "https://openctrlc-releases.quniv.cn/openctrlc/releases"

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

export function resolveR2AssetUrl(manifest: unknown, assetName: string) {
  if (!isRecord(manifest) || !Array.isArray(manifest.releases)) return

  const release = manifest.releases.find(
    (item) => isRecord(item) && typeof item.tag === "string" && /^v\d+\.\d+\.\d+$/.test(item.tag),
  )
  if (!isRecord(release) || !isRecord(release.assets)) return

  const asset = release.assets[assetName]
  if (!isRecord(asset) || typeof asset.url !== "string") return

  if (!URL.canParse(asset.url)) return
  const publicBase = new URL(r2PublicBaseUrl)
  const url = new URL(asset.url)
  if (
    url.protocol !== "https:" ||
    url.origin !== publicBase.origin ||
    !url.pathname.startsWith(`${publicBase.pathname}/`)
  )
    return

  return url.href
}

async function getR2AssetUrl(assetName: string) {
  return fetch(r2ManifestUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(2500),
  })
    .then(async (response) => {
      if (!response.ok) return
      return resolveR2AssetUrl(await response.json(), assetName)
    })
    .catch(() => undefined)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export async function GET({ params: { platform, channel } }: APIEvent) {
  if (channel !== "stable" && channel !== "beta") return new Response(null, { status: 404 })

  const assetName = channel === "stable" ? prodAssetNames[platform] : betaAssetNames[platform]
  if (!assetName) return new Response(null, { status: 404 })

  const targetUrl =
    channel === "stable"
      ? ((await getR2AssetUrl(assetName)) ?? releaseUrl(channel, assetName))
      : releaseUrl(channel, assetName)

  return Response.redirect(targetUrl, 302)
}
