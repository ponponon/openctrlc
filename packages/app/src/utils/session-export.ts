import type { Message, Part, Session } from "@openctrlc/sdk/v2/client"
import type { useLanguage } from "@/context/language"
import type { Platform } from "@/context/platform"
import { fileManagerApp } from "./file-manager"
import { showToast } from "./toast"

// Matches the exact `{ info, messages: [{ info, parts }] }` structure produced by `opencode export` CLI
export type SessionExportData = {
  info: Session
  messages: {
    info: Message
    parts: Part[]
  }[]
}

export type SessionExportFormat = "json" | "markdown" | "markdown-detailed"

export function sessionExportActions(
  platform: Pick<Platform, "platform" | "os" | "openDownloads">,
  language: Pick<ReturnType<typeof useLanguage>, "t">,
) {
  if (platform.platform !== "desktop" || !platform.openDownloads) return undefined

  const openDownloads = platform.openDownloads
  return [
    {
      label: language.t(fileManagerApp(platform.os ?? "unknown").actionLabel),
      onClick: () => {
        void openDownloads().catch((err: unknown) =>
          showToast({
            variant: "error",
            title: language.t("common.requestFailed"),
            description: err instanceof Error ? err.message : String(err),
          }),
        )
      },
    },
  ]
}

export type SessionExportClient = {
  session: {
    get: (input: { sessionID: string }) => Promise<{ data?: Session | null }>
    messages: (input: { sessionID: string }) => Promise<{ data?: SessionExportData["messages"] | null }>
  }
}

export async function fetchSessionExport(input: {
  sessionID: string
  client: SessionExportClient
}): Promise<SessionExportData> {
  const [sessionRes, messagesRes] = await Promise.all([
    input.client.session.get({ sessionID: input.sessionID }),
    input.client.session.messages({ sessionID: input.sessionID }),
  ])

  if (!sessionRes?.data) {
    throw new Error(`Session not found: ${input.sessionID}`)
  }
  if (!messagesRes?.data) {
    throw new Error(`Failed to load messages for session: ${input.sessionID}`)
  }

  return {
    info: sessionRes.data,
    messages: messagesRes.data,
  }
}

export function sessionExportFilename(
  session: { id: string; title?: string; slug?: string },
  format: SessionExportFormat = "json",
) {
  const name = session.title || session.slug || session.id
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
  const extension = format === "json" ? "json" : "md"
  return `${clean || session.id}.${extension}`
}

export function sessionExportMarkdown(data: SessionExportData) {
  return renderSessionMarkdown(data, markdownSimplePart, (info) => info.role === "user" || info.finish !== "tool-calls")
}

export function sessionExportMarkdownDetailed(data: SessionExportData) {
  return renderSessionMarkdown(data, markdownPart)
}

function renderSessionMarkdown(
  data: SessionExportData,
  renderPart: (part: Part) => string[],
  includeMessage: (info: Message) => boolean = () => true,
) {
  const title = data.info.title || data.info.slug || data.info.id
  const lines = [`# ${markdownHeading(title)}`, "", `- **Session ID:** \`${data.info.id}\``]

  const sections: { key: string; role: "User" | "Assistant"; contents: string[] }[] = []

  if (data.info.directory) lines.push(`- **Directory:** \`${data.info.directory}\``)
  if (data.info.time?.created) lines.push(`- **Created:** ${new Date(data.info.time.created).toISOString()}`)

  for (const entry of data.messages) {
    if (!includeMessage(entry.info)) continue
    const content = entry.parts.flatMap(renderPart).join("\n\n").trim()
    if (!content) continue

    const role = entry.info.role === "user" ? "User" : "Assistant"
    const key = entry.info.role === "user" ? entry.info.id : entry.info.parentID
    const previous = sections.at(-1)
    if (previous?.key === key && previous.role === role) {
      previous.contents.push(content)
      continue
    }
    sections.push({ key, role, contents: [content] })
  }

  sections.forEach((section) => {
    lines.push("", `## ${section.role}`, "", section.contents.join("\n\n"))
  })

  return `${lines.join("\n").trimEnd()}\n`
}

export function sessionExportContent(data: SessionExportData, format: SessionExportFormat) {
  if (format === "markdown") return sessionExportMarkdown(data)
  if (format === "markdown-detailed") return sessionExportMarkdownDetailed(data)
  return JSON.stringify(data, null, 2)
}

export function downloadSessionExport(filename: string, data: SessionExportData, format: SessionExportFormat = "json") {
  const content = sessionExportContent(data, format)
  const mime = format === "json" ? "application/json" : "text/markdown;charset=utf-8"
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function markdownSimplePart(part: Part): string[] {
  if (part.type === "text") {
    if (part.ignored || !part.text.trim()) return []
    return [part.text]
  }

  if (part.type === "file") return markdownPart(part)
  return []
}

function markdownPart(part: Part): string[] {
  if (part.type === "text") {
    if (part.ignored || !part.text.trim()) return []
    return [part.text]
  }

  if (part.type === "reasoning") {
    if (!part.text.trim()) return []
    return [`<details>\n<summary>Reasoning</summary>\n\n${part.text}\n\n</details>`]
  }

  if (part.type === "tool") {
    const lines = [
      `### Tool: \`${markdownInline(part.tool)}\``,
      "",
      `**Status:** ${part.state.status}`,
      "",
      "#### Input",
      "",
      markdownFence(JSON.stringify(part.state.input, null, 2) ?? String(part.state.input), "json"),
    ]

    if (part.state.status === "completed") {
      lines.push("", "#### Output", "", markdownFence(part.state.output, "text"))
    }
    if (part.state.status === "error") {
      lines.push("", "#### Error", "", part.state.error)
    }

    return [lines.join("\n")]
  }

  if (part.type === "subtask") {
    return [
      [
        `### Subtask: ${markdownHeading(part.description)}`,
        "",
        `- **Agent:** \`${markdownInline(part.agent)}\``,
        "",
        "#### Prompt",
        "",
        part.prompt,
      ].join("\n"),
    ]
  }

  if (part.type === "file") {
    const name =
      part.filename ||
      (part.source && part.source.type !== "resource" ? part.source.path : undefined) ||
      "Attached file"
    return [`> Attached file: \`${markdownInline(name)}\` (${part.mime})`]
  }

  if (part.type === "step-start") return ["> Step started"]
  if (part.type === "step-finish") return [`> Step finished: ${markdownHeading(part.reason)}`]
  if (part.type === "snapshot") return [`> Snapshot: \`${markdownInline(part.snapshot)}\``]
  if (part.type === "patch") return [`> Patch: ${part.files.map((file) => `\`${markdownInline(file)}\``).join(", ")}`]
  if (part.type === "agent") return [`> Agent: \`${markdownInline(part.name)}\``]
  if (part.type === "retry") return [`> Retry ${part.attempt}: ${part.error.data.message}`]
  return [`> ${part.auto ? "Automatic" : "Manual"} compaction`]
}

function markdownHeading(value: string) {
  return value.replace(/\r?\n/g, " ").trim()
}

function markdownInline(value: string) {
  return value.replaceAll("`", "\\`").replace(/\r?\n/g, " ")
}

function markdownFence(value: string, language: string) {
  const longestFence = Math.max(2, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length))
  const fence = "`".repeat(longestFence + 1)
  return `${fence}${language}\n${value}\n${fence}`
}
