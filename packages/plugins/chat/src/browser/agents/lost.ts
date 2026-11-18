/**
 * WHEN A CHAT PAGE'S NOTE STOPS BEING WHAT IT WAS — the two ways a note can
 * leave a conversation that is open on it, as a pure rule.
 *
 * A note's chat lives in the note: the file is the memory and its front
 * matter carries the tie. Both of those are things that happen OUTSIDE olai —
 * a rename in a terminal, a `git pull`, an agent rewriting a `README.md` with
 * its own file tools — and until now the page answered both of them with the
 * same empty *Ask about plan…* box: a door onto a file that is not there, or
 * a second chat offered on a note whose first one is still running.
 *
 * So there are two losses, and they want opposite answers:
 *
 *   - GONE — the directory has spoken and does not hold the file. There is
 *     nothing to chat about and nothing to write a tie into, so the page says
 *     the note is gone and offers no start. (A RENAME keeps the front matter,
 *     so that conversation is alive at the new path's own page; this page is
 *     the old address and says so.)
 *   - UNTIED — the note is still held and no longer names the conversation
 *     this pane was reading. The conversation itself is untouched (the serve
 *     holds it by its own id, not by the tie), so the page says the note no
 *     longer names it and offers ONE press that writes the tie back.
 *
 * NOTHING IS SAID UNTIL THE DIRECTORY HAS SPOKEN. `reading` is a tab that has
 * not got the set yet, and a page that announced a missing note on its first
 * frame would be announcing its own wire.
 *
 * A NODE IS NOT ASKED. A row's tie is a property on the row, a trashed row
 * leaves the roster, and what that page should say is the node page's
 * question rather than this one — this rule is about files.
 *
 * PURE, with the directory's two answers handed in, so the table is a bun
 * test (`./lost.test.ts`) rather than something only a running tab can say.
 */

import type { AgentItem } from "@olai/format"

/** The conversation a pane was reading before the tie went. */
export interface WasTied {
  readonly agent: string
  readonly session: string
}

export type Lost =
  | { readonly kind: "gone" }
  | { readonly kind: "untied"; readonly was: WasTied; readonly path: string }

export const lostOf = (input: {
  /** What this page is about. */
  readonly item: AgentItem
  /** The served directory's own word for itself. */
  readonly standing: "reading" | "never" | "loaded" | undefined
  /** Whether the directory holds this path. */
  readonly held: boolean
  /** Whether the roster still has a chat for this item. */
  readonly tied: boolean
  /** The conversation this pane was reading, while it was reading one. */
  readonly was: WasTied | null
}): Lost | null => {
  if (input.item.kind !== "note") return null
  if (input.standing !== "loaded") return null
  if (!input.held) return { kind: "gone" }
  if (input.tied || input.was === null) return null
  return { kind: "untied", was: input.was, path: input.item.path }
}
