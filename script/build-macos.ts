#!/usr/bin/env bun
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { $ } from "bun"

const rootDir = resolve(import.meta.dir, "..")
const desktopDir = join(rootDir, "packages/desktop")
const outputDir = join(desktopDir, "dist")
const appName = "OpenCtrlC"
const installPath = `/Applications/${appName}.app`
const args = process.argv.slice(2)

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: bun run desktop:mac [-- --channel=dev|beta|prod] [--no-install] [--no-open]`)
  process.exit(0)
}

const channel = resolveChannel(args)
const install = !args.includes("--no-install")
const open = !args.includes("--no-open")

if (process.platform !== "darwin") {
  throw new Error("desktop:mac 只能在 macOS 上执行")
}

process.env.OPENCTRLC_CHANNEL = channel

await stopRunningApp()
await cleanMacBuildDirectories()

console.log(`开始构建 Desktop（channel: ${channel}）`)
await $`bun run --cwd ${desktopDir} build`
await $`bun run --cwd ${desktopDir} package -- --mac dir`

const appBundle = findBuiltApp()
if (!appBundle) {
  throw new Error(`没有找到构建产物：${outputDir}/**/${appName}.app`)
}

if (install) {
  await rm(installPath, { recursive: true, force: true })
  await $`ditto ${appBundle} ${installPath}`
  console.log(`已安装：${installPath}`)
}

if (open) await $`/usr/bin/open -n ${install ? installPath : appBundle}`

console.log(`APP 产物：${appBundle}`)

function resolveChannel(values: string[]) {
  const inline = values.find((value) => value.startsWith("--channel="))?.slice("--channel=".length)
  const index = values.indexOf("--channel")
  const explicit = inline ?? (index >= 0 ? values[index + 1] : undefined)
  const channel = explicit ?? process.env.OPENCTRLC_CHANNEL ?? "dev"
  if (channel !== "dev" && channel !== "beta" && channel !== "prod") {
    throw new Error(`无效的 Desktop channel：${channel}，可选值为 dev、beta、prod`)
  }
  return channel
}

async function stopRunningApp() {
  await $`pkill -x ${appName}`.nothrow()
}

async function cleanMacBuildDirectories() {
  await Promise.all(
    ["mac", "mac-arm64", "mac-x64", "mac-universal"].map((name) =>
      rm(join(outputDir, name), { recursive: true, force: true }),
    ),
  )
}

function findBuiltApp() {
  return [
    join(outputDir, "mac-arm64", `${appName}.app`),
    join(outputDir, "mac-x64", `${appName}.app`),
    join(outputDir, "mac-universal", `${appName}.app`),
    join(outputDir, "mac", `${appName}.app`),
  ].find((candidate) => existsSync(join(candidate, "Contents", "MacOS", appName)))
}
