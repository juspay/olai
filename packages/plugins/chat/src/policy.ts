/**
 * This module is pulled into the HOST's permanent entry
 * closure (`packages/bundle`'s fence holds that closure to policy and nothing
 * else), so it imports nothing at all — not even this plugin's own word table.
 * `./binding.ts` spells the same literal for the runtime, and
 * `packages/bundle/src/settings.test.ts` holds the two equal.
 */
const SESSION_TYPE = "chat-agent-session"

/**
 * `./binding.ts`'s `OPENS_TYPE` is the same literal for the runtime, and
 * `packages/bundle/src/settings.test.ts` holds the two equal.
 */
const OPENS_TYPE = "chat-opens"

export const SEATS =
  "it is what ties a conversation to a node or a note, and that is a person's own gesture"

export const OPENS =
  "it is whether a note's chat opens beside the page, and that is the person's choice on the note"

export const writeReservations = [{ key: SESSION_TYPE, says: SEATS }, { key: OPENS_TYPE, says: OPENS }]
