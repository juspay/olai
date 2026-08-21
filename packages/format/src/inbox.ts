/**
 * HOW FULL THE INBOX IS — the number the directory's Inbox door wears.
 *
 * The count is the top-level regular nodes of whichever outline `inboxIn`
 * names, which is the same number `list_outlines` reports as that file's
 * `roots`. Nested children do not inflate it (a capture with a note under it
 * is still one thing in the inbox), and a mirror does not (a placement is not
 * a capture). Empty, missing, unreadable, or only placements: zero. A file
 * that holds only mirrors is none of empty, missing or unreadable — it still
 * wears zero, because the badge counts captures, not rows the page draws.
 *
 * A READING of the set, the way `./shelf.ts` is: the browser may not hold the
 * vault, so the server answers this per published revision and the sidebar
 * draws the number (`@olai/surface`'s `inbox` cell). What it is NOT is a
 * second walk of the rows the inbox PAGE draws — those arrive on `page` —
 * because the door has to say how full the file is while somebody is
 * somewhere else.
 */

import { Schema } from "effect"

import { type Derived, siblingsOf } from "./derive.ts"
import { inboxIn, isMirror } from "./node.ts"
import { type OutlineSet, outlinePaths } from "./set.ts"

/**
 * How many captures the inbox holds, as the wire carries it.
 *
 * ONE INTEGER, and nothing else: which file that is is a fact about the
 * PATHS (`inboxIn` over the directory's names), and the door already reads
 * those. Duplicating the path here would be two answers to "which outline
 * is the inbox".
 */
export const InboxHeld = Schema.Struct({
  /** Top-level regular nodes of the directory's inbox. Zero when there is
   *  none, when the file holds nothing, when it would not parse, and when
   *  it holds only placements. */
  count: Schema.Int,
})
export type InboxHeld = typeof InboxHeld.Type

/** No inbox, an empty one, a torn one, a placements-only one, and a server
 *  that has never loaded — one value, because all five wear no chip. */
export const NO_INBOX: InboxHeld = { count: 0 }

/**
 * Whether two answers say the same thing — what keeps a revision that moved
 * no capture from sending a frame to every open tab.
 *
 * DERIVED from the schema, for `./shelf.ts`'s reason: a hand-written
 * comparison is the declaration spelled a second time.
 */
export const sameInboxHeld: (a: InboxHeld, b: InboxHeld) => boolean =
  Schema.toEquivalence(InboxHeld)

/**
 * How full the directory's inbox is, read off the set.
 *
 * THE FILE is found the way the capture is (`inboxIn` over
 * {@link outlinePaths}), not over `derived.byFile`. `byFile` is a grouping of
 * parsed records: an empty outline and a torn one have no entry, so a
 * shallowest empty `Inbox.olai` beside a populated `_olai/Inbox.olai` would
 * send the door and every future capture to the empty file and the count to
 * the deeper one. The set's paths are the list capture already walks.
 */
export const inboxHeldOf = (set: OutlineSet, derived: Derived): InboxHeld => {
  const file = inboxIn(outlinePaths(set))
  if (file === undefined) return NO_INBOX
  const count = siblingsOf(derived, file, undefined).filter(
    (located) => !isMirror(located.node),
  ).length
  return { count }
}
