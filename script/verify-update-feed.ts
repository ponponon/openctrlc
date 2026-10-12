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

type Fetched = { status: number; text: string; ms: number; error?: string }
type Meta = { status: number; length?: number; encoding?: string; ms: number; error?: string }
type SizeCheck = { ok: boolean; note?: string }

async function fetchText(url: string): Promise<Fetched> {
  const started = performance.now()
  try {
    const response = await fetch(url, { redirect: "follow" })
    const text = await response.text()
    return { status: response.status, text, ms: Math.round(performance.now() - started) }
  } catch (error) {
    return { status: 0, text: "", ms: Math.round(performance.now() - started), error: errorMessage(error) }
  }
}

async function fetchMeta(url: string): Promise<Meta> {
  const started = performance.now()
  try {
    const response = await fetch(url, { redirect: "follow" })
    const length = response.headers.get("content-length")
    const encoding = response.headers.get("content-encoding")
    await response.body?.cancel()
    const parsedLength = length === null ? Number.NaN : Number(length)
    const normalized = encoding?.toLowerCase().trim()
    return {
      status: response.status,
      length: Number.isFinite(parsedLength) ? parsedLength : undefined,
      encoding: normalized && normalized !== "identity" ? normalized : undefined,
      ms: Math.round(performance.now() - started),
    }
  } catch (error) {
    return { status: 0, ms: Math.round(performance.now() - started), error: errorMessage(error) }
  }
}

export async function collectResults(baseUrl: string): Promise<Check[]> {
  const results: Check[] = []
  for (const name of CHANNEL_FILES) {
    const channel = await fetchText(`${baseUrl}/${name}`)
    const channelOk = channel.error === undefined && channel.status === 200
    results.push({
      target: name,
      kind: "channel",
      status: channel.status,
      ms: channel.ms,
      ok: channelOk,
      note: channel.error === undefined ? undefined : `fetch error: ${channel.error}`,
    })
    if (!channelOk) continue

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
    const parsed: unknown = document.toJS()
    if (!isRecord(parsed)) {
      results.push({
        target: `${name} (structure)`,
        kind: "channel",
        status: channel.status,
        ms: channel.ms,
        ok: false,
        note: "channel file is not an object",
      })
      continue
    }
    if (!isList(parsed.files) || parsed.files.length === 0) {
      results.push({
        target: `${name} (structure)`,
        kind: "channel",
        status: channel.status,
        ms: channel.ms,
        ok: false,
        note: "no files entries",
      })
      continue
    }

    for (const item of parsed.files) {
      if (!isRecord(item)) {
        results.push({
          target: `${name} → (invalid entry)`,
          kind: "installer",
          status: channel.status,
          ms: channel.ms,
          ok: false,
          note: "entry is not an object",
        })
        continue
      }
      const url = typeof item.url === "string" && item.url.length > 0 ? item.url : undefined
      if (url === undefined) {
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
      const size = typeof item.size === "number" && Number.isFinite(item.size) ? item.size : undefined
      const meta = await fetchMeta(`${baseUrl}/${url}`)
      if (meta.error !== undefined) {
        results.push({
          target: `${name} → ${url}`,
          kind: "installer",
          status: meta.status,
          ms: meta.ms,
          ok: false,
          note: `fetch error: ${meta.error}`,
        })
        continue
      }
      if (meta.status !== 200) {
        results.push({ target: `${name} → ${url}`, kind: "installer", status: meta.status, ms: meta.ms, ok: false })
        continue
      }
      const sizeCheck = checkSize(size, meta)
      results.push({
        target: `${name} → ${url}`,
        kind: "installer",
        status: meta.status,
        ms: meta.ms,
        ok: sizeCheck.ok,
        note: sizeCheck.note,
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
      `| ${cell(result.target)} | ${result.status} | ${result.ms}ms | ${result.ok ? "✅" : "❌"} | ${cell(result.note ?? "")} |`,
    )
  }
  const failed = results.filter((result) => !result.ok)
  lines.push("")
  lines.push(failed.length === 0 ? `All ${results.length} checks passed.` : `${failed.length} check(s) failed.`)
  return lines.join("\n")
}

function checkSize(size: number | undefined, meta: Meta): SizeCheck {
  if (size === undefined) return { ok: false, note: "entry missing size" }
  if (meta.encoding !== undefined) return { ok: true, note: `content-encoding: ${meta.encoding} (size unverified)` }
  if (meta.length === undefined) return { ok: true, note: "no content-length (size unverified)" }
  if (meta.length !== size) return { ok: false, note: `size mismatch: yml ${size} vs http ${meta.length}` }
  return { ok: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isList(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function cell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
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
