import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261001041018_session_storage_bytes",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session\` ADD \`storage_bytes\` integer DEFAULT 0 NOT NULL;`)
      // Backfill from the transcript that already exists. JSON columns store exactly
      // JSON.stringify(value), so length() on the blob is the UTF-8 byte count.
      yield* tx.run(`
        UPDATE session
        SET storage_bytes =
          coalesce((SELECT sum(length(cast(message.data as blob))) FROM message WHERE message.session_id = session.id), 0)
          + coalesce((SELECT sum(length(cast(part.data as blob))) FROM part WHERE part.session_id = session.id), 0);
      `)
    })
  },
} satisfies DatabaseMigration.Migration
