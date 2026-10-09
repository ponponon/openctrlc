#!/usr/bin/env bun

import { Script } from "@openctrlc/script"
import { $ } from "bun"
import { fileURLToPath } from "url"

console.log("=== publishing ===\n")

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)
const tag = Script.channel === "beta" ? "beta" : `v${Script.version}`

if (process.env.OPENCTRLC_NPM_ONLY === "1") {
  await $`bun ./packages/opencode/script/publish.ts`
  await $`bun ./script/verify-npm-release.ts ${Script.version} ${Script.channel}`
  process.exit(0)
}

const pkgjsons = await Array.fromAsync(
  new Bun.Glob("**/package.json").scan({
    absolute: true,
  }),
).then((arr) => arr.filter((x) => !x.includes("node_modules") && !x.includes("dist")))

async function prepareReleaseFiles() {
  const currentVersion = (await Bun.file("./packages/opencode/package.json").json()).version

  for (const file of pkgjsons) {
    const manifest = await Bun.file(file).json()
    if (manifest.version !== currentVersion) continue

    const pkg = await Bun.file(file).text()
    const updated = pkg.replace(/(^\s*"version"\s*:\s*)"[^"]+"/m, `$1"${Script.version}"`)
    if (updated === pkg) throw new Error(`Failed to update package version in ${file}`)
    console.log("updated:", file)
    await Bun.file(file).write(updated)
  }

  await $`bun install`
  if (process.env.OPENCTRLC_SYNC_VERSIONS_ONLY !== "1") {
    await $`./packages/sdk/js/script/build.ts`
  }
}

if (Script.release && !Script.preview) {
  await $`git fetch origin --tags`
  await $`git switch --detach`
}

await prepareReleaseFiles()

if (process.env.OPENCTRLC_SYNC_VERSIONS_ONLY === "1") {
  process.exit(0)
}

console.log("\n=== cli ===\n")
await $`bun ./packages/opencode/script/publish.ts`

console.log("\n=== sdk ===\n")
await $`bun ./packages/sdk/js/script/publish.ts`

console.log("\n=== plugin ===\n")
await $`bun ./packages/plugin/script/publish.ts`

console.log("\n=== ui ===\n")
await $`bun ./packages/ui/script/publish.ts`

if (Script.release) {
  await $`bun ./packages/desktop/scripts/finalize-latest-json.ts`
  await $`bun ./packages/desktop/scripts/finalize-latest-yml.ts`
}

if (Script.release && !Script.preview) {
  await $`git commit -am "release: ${tag}"`
  await $`git tag -d ${tag}`.nothrow()
  await $`git tag ${tag}`
  await $`git push origin refs/tags/${tag} --force-with-lease --no-verify`
  await new Promise((resolve) => setTimeout(resolve, 5_000))
  await $`git fetch origin`
  await $`git checkout -B dev origin/dev`
  await prepareReleaseFiles()
  await $`git commit -am "sync release versions for ${tag}"`
  await $`git push origin HEAD:dev --no-verify`
}

if (Script.release) {
  await $`gh release edit ${tag} --draft=false --repo ${process.env.GH_REPO}`
}
