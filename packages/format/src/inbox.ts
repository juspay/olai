/**
 * HOW FULL THE INBOX IS — the number the directory's Inbox door wears.
 *
 * The count is the top-level regular nodes of whichever outline `inboxIn`
 * names, which is the same number `list_outlines` reports as that file's
 * `roots`. Nested children do not inflate it (a capture with a note under it
 * is still one thing in the inbox), and a mirror does not (a placement is not
 * a capture). Empty, missing, or unreadable: zero.
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
   *  none, when the file holds nothing, and when it would not parse. */
  count: Schema.Int,
})
export type InboxHeld = typeof InboxHeld.Type

/** No inbox, an empty one, a torn one, and a server that has never loaded —
 *  one value, because all four wear no chip. */
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
 * THE FILE is found the way the capture is (`inboxIn` over the files this
 * derivation holds). An empty outline is absent from `byFile`, so a directory
 * that minted an inbox and then emptied it answers zero the same way a
 * directory that has never captured does — which is what the door wants: the
 * chip hides at zero either way, and whether the door itself is drawn is a
 * question about the PATHS, not about this number.
 */
export const inboxHeldOf = (derived: Derived): InboxHeld => {
  const file = inboxIn([...derived.byFile.keys()])
  if (file === undefined) return NO_INBOX
  const count = siblingsOf(derived, file, undefined).filter(
    (located) => !isMirror(located.node),
  ).length
  return { count }
}
