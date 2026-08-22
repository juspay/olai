/**
 * THE INBOX CONVENTION, read both ways: what a capture BECOMES, and how full
 * the file is afterwards.
 *
 * Which outline the inbox IS is `./node.ts`'s ({@link inboxIn}) — a statement
 * about what a served file is by its name, beside `TRASH`. This module is the
 * two things a reader of that convention asks next, and they are here together
 * because they are one fact read from two sides: a directory with no inbox is
 * a `create` for the capture and a `0` for the door, and the two must never
 * disagree about which file they meant.
 *
 * ## What a capture becomes ({@link captureInto})
 *
 * ## How full the inbox is ({@link inboxHeldOf}) — the number the door wears.
 *
 * The count is what still awaits processing: the top-level regular nodes of
 * whichever outline `inboxIn` names that are not marked done. A bullet, a
 * todo or a doing counts; a done row does not. Nested children do not inflate
 * it (a capture with a note under it is still one thing in the inbox), and a
 * mirror does not (a placement is not a capture). Empty, missing, unreadable,
 * only placements, or every capture already done: zero. A file that holds
 * only mirrors is none of empty, missing or unreadable — it still wears
 * zero, because the badge counts captures, not rows the page draws. A file
 * whose captures are all done is the same zero: processed work is not news
 * on the door, even though the page behind it still draws the row when Done
 * is shown.
 *
 * A READING of the set, the way `./shelf.ts` is: the browser may not hold the
 * vault, so the server answers this per published revision and the sidebar
 * draws the number (`@olai/surface`'s `inbox` cell). What it is NOT is a
 * second walk of the rows the inbox PAGE draws — those arrive on `page` —
 * because the door has to say how full the file is while somebody is
 * somewhere else.
 */

import { Schema } from "effect"

import { type Derived, rootsOf } from "./derive.ts"
import { INBOX, inboxIn, mintedInto, storedMarker } from "./node.ts"
import { type OutlineSet, outlinePaths } from "./set.ts"
import type { Reading } from "./validate.ts"
import type { Capture, WriteRequest } from "./writing.ts"

/**
 * How many captures still await processing, as the wire carries it.
 *
 * ONE INTEGER, and nothing else: which file that is is a fact about the
 * PATHS (`inboxIn` over the directory's names), and the door already reads
 * those. Duplicating the path here would be two answers to "which outline
 * is the inbox".
 */
export const InboxHeld = Schema.Struct({
  /** Top-level regular nodes of the directory's inbox that still await
   *  processing. A bullet, a todo or a doing counts; a done row does not.
   *  Zero when there is none, when the file holds nothing, when it would
   *  not parse, when it holds only placements, and when every capture is
   *  already done. */
  count: Schema.Int,
})
export type InboxHeld = typeof InboxHeld.Type

/** No inbox, an empty one, a torn one, a placements-only one, an all-done
 *  one, and a server that has never loaded — one value, because all six
 *  wear no chip. */
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
 *
 * THE NUMBER is what still awaits processing on that file: `rootsOf`, minus
 * any root whose stored mark is `done`. A bullet, a todo or a doing counts;
 * a nested child does not, a placement does not, and a done row does not.
 */
export const inboxHeldOf = (set: OutlineSet, derived: Derived): InboxHeld => {
  const file = inboxIn(outlinePaths(set))
  if (file === undefined) return NO_INBOX
  const count = rootsOf(derived, file).filter(
    (root) => storedMarker(root.node) !== "done",
  ).length
  return { count }
}

/**
 * A capture as one of OLAI'S OWN DOORS composes it: {@link Capture} without the
 * one field that exists only to be refused.
 *
 * `after` is declared on a capture so that an agent writing the edge list under
 * the name `set_after` gives it is turned away BY NAME rather than having its
 * dependency silently dropped ({@link ./writing.ts}) — and at the TOP of an
 * `add` that same word means the sibling anchor, which is a string. So the two
 * spellings genuinely collide, and a door of ours spreading a whole capture
 * into an `add` is where the collision shows up. It is not a problem to solve:
 * nothing composing a capture writes the bent word, so the type says so.
 */
export type Capturing = Omit<Capture, "after">

/**
 * THE ONE OP A CAPTURE IS — an `add` into the inbox the directory has, or the
 * `create` that mints one holding exactly this capture.
 *
 * THREE DOORS capture into this directory and none of them names a file: the
 * palette's `⌘K` `+` sends a line, `POST /capture` sends one from a share
 * sheet or a script on the tailnet, and an agent reads the outlines and calls
 * `add_node` or `create_outline` itself (which is why `list_outlines` says the
 * convention in words — the one door that is handed the rule rather than the
 * function). The first two resolve through THIS, and that is the whole reason
 * it is here rather than in whichever face happened to need it first: it is a
 * statement about the DIRECTORY, the same kind of thing {@link inboxIn} above
 * it is, and a second spelling of "is there an inbox yet, and what do I do
 * about it" is two answers about one directory.
 *
 * It came down from `@olai/server` the day it got its second caller, which is
 * the move `./message.ts` records for itself in the same words.
 *
 * THE TWO ARMS ARE NOT INTERCHANGEABLE, which is why the choice is made here
 * and not by a caller off a file list it happens to hold: `create` is refused
 * for a file that exists and `add` is refused for one that does not. Either
 * way it is ONE request, so one plan, one validation and one atomic rename —
 * a capture that is refused leaves nothing behind, not a half-filled inbox and
 * not an empty file.
 *
 * WHERE ONE IS MINTED is `_olai/Inbox.olai` and not the root ({@link
 * mintedInto}, human 2026-08-20, reversing the ruling of the day before): the
 * shelf's argument read one convention over — a file olai made because
 * somebody pressed something is not one of the reader's own. The READING is
 * untouched, so a directory that already keeps an `Inbox.olai` at its root, or
 * a `notes/inbox.olai`, goes on capturing into the file it has and nothing
 * migrates.
 *
 * NOTHING IS VALIDATED HERE. A blank title, a date that is not a date, a
 * property spelled like a field this format already has — each is refused by
 * the write planner in its own words, which is the same sentence an agent's
 * `add_node` gets. A second rule here would be a door refusing something in
 * words no tool uses.
 *
 * PURE, over a {@link Reading}, for the reason every derivation in this
 * package is: it is a question about the set, answerable with a value and
 * testable without a server.
 */
export const captureInto = (at: Reading, capture: Capturing): WriteRequest => {
  const inbox = inboxIn(outlinePaths(at.set))
  return inbox === undefined
    ? { op: "create", file: mintedInto(INBOX), seed: capture }
    : { op: "add", file: inbox, ...capture }
}
