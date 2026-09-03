import { describe, expect, test } from "bun:test"
import {
  fetchSessionExport,
  sessionExportActions,
  sessionExportFilename,
  sessionExportMarkdown,
} from "./session-export"
import type { Message, Part, Session } from "@openctrlc/sdk/v2/client"

describe("sessionExportFilename", () => {
  test("generates filename from title", () => {
    expect(sessionExportFilename({ id: "ses_123", title: "Clone PR in worktree from fork" })).toBe(
      "clone-pr-in-worktree-from-fork.json",
    )
  })

  test("generates filename from slug when title missing", () => {
    expect(sessionExportFilename({ id: "ses_123", slug: "my-session-slug" })).toBe("my-session-slug.json")
  })

  test("falls back to id when title and slug are empty", () => {
    expect(sessionExportFilename({ id: "ses_123" })).toBe("ses_123.json")
  })

  test("uses the selected format extension", () => {
    expect(sessionExportFilename({ id: "ses_123", title: "Readable session" }, "markdown")).toBe("readable-session.md")
  })
})

describe("sessionExportActions", () => {
  const language = { t: (key: string | number) => String(key) }
  const openDownloads = async () => undefined

  test("uses the native file manager label for each desktop platform", () => {
    expect(sessionExportActions({ platform: "desktop", os: "macos", openDownloads }, language)?.[0]?.label).toBe(
      "session.header.reveal.finder",
    )
    expect(sessionExportActions({ platform: "desktop", os: "windows", openDownloads }, language)?.[0]?.label).toBe(
      "session.header.reveal.fileExplorer",
    )
    expect(sessionExportActions({ platform: "desktop", os: "linux", openDownloads }, language)?.[0]?.label).toBe(
      "session.header.reveal.containingFolder",
    )
  })

  test("does not expose native actions in the web app", () => {
    expect(sessionExportActions({ platform: "web" }, language)).toBeUndefined()
  })
})

describe("sessionExportMarkdown", () => {
  test("renders a readable transcript with tool details", () => {
    const result = sessionExportMarkdown({
      info: {
        id: "ses_1",
        slug: "test-session",
        title: "Test Session",
        directory: "/tmp/project",
        time: { created: 0, updated: 0 },
      } as Session,
      messages: [
        {
          info: { id: "msg_user", role: "user" } as Message,
          parts: [{ id: "prt_user", type: "text", text: "hello" } as Part],
        },
        {
          info: { id: "msg_assistant", role: "assistant" } as Message,
          parts: [
            { id: "prt_text", type: "text", text: "Hi there" } as Part,
            {
              id: "prt_tool",
              sessionID: "ses_1",
              messageID: "msg_assistant",
              callID: "call_1",
              type: "tool",
              tool: "bash",
              state: {
                status: "completed",
                input: { command: "pwd" },
                output: "/tmp/project",
                title: "Run command",
                metadata: {},
                time: { start: 0, end: 1 },
              },
            } as Part,
          ],
        },
      ],
    })

    expect(result).toContain("# Test Session")
    expect(result).toContain("- **Session ID:** `ses_1`")
    expect(result).toContain("## User\n\nhello")
    expect(result).toContain("## Assistant\n\nHi there")
    expect(result).toContain("### Tool: `bash`")
    expect(result).toContain('```json\n{\n  "command": "pwd"\n}\n```')
    expect(result).toContain("```text\n/tmp/project\n```")
  })
})

describe("fetchSessionExport", () => {
  test("fetches full transcript from client", async () => {
    const session = { id: "ses_1", title: "Test Session" } as Session
    const msg = { id: "msg_1", role: "user" } as Message
    const part = { id: "prt_1", type: "text", text: "hello" } as Part
    const messages = [{ info: msg, parts: [part] }]

    const client = {
      session: {
        get: async () => ({ data: session }),
        messages: async () => ({ data: messages }),
      },
    }

    const result = await fetchSessionExport({
      sessionID: "ses_1",
      client,
    })

    expect(result).toEqual({
      info: session,
      messages,
    })
  })

  test("throws when session not found", async () => {
    const client = {
      session: {
        get: async () => ({ data: null }),
        messages: async () => ({ data: [] }),
      },
    }

    expect(
      fetchSessionExport({
        sessionID: "ses_missing",
        client,
      }),
    ).rejects.toThrow("Session not found: ses_missing")
  })
})
