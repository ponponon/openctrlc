import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260923094529_session_system_prompt_snapshot",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session\` ADD \`system_prompt_snapshot\` text;`)
      yield* tx.run(`
        UPDATE session
        SET system_prompt_snapshot = (
          SELECT json_extract(message.data, '$.systemPrompt')
          FROM message
          WHERE message.session_id = session.id
            AND json_extract(message.data, '$.role') = 'user'
            AND nullif(trim(json_extract(message.data, '$.systemPrompt')), '') IS NOT NULL
          ORDER BY message.time_created, message.id
          LIMIT 1
        )
        WHERE system_prompt_snapshot IS NULL
          AND EXISTS (
            SELECT 1
            FROM message
            WHERE message.session_id = session.id
              AND json_extract(message.data, '$.role') = 'user'
              AND nullif(trim(json_extract(message.data, '$.systemPrompt')), '') IS NOT NULL
          )
      `)
    })
  },
} satisfies DatabaseMigration.Migration
