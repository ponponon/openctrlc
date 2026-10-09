#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"
import {
  LegacyProductPackageName,
  npmPublishTag,
  ProductPackageName,
} from "../packages/opencode/script/package-contract"

process.chdir(fileURLToPath(new URL("..", import.meta.url)))

async function main() {
  const version = process.argv[2] ?? Bun.env.OPENCTRLC_VERSION
  if (!version) throw new Error("Pass a version or set OPENCTRLC_VERSION.")

  const channel = process.argv[3] ?? Bun.env.OPENCTRLC_CHANNEL ?? "prod"
  const tag = npmPublishTag(channel)
  const platformPackageNames = [
    ...new Bun.Glob(`packages/opencode/dist/${ProductPackageName}-*/package.json`).scanSync(),
  ]
    .map((manifest) => path.basename(path.dirname(manifest)))
    .filter((name) => name !== LegacyProductPackageName)

  if (platformPackageNames.length !== 12) {
    throw new Error(
      `Expected 12 platform package manifests in packages/opencode/dist; found ${platformPackageNames.length}.`,
    )
  }

  const packageNames = [ProductPackageName, LegacyProductPackageName, ...platformPackageNames]
  const taggedPackages = [ProductPackageName, LegacyProductPackageName]
  const retryDelays = [
    5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 30_000, 30_000, 30_000, 30_000, 30_000,
  ]
  const attempts = retryDelays.length + 1

  for (const attempt of Array.from({ length: attempts }, (_, index) => index + 1)) {
    const versions = await Promise.all(
      packageNames.map(async (name) => ({
        name,
        actual: await npmView(`${name}@${version}`, "version"),
      })),
    )
    const tags = await Promise.all(
      taggedPackages.map(async (name) => ({
        name,
        actual: await npmView(name, `dist-tags.${tag}`),
      })),
    )
    const pending = [
      ...versions.filter((item) => item.actual !== version).map((item) => `${item.name}@${version}`),
      ...tags.filter((item) => item.actual !== version).map((item) => `${item.name} dist-tag ${tag}`),
    ]

    if (pending.length === 0) {
      console.log(`Verified ${packageNames.length} npm packages at ${version}; ${tag} dist-tags match.`)
      return
    }

    console.log(`npm metadata pending (${attempt}/${attempts}): ${pending.join(", ")}`)
    if (attempt < attempts) await Bun.sleep(retryDelays[attempt - 1])
  }

  throw new Error(
    `npm metadata did not converge after ${attempts} attempts; rerun the verifier for ${version} (${channel}).`,
  )
}

async function npmView(packageSpec: string, field: string) {
  const result = await $`npm view ${packageSpec} ${field} --prefer-online --fetch-retries=0 --fetch-timeout=15000`
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return ""
  return result.stdout.toString("utf8").trim()
}

await main()
