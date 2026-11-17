/**
 * THE TIE IS NOT AN AGENT'S TO WRITE — reserved at olai's own write door, in
 * every build, whether or not this plugin's server row is composed.
 *
 * `chat-agent-session` is the one key in this plugin that decides WHICH
 * conversation an item is having: a row that carries it is a node agent, and a
 * `.md` whose front matter carries it is a note with a chat. An agent that
 * could write it could seat itself on anything a person keeps — or drop its
 * own tie and leave the conversation nobody claims — in a single call, and
 * both of those are gestures a person makes in the panel.
 *
 * ## WHY IT IS STATIC, beside the per-session ticket that already forbids it
 *
 * A node agent's own door already refuses this key, and two more beside it
 * (`./server.ts`'s ticket): that fence is built from what THIS VAULT declares
 * the kind on, so a board keeping its bindings under a word of its own is
 * covered, and it is up exactly while that session is. It is also only up for
 * sessions chat itself started. Every other agent face the server answers —
 * a terminal talking to `/mcp`, a workbench, anything holding an ordinary
 * write door — had no fence at all, which made "an agent cannot seat itself"
 * a promise about one door rather than about the product. This is the
 * standing half, in the default spelling olai writes, and the two compose:
 * the reservations are a MAP, and a key named twice is forbidden once.
 *
 * ## KEY-WIDE rather than scoped to a file
 *
 * A tie can land on a row of any outline and in the front matter of any note,
 * so there is no file for a scope to name. What it costs is one property name
 * an agent writing through olai cannot set in a person's own notes; what it
 * buys is that the seat of a conversation is only ever moved by the person
 * whose conversation it is.
 *
 * ## It is a fence, not a lock
 *
 * What this covers is writes through OLAI's door, exactly as
 * `olai-plugin-vault-plugins/policy` says of `approved`: the agents it is
 * about are processes on the same host with file tools of their own, and a
 * vault is its owner's directory.
 */

/**
 * THE KEY, SPELLED HERE. This module is pulled into the HOST's permanent entry
 * closure (`packages/bundle`'s fence holds that closure to policy and nothing
 * else), so it imports nothing at all — not even this plugin's own word table.
 * `./binding.ts` spells the same literal for the runtime, and
 * `packages/bundle/src/settings.test.ts` holds the two equal.
 */
const SESSION_TYPE = "chat-agent-session"

/**
 * WHY A WRITE OF THE TIE IS REFUSED — the sentence the refusal spends
 * verbatim (`@olai/ops`' `doorRefusal`), which is why it reads as a reason and
 * starts in lower case. The per-session ticket carries this same clause, so an
 * agent reads one answer whichever door it reached for.
 */
export const SEATS =
  "it is what seats a conversation on a node or a note, and that is a person's gesture in the panel"

export const writeReservations = [{ key: SESSION_TYPE, says: SEATS }]
