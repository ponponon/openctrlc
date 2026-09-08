import { createHash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { Readable } from "node:stream"
import { finished } from "node:stream/promises"

export const DEFAULT_R2_BUCKET = "openctrlc-releases"
export const DEFAULT_R2_RELEASE_PREFIX = "openctrlc/releases"
export const DEFAULT_R2_PUBLIC_BASE_URL = "https://openctrlc-releases.quniv.cn/openctrlc/releases"
export const DOWNLOAD_MANIFEST_NAME = "download-manifest.json"
export const R2_REST_MAX_UPLOAD_BYTES = 300 * 1000 * 1000

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4"
const GITHUB_API_BASE_URL = "https://api.github.com"
const INSTALLER_EXTENSIONS = [".appimage", ".deb", ".dmg", ".exe", ".flatpak", ".rpm", ".snap", ".zip"]

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "")
}

function normalizeVersion(tag) {
  const version = String(tag ?? "").replace(/^v/, "")
  if (version === "beta") return version
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release tag: ${tag}`)
  }
  return version
}

function encodePath(value) {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function readJsonResponse(response, label) {
  const body = await response.text()
  let payload
  try {
    payload = body ? JSON.parse(body) : undefined
  } catch {
    throw new Error(`${label} returned invalid JSON (${response.status})`)
  }
  if (!response.ok || payload?.success === false) {
    const errors = payload?.errors?.map((item) => item.message).filter(Boolean).join("; ")
    throw new Error(`${label} failed (${response.status}): ${errors || body.slice(0, 300)}`)
  }
  return payload
}

function r2ObjectUrl({ accountId, bucket, key }) {
  return `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodePath(key)}`
}

function r2ListUrl({ accountId, bucket, prefix, cursor }) {
  const params = new URLSearchParams({ prefix, per_page: "1000" })
  if (cursor) params.set("cursor", cursor)
  return `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/objects?${params}`
}

async function fetchRelease({ repository, tag, githubToken }) {
  const response = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    { headers: githubHeaders(githubToken) },
  )
  const payload = await readJsonResponse(response, `GitHub release ${tag}`)
  if (payload.draft || payload.prerelease) throw new Error(`Release ${tag} must be published and non-prerelease`)
  return payload
}

function isInstallerAsset(asset) {
  const name = String(asset?.name ?? "")
  const lowerName = name.toLowerCase()
  return name.startsWith("openctrlc-") && INSTALLER_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

function selectInstallerAssets(release) {
  const assets = (release.assets ?? []).filter(isInstallerAsset)
  if (assets.length === 0) throw new Error(`No OpenCtrlC installer assets found in release ${release.tag_name}`)
  return assets
}

async function downloadAsset(asset, destination, githubToken) {
  const response = await fetch(asset.browser_download_url, {
    headers: githubHeaders(githubToken),
    redirect: "follow",
  })
  if (!response.ok || !response.body) throw new Error(`GitHub asset download failed (${response.status}): ${asset.name}`)

  const output = createWriteStream(destination)
  const hash = createHash("sha256")
  for await (const chunk of Readable.fromWeb(response.body)) {
    hash.update(chunk)
    if (!output.write(chunk)) {
      await new Promise((resolvePromise, reject) => {
        output.once("drain", resolvePromise)
        output.once("error", reject)
      })
    }
  }
  output.end()
  await finished(output)
  return hash.digest("hex")
}

async function uploadR2File({ accountId, bucket, key, filePath, contentType, cacheControl, contentDisposition, token }) {
  const fileStats = await stat(filePath)
  const response = await fetch(r2ObjectUrl({ accountId, bucket, key }), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": cacheControl,
      "Content-Disposition": contentDisposition,
      "Content-Length": String(fileStats.size),
      "Content-Type": contentType,
    },
    body: createReadStream(filePath),
    duplex: "half",
  })
  await readJsonResponse(response, `Cloudflare R2 upload ${key}`)
}

async function uploadR2Json({ accountId, bucket, key, value, cacheControl, token }) {
  const body = JSON.stringify(value, null, 2) + "\n"
  const response = await fetch(r2ObjectUrl({ accountId, bucket, key }), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": cacheControl,
      "Content-Disposition": `inline; filename="${basename(key)}"`,
      "Content-Length": String(Buffer.byteLength(body)),
      "Content-Type": "application/json; charset=utf-8",
    },
    body,
  })
  await readJsonResponse(response, `Cloudflare R2 upload ${key}`)
}

async function listR2Objects({ accountId, bucket, prefix, token }) {
  const objects = []
  let cursor
  do {
    const response = await fetch(r2ListUrl({ accountId, bucket, prefix, cursor }), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = await readJsonResponse(response, `Cloudflare R2 list ${prefix}`)
    objects.push(...(payload.result?.objects ?? []))
    cursor = payload.result_info?.cursor || undefined
  } while (cursor)
  return objects
}

async function deleteR2Object({ accountId, bucket, key, token }) {
  const response = await fetch(r2ObjectUrl({ accountId, bucket, key }), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  await readJsonResponse(response, `Cloudflare R2 delete ${key}`)
}

async function readExistingManifest({ accountId, bucket, key, token }) {
  const response = await fetch(r2ObjectUrl({ accountId, bucket, key }), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`Cloudflare R2 read ${key} failed (${response.status})`)
  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Cloudflare R2 read ${key} returned invalid JSON`)
  }
}

function publicObjectUrl(baseUrl, key, releasePrefix) {
  const relativeKey = key.startsWith(`${releasePrefix}/`) ? key.slice(releasePrefix.length + 1) : key
  return `${trimTrailingSlash(baseUrl)}/${relativeKey.split("/").map(encodeURIComponent).join("/")}`
}

function assetContentType(name) {
  const lowerName = name.toLowerCase()
  if (lowerName.endsWith(".dmg")) return "application/x-apple-diskimage"
  if (lowerName.endsWith(".zip")) return "application/zip"
  if (lowerName.endsWith(".exe")) return "application/vnd.microsoft.portable-executable"
  if (lowerName.endsWith(".deb")) return "application/vnd.debian.binary-package"
  if (lowerName.endsWith(".rpm")) return "application/x-rpm"
  return "application/octet-stream"
}

function parseOptions(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) continue
    if (argument === "--tag") options.tag = value
    if (argument === "--repository") options.repository = value
    if (argument === "--bucket") options.bucket = value
    if (argument === "--release-prefix") options.releasePrefix = value
    if (argument === "--public-base-url") options.publicBaseUrl = value
    if (argument === "--retention") options.retention = Number.parseInt(value, 10)
    index += 1
  }
  return options
}

export async function publishReleaseDownloads(options = {}) {
  const tag = options.tag ?? process.env.RELEASE_TAG
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY
  const accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID
  const token = options.token ?? process.env.CLOUDFLARE_API_TOKEN
  const githubToken = options.githubToken ?? process.env.GITHUB_TOKEN
  const bucket = options.bucket ?? process.env.R2_BUCKET ?? DEFAULT_R2_BUCKET
  const releasePrefix = options.releasePrefix ?? process.env.R2_RELEASE_PREFIX ?? DEFAULT_R2_RELEASE_PREFIX
  const publicBaseUrl = options.publicBaseUrl ?? process.env.R2_PUBLIC_BASE_URL ?? DEFAULT_R2_PUBLIC_BASE_URL
  const retention = options.retention ?? Number.parseInt(process.env.R2_RELEASE_RETENTION ?? "3", 10)

  if (!tag) throw new Error("RELEASE_TAG or --tag is required")
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY or --repository must be owner/name")
  if (!accountId || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required")
  if (!Number.isInteger(retention) || retention < 1) throw new Error("R2 release retention must be a positive integer")

  const release = await fetchRelease({ repository, tag, githubToken })
  const version = normalizeVersion(release.tag_name)
  const assets = selectInstallerAssets(release)
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "openctrlc-releases-"))
  const releaseRoot = `${releasePrefix}/${version}`

  try {
    const publishedAssets = {}
    for (const asset of assets) {
      const assetKey = `${releaseRoot}/${asset.name}`
      const metadata = {
        name: asset.name,
        sizeBytes: asset.size,
        sha256: String(asset.digest ?? "").replace(/^sha256:/, "") || undefined,
        url: publicObjectUrl(publicBaseUrl, assetKey, releasePrefix),
      }

      if (asset.size > R2_REST_MAX_UPLOAD_BYTES) {
        metadata.url = asset.browser_download_url
        console.log(`Using GitHub fallback for oversized asset: ${asset.name}`)
        publishedAssets[asset.name] = metadata
        continue
      }

      const filePath = join(temporaryDirectory, basename(asset.name))
      const sha256 = await downloadAsset(asset, filePath, githubToken)
      if (asset.digest && sha256 !== String(asset.digest).replace(/^sha256:/, "")) {
        throw new Error(`SHA-256 mismatch for ${asset.name}`)
      }
      metadata.sha256 = sha256
      await uploadR2File({
        accountId,
        bucket,
        key: assetKey,
        filePath,
        contentType: assetContentType(asset.name),
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: `attachment; filename="${asset.name.replaceAll('"', "")}"`,
        token,
      })
      publishedAssets[asset.name] = metadata
      console.log(`Published ${release.tag_name}: ${asset.name}`)
    }

    const manifestKey = `${releasePrefix}/${DOWNLOAD_MANIFEST_NAME}`
    const existingManifest = await readExistingManifest({ accountId, bucket, key: manifestKey, token })
    const releases = [
      {
        tag: release.tag_name,
        version,
        githubUrl: release.html_url,
        publishedAt: release.published_at,
        assets: publishedAssets,
      },
      ...(existingManifest?.releases ?? []).filter((item) => item.version !== version),
    ].slice(0, retention)

    const manifest = {
      schemaVersion: 1,
      repository,
      generatedAt: new Date().toISOString(),
      retention,
      releases,
    }
    await uploadR2Json({
      accountId,
      bucket,
      key: manifestKey,
      value: manifest,
      cacheControl: "public, max-age=300, must-revalidate",
      token,
    })

    const keepPrefixes = releases.map((item) => `${releasePrefix}/${item.version}/`)
    const objects = await listR2Objects({ accountId, bucket, prefix: `${releasePrefix}/`, token })
    await Promise.all(
      objects
        .map((object) => object.key)
        .filter((key) => key !== manifestKey && !keepPrefixes.some((prefix) => key.startsWith(prefix)))
        .map((key) => deleteR2Object({ accountId, bucket, key, token })),
    )

    console.log(`Published ${releases.length} release(s) to ${trimTrailingSlash(publicBaseUrl)}`)
    return manifest
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseOptions(process.argv.slice(2))
  publishReleaseDownloads(options).catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
