import { test, expect } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  formatImportFileError,
  parseShareUrl,
  shouldAttachShareAuthHeaders,
  transformShareData,
  type ShareData,
} from "../../src/cli/cmd/import"
import { opencodeDatabasePath, readOpencodeSession } from "../../src/cli/opencode-database"
import { FSUtil } from "@openctrlc/core/fs-util"
import { PlatformError } from "effect"

test("formats import file errors", () => {
  expect(
    formatImportFileError(
      "test.json",
      new PlatformError.PlatformError(
        new PlatformError.SystemError({
          _tag: "NotFound",
          module: "FileSystem",
          method: "readFileString",
        }),
      ),
    ),
  ).toBe("File not found: test.json")
  expect(
    formatImportFileError(
      "test.json",
      new PlatformError.PlatformError(
        new PlatformError.SystemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "readFileString",
        }),
      ),
    ),
  ).toBe("Failed to read file: Permission denied")
  expect(
    formatImportFileError(
      "test.json",
      new FSUtil.FileSystemError({ method: "readJson", cause: new SyntaxError("Unexpected token") }),
    ),
  ).toBe("Invalid JSON in test.json: Unexpected token")
})

// parseShareUrl tests
test("parses valid share URLs", () => {
  expect(parseShareUrl("https://opncd.ai/share/Jsj3hNIW")).toBe("Jsj3hNIW")
  expect(parseShareUrl("https://custom.example.com/share/abc123")).toBe("abc123")
  expect(parseShareUrl("http://localhost:3000/share/test_id-123")).toBe("test_id-123")
})

test("rejects invalid URLs", () => {
  expect(parseShareUrl("https://opncd.ai/s/Jsj3hNIW")).toBeNull() // legacy format
  expect(parseShareUrl("https://opncd.ai/share/")).toBeNull()
  expect(parseShareUrl("https://opncd.ai/share/id/extra")).toBeNull()
  expect(parseShareUrl("not-a-url")).toBeNull()
})

test("only attaches share auth headers for same-origin URLs", () => {
  expect(shouldAttachShareAuthHeaders("https://control.example.com/share/abc", "https://control.example.com")).toBe(
    true,
  )
  expect(shouldAttachShareAuthHeaders("https://other.example.com/share/abc", "https://control.example.com")).toBe(false)
  expect(shouldAttachShareAuthHeaders("https://control.example.com:443/share/abc", "https://control.example.com")).toBe(
    true,
  )
  expect(shouldAttachShareAuthHeaders("not-a-url", "https://control.example.com")).toBe(false)
})

// transformShareData tests
test("transforms share data to storage format", () => {
  const data: ShareData[] = [
    { type: "session", data: { id: "sess-1", title: "Test" } as any },
    { type: "message", data: { id: "msg-1", sessionID: "sess-1" } as any },
    { type: "part", data: { id: "part-1", messageID: "msg-1" } as any },
    { type: "part", data: { id: "part-2", messageID: "msg-1" } as any },
  ]

  const result = transformShareData(data)!

  expect(result.info.id).toBe("sess-1")
  expect(result.messages).toHaveLength(1)
  expect(result.messages[0].parts).toHaveLength(2)
})

test("returns null for invalid share data", () => {
  expect(transformShareData([])).toBeNull()
  expect(transformShareData([{ type: "message", data: {} as any }])).toBeNull()
  expect(transformShareData([{ type: "session", data: { id: "s" } as any }])).toBeNull() // no messages
})

test("resolves the default opencode database next to the openctrlc data directory", () => {
  expect(opencodeDatabasePath()).toEndWith(path.join("opencode", "opencode.db"))
  expect(opencodeDatabasePath("custom.db")).toEndWith(path.join("opencode", "custom.db"))
  expect(opencodeDatabasePath("/tmp/source.db")).toBe("/tmp/source.db")
})

test("reads a session and its messages from an opencode database", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openctrlc-opencode-import-"))
  const databasePath = path.join(directory, "opencode.db")
  const database = new Database(databasePath)

  database.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      workspace_id TEXT,
      parent_id TEXT,
      slug TEXT NOT NULL,
      directory TEXT NOT NULL,
      path TEXT,
      title TEXT NOT NULL,
      version TEXT NOT NULL,
      share_url TEXT,
      summary_additions INTEGER,
      summary_deletions INTEGER,
      summary_files INTEGER,
      summary_diffs TEXT,
      metadata TEXT,
      cost REAL NOT NULL,
      tokens_input INTEGER NOT NULL,
      tokens_output INTEGER NOT NULL,
      tokens_reasoning INTEGER NOT NULL,
      tokens_cache_read INTEGER NOT NULL,
      tokens_cache_write INTEGER NOT NULL,
      revert TEXT,
      permission TEXT,
      agent TEXT,
      model TEXT,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      time_compacting INTEGER,
      time_archived INTEGER
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `)
  database
    .query(
      `INSERT INTO session (
        id, project_id, slug, directory, path, title, version, metadata, cost,
        tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write,
        model, time_created, time_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "ses_import_test",
      "project",
      "slug",
      "/tmp/project",
      "",
      "Imported session",
      "1.0.0",
      JSON.stringify({ source: "opencode" }),
      1.5,
      2,
      3,
      4,
      5,
      6,
      JSON.stringify({ id: "model", providerID: "provider", variant: "default" }),
      100,
      200,
    )
  database
    .query("INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)")
    .run("msg_import_test", "ses_import_test", 100, 100, JSON.stringify({ role: "user", time: { created: 100 } }))
  database
    .query("INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)")
    .run("prt_z", "msg_import_test", "ses_import_test", 102, 102, JSON.stringify({ type: "text", text: "second" }))
  database
    .query("INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)")
    .run("prt_a", "msg_import_test", "ses_import_test", 101, 101, JSON.stringify({ type: "text", text: "first" }))
  database.close()

  try {
    const result = readOpencodeSession(databasePath, "ses_import_test")

    expect(result?.info).toMatchObject({
      id: "ses_import_test",
      title: "Imported session",
      metadata: { source: "opencode" },
      model: { id: "model", providerID: "provider", variant: "default" },
    })
    expect(result?.messages).toHaveLength(1)
    expect(result?.messages[0]?.parts.map((part) => part.id)).toEqual(["prt_a", "prt_z"])
    expect(result?.messages[0]?.parts.map((part) => part.type)).toEqual(["text", "text"])
    expect(readOpencodeSession(databasePath, "ses_missing")).toBeUndefined()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
