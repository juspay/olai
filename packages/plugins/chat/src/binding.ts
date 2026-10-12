/**
 * CHAT'S INTERNAL KIND WORDS. The bare contribution and its composed name
 * stay together because they describe one vocabulary decision. The literal
 * composed word lets module-scope readings use it before any fiber registers
 * kinds; `kinds.test.ts` holds it equal to `kindWordOf(name, SESSION_KIND)`.
 *
 * These constants used to be a public package export for the Spaces mirror.
 * Its real question was the seating reading, so `chat.seating` now owns that
 * boundary. Other plugins consume the answer without importing this module
 * or repeating the declaration fold. Chat's own kind and write paths still
 * need the words; keeping them internal does not create a second vocabulary.
 */
export const SESSION_KIND = "agent-session"

/** ...and the word a DECLARATION writes:
 *  `{"title":"agent-session","custom":{"type":"chat-agent-session"}}`. The
 *  header argues why it is a literal rather than a composition, and which bench
 *  holds it to the real one. */
export const SESSION_TYPE = "chat-agent-session"

/**
 * WHEN A NODE AGENT LAST TIDIED ITS OWN SUBTREE — the second kind this plugin
 * teaches a vault, and the same two-layer composition: the bare
 * {@link SLEPT_KIND} this plugin contributes, and the word a declaration writes,
 * `chat-agent-slept`.
 *
 * THE SAME WORD-BUILDING RULES AS THE BINDING'S, which is why they are one
 * module rather than two: a plugin's own name prefixed, a bare word that may
 * carry a hyphen of its own, and the first hyphen the separator — so
 * `chat-agent-slept` decomposes to `chat` and `agent-slept`. `kinds.test.ts`
 * holds both literals to the real composition.
 *
 * WHY IT IS A KIND AT ALL, when olai could have pinned one key: the key's
 * spelling is not a licence (`@olai/format`'s `agents.ts` argues the whole of
 * it one floor down). A vault that keeps its own `agent-slept` column, or
 * calls it `last-consolidated`, says so with one row and this plugin reads the
 * memo off whatever key the vault declared — and a vault that has said nothing
 * gets the composed word. {@link ./sleep.ts} is the value's rule; {@link
 * ./server/sleep.ts} is the only writer.
 */
export const SLEPT_KIND = "agent-slept"

/** ...and what a declaration writes for it:
 *  `{"title":"agent-slept","custom":{"type":"chat-agent-slept"}}`. */
export const SLEPT_TYPE = "chat-agent-slept"
