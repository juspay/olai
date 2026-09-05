/** Internal kind words. Other plugins consume chat.seating instead.
 * kinds.test.ts holds the composed word equal to the registry composition. */
export const SESSION_KIND = "agent-session"

/** ...and the word a DECLARATION writes:
 *  `{"title":"agent-session","custom":{"type":"chat-agent-session"}}`. The
 *  header argues why it is a literal rather than a composition, and which bench
 *  holds it to the real one. */
export const SESSION_TYPE = "chat-agent-session"
