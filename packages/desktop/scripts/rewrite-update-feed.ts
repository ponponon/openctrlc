#!/usr/bin/env bun
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse, stringify } from "yaml"

const packageDir = path.dirname(fileURLToPath(import.meta.url))

type FeedEntry = { url?: string; sha512?: string; size?: number }

type ChannelFile = {
  version?: string
  files?: FeedEntry[]
  path?: string
  sha512?: string
  [key: string]: unknown
}

export async function rewriteFeed(distDir: string) {
  const installerHashes = await hashInstallers(distDir)
  const ymlNames = (await Array.fromAsync(new Bun.Glob("latest*.yml").scan(distDir))).sort()
  if (ymlNames.length === 0) throw new Error(`no channel file found in ${distDir}`)

  const rewritten: string[] = []
  const untouched: string[] = []

  for (const name of ymlNames) {
    const file = path.join(distDir, name)
    const channel = parse(await Bun.file(file).text()) as ChannelFile
    const entries = channel.files ?? []
    const first = entries[0]
    if (!first?.url || !first.sha512) throw new Error(`${name}: first entry missing url or sha512`)
    const firstUrl = first.url

    let changed = false
    for (const entry of entries) {
      if (!entry.url || !entry.sha512) throw new Error(`${name}: entry missing url or sha512`)
      const actual = installerHashes.get(entry.sha512)
      if (!actual) throw new Error(`${name}: no file in dist matches sha512 of ${entry.url}`)
      if (entry.url === actual) continue
      console.log(`${name}: ${entry.url} -> ${actual}`)
      entry.url = actual
      changed = true
    }

    if (name.startsWith("latest-linux")) assertLinuxInstallers(name, entries)
    if (changed && channel.path === firstUrl) channel.path = entries[0].url

    if (changed) {
      await Bun.write(file, stringify(channel))
      rewritten.push(name)
      continue
    }
    untouched.push(name)
  }

  return { rewritten, untouched }
}

async function hashInstallers(distDir: string) {
  const hashes = new Map<string, string>()
  const names = (await Array.fromAsync(new Bun.Glob("*").scan(distDir))).sort()
  for (const name of names) {
    if (name.endsWith(".yml")) continue
    const file = path.join(distDir, name)
    if (!(await Bun.file(file).stat())?.isFile()) continue
    const hasher = new Bun.CryptoHasher("sha512")
    for await (const chunk of Bun.file(file).stream()) hasher.update(chunk)
    hashes.set(Buffer.from(hasher.digest()).toString("base64"), name)
  }
  return hashes
}

function assertLinuxInstallers(name: string, entries: FeedEntry[]) {
  const urls = entries.map((entry) => entry.url?.toLowerCase() ?? "")
  for (const ext of ["deb", "appimage", "rpm"]) {
    if (!urls.some((url) => url.endsWith(`.${ext}`))) throw new Error(`${name}: missing .${ext} entry`)
  }
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? path.join(packageDir, "..", "dist")
  const result = await rewriteFeed(distDir)
  console.log(`rewrote: ${result.rewritten.join(", ") || "(none)"}`)
  if (result.untouched.length > 0) console.log(`unchanged: ${result.untouched.join(", ")}`)
}
