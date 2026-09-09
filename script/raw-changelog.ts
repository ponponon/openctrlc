#!/usr/bin/env bun

import { $ } from "bun"
import { parseArgs } from "util"

type Release = {
  tag_name: string
  draft: boolean
}

type Commit = {
  message: string
}

type User = Map<string, Set<string>>
type Diff = {
  sha: string
  login: string | null
  message: string
}

const repo = process.env.GH_REPO ?? "ponponon/openctrlc"
const owner = repo.split("/")[0] ?? ""
const bot = ["actions-user", "github-actions[bot]", "opencode", "opencode-agent[bot]"]
const team = [
  owner,
  ...(await Bun.file(new URL("../.github/TEAM_MEMBERS", import.meta.url))
    .text()
    .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
    .then((x) => x.filter((x) => x && !x.startsWith("#")))),
  ...bot,
]
function ref(input: string) {
  if (input === "HEAD") return input
  if (input.startsWith("v")) return input
  if (input.match(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)) return `v${input}`
  return input
}

async function latest() {
  const data = await $`gh api "/repos/${repo}/releases?per_page=100"`.json()
  const release = (data as Release[]).find((item) => !item.draft)
  if (!release) throw new Error("No releases found")
  return release.tag_name.replace(/^v/, "")
}

async function diff(base: string, head: string) {
  const list: Diff[] = []
  for (let page = 1; ; page++) {
    const text =
      await $`gh api "/repos/${repo}/compare/${base}...${head}?per_page=100&page=${page}" --jq '.commits[] | {sha: .sha, login: .author.login, message: .commit.message}'`.text()
    const batch = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Diff)
    if (batch.length === 0) break
    list.push(...batch)
    if (batch.length < 100) break
  }
  return list
}

function type(message: string) {
  if (message.match(/fix/i)) return "Bug Fixes"
  return "Features"
}

function message(message: string) {
  const match = message.match(/^(?:feat|fix|perf|refactor|docs|style|build|chore|test|ci|release)(?:\([^)]*\))?\s*!?\s*:\s*(.+)$/i)
  return match?.[1]?.trim() ?? message
}

function reverted(commits: Commit[]) {
  const seen = new Map<string, Commit>()

  for (const commit of commits) {
    const match = commit.message.match(/^Revert "(.+)"$/)
    if (match) {
      const msg = match[1]!
      if (seen.has(msg)) seen.delete(msg)
      else seen.set(commit.message, commit)
      continue
    }

    const revert = `Revert "${commit.message}"`
    if (seen.has(revert)) {
      seen.delete(revert)
      continue
    }

    seen.set(commit.message, commit)
  }

  return [...seen.values()]
}

async function commits(from: string, to: string) {
  const base = ref(from)
  const head = ref(to)

  const data = new Map<string, { message: string }>()
  for (const item of await diff(base, head)) {
    data.set(item.sha, { message: item.message.split("\n")[0] ?? "" })
  }

  const log =
    await $`git log ${base}..${head} --format=%H -- packages/opencode packages/sdk packages/plugin packages/desktop packages/app sdks/vscode packages/extensions github`.text()

  const list: Commit[] = []
  for (const hash of log.split("\n").filter(Boolean)) {
    const item = data.get(hash)
    if (!item) continue
    if (item.message.match(/^(?:ignore|test|chore|ci|release|style|build)(?:\([^)]*\))?\s*!?\s*:/i)) continue

    const diff = await $`git diff-tree --no-commit-id --name-only -r ${hash}`.text()
    const areas = new Set<string>()

    for (const file of diff.split("\n").filter(Boolean)) {
      if (file.startsWith("packages/opencode/src/cli/cmd/")) areas.add("tui")
      else if (file.startsWith("packages/opencode/")) areas.add("core")
      else if (file.startsWith("packages/desktop/src-tauri/")) areas.add("tauri")
      else if (file.startsWith("packages/desktop/") || file.startsWith("packages/app/")) areas.add("app")
      else if (file.startsWith("packages/sdk/") || file.startsWith("packages/plugin/")) areas.add("sdk")
      else if (file.startsWith("sdks/vscode/") || file.startsWith("github/")) areas.add("extensions/vscode")
    }

    if (areas.size === 0) continue

    list.push({
      message: item.message,
    })
  }

  return reverted(list)
}

async function contributors(from: string, to: string) {
  const base = ref(from)
  const head = ref(to)

  const users: User = new Map()
  for (const item of await diff(base, head)) {
    const title = item.message.split("\n")[0] ?? ""
    if (!item.login || team.includes(item.login)) continue
    if (title.match(/^(ignore:|test:|chore:|ci:|release:)/i)) continue
    if (!users.has(item.login)) users.set(item.login, new Set())
    users.get(item.login)!.add(title)
  }

  return users
}

async function published(to: string) {
  if (to === "HEAD") return
  const body = await $`gh release view ${ref(to)} --repo ${repo} --json body --jq .body`.text().catch(() => "")
  if (!body) return

  const lines = body.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith("**Thank you to "))
  if (start < 0) return
  return lines.slice(start).join("\n").trim()
}

async function thanks(from: string, to: string, reuse: boolean) {
  const release = reuse ? await published(to) : undefined
  if (release) return release.split(/\r?\n/)

  const users = await contributors(from, to)
  if (users.size === 0) return []

  const lines = [`**Thank you to ${users.size} community contributor${users.size > 1 ? "s" : ""}:**`]
  for (const [name, commits] of users) {
    lines.push(`- @${name}:`)
    for (const commit of commits) lines.push(`  - ${commit}`)
  }
  return lines
}

function format(from: string, to: string, version: string | undefined, list: Commit[], thanks: string[]) {
  const grouped = new Map<"Features" | "Bug Fixes", string[]>([
    ["Features", []],
    ["Bug Fixes", []],
  ])

  for (const commit of list) {
    grouped.get(type(commit.message))!.push(`- ${message(commit.message)}`)
  }

  const lines: string[] = []
  append("Features")
  append("Bug Fixes")

  if (list.length === 0) lines.push("## Features", "", "No notable changes.", "")

  const tag = version ? `v${version.replace(/^v/, "")}` : undefined
  const releaseRef = tag ?? ref(to)
  const asset = (name: string) => `https://github.com/${repo}/releases/download/${releaseRef}/${name}`

  if (tag) {
    lines.push("## Downloads", "", "### CLI", "", "#### macOS", "")
    lines.push(
      `- [Apple Silicon ZIP](${asset("openctrlc-darwin-arm64.zip")}) | [Intel ZIP](${asset("openctrlc-darwin-x64.zip")})`,
      "",
      "#### Linux",
      "",
      `- [x64 tar.gz](${asset("openctrlc-linux-x64.tar.gz")}) | [ARM64 tar.gz](${asset("openctrlc-linux-arm64.tar.gz")})`,
      "",
      "#### Windows",
      "",
      `- [x64 ZIP](${asset("openctrlc-windows-x64.zip")}) | [ARM64 ZIP](${asset("openctrlc-windows-arm64.zip")})`,
      "",
      "### Desktop",
      "",
      "#### macOS",
      "",
      `- [Apple Silicon DMG](${asset("openctrlc-mac-arm64.dmg")}) | [Apple Silicon ZIP](${asset("openctrlc-mac-arm64.zip")})`,
      "",
      "#### Linux",
      "",
      `- [x64 DEB](${asset("openctrlc-linux-x64.deb")}) | [x64 AppImage](${asset("openctrlc-linux-x64.AppImage")}) | [x64 RPM](${asset("openctrlc-linux-x64.rpm")})`,
      `- [ARM64 DEB](${asset("openctrlc-linux-arm64.deb")}) | [ARM64 AppImage](${asset("openctrlc-linux-arm64.AppImage")}) | [ARM64 RPM](${asset("openctrlc-linux-arm64.rpm")})`,
      "",
      "#### Windows",
      "",
      `- [x64 Installer](${asset("openctrlc-win-x64.exe")}) | [ARM64 Installer](${asset("openctrlc-win-arm64.exe")})`,
      "",
    )
  }

  if (thanks.length > 0) lines.push("## Contributors", "", ...thanks, "")

  lines.push(`**Full Changelog**: https://github.com/${repo}/compare/${ref(from)}...${releaseRef}`)
  return lines.join("\n")

  function append(title: "Features" | "Bug Fixes") {
    const entries = grouped.get(title) ?? []
    if (entries.length === 0) return

    lines.push(`## ${title}`, "", ...entries, "")
  }
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      from: { type: "string", short: "f" },
      to: { type: "string", short: "t", default: "HEAD" },
      version: { type: "string", short: "v" },
      help: { type: "boolean", short: "h", default: false },
    },
  })

  if (values.help) {
    console.log(`
Usage: bun script/raw-changelog.ts [options]

Options:
  -f, --from <version>   Starting version (default: latest non-draft GitHub release)
  -t, --to <ref>         Ending ref (default: HEAD)
  -v, --version <version> Release version used for download links
  -h, --help             Show this help message

Examples:
  bun script/raw-changelog.ts
  bun script/raw-changelog.ts --from 1.0.200
  bun script/raw-changelog.ts -f 1.0.200 -t 1.0.205
`)
    process.exit(0)
  }

  const to = values.to!
  const from = values.from ?? (await latest())
  const list = await commits(from, to)
  console.log(format(from, to, values.version, list, await thanks(from, to, !values.from)))
}
