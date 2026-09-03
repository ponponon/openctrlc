import { Database } from "bun:sqlite"
import { Global } from "@openctrlc/core/global"
import type { SessionTable } from "@openctrlc/core/session/sql"
import type { Message, Part, Session as SDKSession } from "@openctrlc/sdk/v2"
import path from "path"
import { Session } from "@/session/session"

type SessionRow = typeof SessionTable.$inferSelect

type RawSessionRow = {
  id: string
  project_id: string
  workspace_id?: string | null
  parent_id?: string | null
  slug: string
  directory: string
  path?: string | null
  title: string
  version: string
  share_url?: string | null
  summary_additions?: number | null
  summary_deletions?: number | null
  summary_files?: number | null
  summary_diffs?: unknown
  metadata?: unknown
  cost: number
  tokens_input: number
  tokens_output: number
  tokens_reasoning: number
  tokens_cache_read: number
  tokens_cache_write: number
  revert?: unknown
  permission?: unknown
  agent?: string | null
  model?: unknown
  time_created: number
  time_updated: number
  time_compacting?: number | null
  time_archived?: number | null
}

type RawMessageRow = {
  id: string
  session_id: string
  data: unknown
}

type RawPartRow = {
  id: string
  message_id: string
  session_id: string
  data: unknown
}

export type OpencodeSessionInfo = {
  sessionID: string
  title: string
  directory: string
  messageCount: number
}

export type OpencodeSessionData = {
  info: SDKSession
  messages: Array<{ info: Message; parts: Part[] }>
}

export function opencodeDatabasePath(input?: string) {
  const dataDirectory = path.join(path.dirname(Global.Path.data), "opencode")
  const configured = input ?? process.env.OPENCODE_DB
  if (!configured) return path.join(dataDirectory, "opencode.db")
  if (path.isAbsolute(configured)) return configured
  return path.join(dataDirectory, configured)
}

export function readOpencodeSessionInfo(databasePath: string, sessionID: string): OpencodeSessionInfo | undefined {
  const database = new Database(databasePath, {
    readonly: true,
    readwrite: false,
    create: false,
  })

  try {
    const row = database.query("SELECT id, title, directory FROM session WHERE id = ?").get(sessionID) as Pick<
      RawSessionRow,
      "id" | "title" | "directory"
    > | null
    if (!row) return undefined

    const count = database.query("SELECT COUNT(*) AS count FROM message WHERE session_id = ?").get(sessionID) as {
      count: number
    } | null

    return {
      sessionID: row.id,
      title: row.title,
      directory: row.directory,
      messageCount: Number(count?.count ?? 0),
    }
  } finally {
    database.close()
  }
}

export function readOpencodeSession(databasePath: string, sessionID: string): OpencodeSessionData | undefined {
  const database = new Database(databasePath, {
    readonly: true,
    readwrite: false,
    create: false,
  })

  try {
    const row = database.query("SELECT * FROM session WHERE id = ?").get(sessionID) as RawSessionRow | null
    if (!row) return undefined

    const messageRows = database
      .query("SELECT id, session_id, data FROM message WHERE session_id = ? ORDER BY time_created ASC, id ASC")
      .all(sessionID) as RawMessageRow[]
    const partRows = database
      .query(
        "SELECT id, message_id, session_id, data FROM part WHERE session_id = ? ORDER BY message_id ASC, time_created ASC, id ASC",
      )
      .all(sessionID) as RawPartRow[]

    const partsByMessage = new Map<string, Part[]>()
    for (const partRow of partRows) {
      const part = {
        ...jsonObject(partRow.data),
        id: partRow.id,
        sessionID: partRow.session_id,
        messageID: partRow.message_id,
      } as Part
      const parts = partsByMessage.get(partRow.message_id)
      if (parts) parts.push(part)
      else partsByMessage.set(partRow.message_id, [part])
    }

    const info = removeUndefined(
      Session.fromRow({
        ...row,
        summary_diffs: jsonValue(row.summary_diffs),
        metadata: jsonValue(row.metadata),
        revert: jsonValue(row.revert),
        permission: jsonValue(row.permission),
        model: jsonValue(row.model),
      } as unknown as SessionRow),
    ) as SDKSession

    return {
      info,
      messages: messageRows.map((messageRow) => ({
        info: {
          ...jsonObject(messageRow.data),
          id: messageRow.id,
          sessionID: messageRow.session_id,
        } as Message,
        parts: partsByMessage.get(messageRow.id) ?? [],
      })),
    }
  } finally {
    database.close()
  }
}

function jsonValue(value: unknown) {
  if (value === null || value === undefined || typeof value !== "string") return value
  return JSON.parse(value) as unknown
}

function jsonObject(value: unknown) {
  const parsed = jsonValue(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object in the opencode database")
  }
  return parsed as Record<string, unknown>
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUndefined)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => (item === undefined ? [] : [[key, removeUndefined(item)]])),
  )
}
