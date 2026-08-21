#!/usr/bin/env bun

import { Script } from "@openctrlc/script"
import { $ } from "bun"

const output = [`version=${Script.version}`]
const sha = process.env.GITHUB_SHA ?? (await $`git rev-parse HEAD`.text()).trim()
const repo = process.env.GH_REPO ?? "ponponon/openctrlc"
const tag = Script.channel === "beta" ? "beta" : `v${Script.version}`

if (!Script.preview) {
  await $`bun script/changelog.ts --to ${sha}`.cwd(process.cwd())
  const file = `${process.cwd()}/UPCOMING_CHANGELOG.md`
  const body = await Bun.file(file)
    .text()
    .catch(() => "No notable changes")
  const dir = process.env.RUNNER_TEMP ?? "/tmp"
  const notesFile = `${dir}/opencode-release-notes.txt`
  await Bun.write(notesFile, body)
   await $`gh release create ${tag} -d --target ${sha} --title "v${Script.version}" --notes-file ${notesFile} --repo ${repo}`
   const release = await $`gh release view ${tag} --json tagName,databaseId --repo ${repo}`.json()
   output.push(`release=${release.databaseId}`)
} else if (Script.channel === "beta") {
   await $`gh release create ${tag} -d --target ${sha} --title "Beta ${Script.version}" --repo ${repo}`
   const release =
     await $`gh release view ${tag} --json tagName,databaseId --repo ${repo}`.json()
  output.push(`release=${release.databaseId}`)
   output.push(`tag=${release.tagName}`)
}

output.push(`repo=${repo}`)
output.push(`tag=${tag}`)

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
