export * as SessionSystemPromptSnapshot from "./system-prompt-snapshot"

import { and, asc, eq, isNull, or, sql } from "drizzle-orm"
import { Effect } from "effect"
import type { Database } from "../database/database"
import { MessageTable, SessionTable } from "./sql"
import { SessionSchema } from "./schema"

type DatabaseService = Database.Interface["db"]

export function captureIfMissing(db: DatabaseService, sessionID: SessionSchema.ID, snapshot: string) {
  if (!snapshot.trim()) return Effect.succeed(false)
  return db
    .update(SessionTable)
    .set({ system_prompt_snapshot: snapshot })
    .where(
      and(
        eq(SessionTable.id, sessionID),
        or(isNull(SessionTable.system_prompt_snapshot), eq(SessionTable.system_prompt_snapshot, "")),
      ),
    )
    .returning({ sessionID: SessionTable.id })
    .get()
    .pipe(Effect.map(Boolean), Effect.orDie)
}

export function get(db: DatabaseService, sessionID: SessionSchema.ID) {
  return Effect.gen(function* () {
    const stored = yield* db
      .select({ snapshot: SessionTable.system_prompt_snapshot })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get()
      .pipe(Effect.orDie)
    if (stored?.snapshot?.trim()) return stored.snapshot

    const legacy = yield* db
      .select({ snapshot: sql<string | null>`json_extract(${MessageTable.data}, '$.systemPrompt')` })
      .from(MessageTable)
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          sql`json_extract(${MessageTable.data}, '$.role') = 'user'`,
          sql`nullif(trim(json_extract(${MessageTable.data}, '$.systemPrompt')), '') IS NOT NULL`,
        ),
      )
      .orderBy(asc(MessageTable.time_created), asc(MessageTable.id))
      .limit(1)
      .get()
      .pipe(Effect.orDie)
    if (!legacy?.snapshot?.trim()) return undefined

    yield* captureIfMissing(db, sessionID, legacy.snapshot)
    const recovered = yield* db
      .select({ snapshot: SessionTable.system_prompt_snapshot })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get()
      .pipe(Effect.orDie)
    return recovered?.snapshot?.trim() ? recovered.snapshot : legacy.snapshot
  })
}
