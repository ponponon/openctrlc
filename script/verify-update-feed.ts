#!/usr/bin/env bun
import { appendFile } from "node:fs/promises"
import { parseDocument } from "yaml"

export const CHANNEL_FILES = ["latest.yml", "latest-mac.yml", "latest-linux.yml", "latest-linux-arm64.yml"]

export type Check = {
  target: string
  kind: "channel" | "installer"
  status: number
  ms: number
  ok: boolean
  note?: string
}

type ChannelEntry = { url?: string; size?: number }
type ChannelFile = { files?: ChannelEntry[] }

async function fetchText(url: string) {
  const started = performance.now()
  const response = await fetch(url, { redirect: "follow" })
  const text = await response.text()
  return { status: response.status, text, ms: Math.round(performance.now() - started) }
}

async function fetchHead(url: string) {
  const started = performance.now()
  const response = await fetch(url, { redirect: "follow" })
  const length = response.headers.get("content-length")
  await response.body?.cancel()
  return {
    status: response.status,
    length: length === null ? undefined : Number(length),
    ms: Math.round(performance.now() - started),
  }
}

export async function collectResults(baseUrl: string): Promise<Check[]> {
  const results: Check[] = []
  for (const name of CHANNEL_FILES) {
    const channel = await fetchText(`${baseUrl}/${name}`)
    results.push({
      target: name,
      kind: "channel",
      status: channel.status,
      ms: channel.ms,
      ok: channel.status === 200,
    })
    if (channel.status !== 200) continue

    const document = parseDocument(channel.text)
    if (document.errors.length > 0) {
      results.push({
        target: `${name} (parse)`,
        kind: "channel",
        status: channel.status,
        ms: channel.ms,
        ok: false,
        note: document.errors[0].message,
      })
      continue
    }
    const parsed = document.toJS() as ChannelFile

    for (const entry of parsed.files ?? []) {
      if (!entry.url) {
        results.push({
          target: `${name} → (missing url)`,
          kind: "installer",
          status: channel.status,
          ms: channel.ms,
          ok: false,
          note: "entry missing url",
        })
        continue
      }
      const head = await fetchHead(`${baseUrl}/${entry.url}`)
      const mismatch =
        head.length !== undefined && entry.size !== undefined && head.length !== entry.size
      results.push({
        target: `${name} → ${entry.url}`,
        kind: "installer",
        status: head.status,
        ms: head.ms,
        ok: head.status === 200 && !mismatch,
        note: mismatch ? `size mismatch: yml ${entry.size} vs http ${head.length}` : undefined,
      })
    }
  }
  return results
}

export function renderSummary(results: Check[], baseUrl: string): string {
  const lines = [
    "## Update feed verification",
    "",
    `Base: \`${baseUrl}\``,
    "",
    "| Target | Status | Time | Result | Note |",
    "| --- | --- | --- | --- | --- |",
  ]
  for (const result of results) {
    lines.push(
      `| ${result.target} | ${result.status} | ${result.ms}ms | ${result.ok ? "✅" : "❌"} | ${result.note ?? ""} |`,
    )
  }
  const failed = results.filter((result) => !result.ok)
  lines.push("")
  lines.push(failed.length === 0 ? `All ${results.length} checks passed.` : `${failed.length} check(s) failed.`)
  return lines.join("\n")
}

if (import.meta.main) {
  const repo = process.env.GH_REPO ?? process.env.GITHUB_REPOSITORY
  if (!repo) throw new Error("GH_REPO or GITHUB_REPOSITORY is required")
  const tag = process.env.RELEASE_TAG
  if (!tag) throw new Error("RELEASE_TAG is required")
  const baseUrl = process.env.UPDATE_FEED_BASE_URL ?? `https://github.com/${repo}/releases/download/${tag}`

  const results = await collectResults(baseUrl)
  const summary = renderSummary(results, baseUrl)
  console.log(summary)

  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) await appendFile(summaryPath, summary + "\n")

  if (results.some((result) => !result.ok)) {
    console.error("update feed verification failed")
    process.exit(1)
  }
}
