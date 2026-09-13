const r2ManifestUrl = "https://openctrlc-releases.quniv.cn/openctrlc/releases/download-manifest.json"
const r2PublicBaseUrl = "https://openctrlc-releases.quniv.cn/openctrlc/releases"

export function resolveR2AssetUrl(manifest: unknown, assetName: string) {
  if (!isRecord(manifest) || !Array.isArray(manifest.releases)) return

  const release = manifest.releases.find(
    (item) => isRecord(item) && typeof item.tag === "string" && /^v\d+\.\d+\.\d+$/.test(item.tag),
  )
  if (!isRecord(release) || !isRecord(release.assets)) return

  const asset = release.assets[assetName]
  if (!isRecord(asset) || typeof asset.url !== "string" || !URL.canParse(asset.url)) return

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

export async function getR2AssetUrl(assetName: string) {
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
