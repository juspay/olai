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
