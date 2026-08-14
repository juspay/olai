/**
 * WHICH writes can take the row they were made in off the line it is on.
 *
 * The editor suppresses a blur while it is waiting for the frame that redraws
 * a row it just moved (`./editing.tsx`'s `settling`), and takes the caret back
 * when that frame lands. Both are owed only by a write that can actually MOVE
 * the row — and the answer is a fact about the VERB, so it is a table here
 * rather than a flag at each call site. A flag is something the next caller can
 * get wrong in a way nothing notices; a table is one list, and the test beside
 * it fails when a verb changes sides.
 *
 * ## What being wrong costs, said precisely
 *
 * Less than it looks, and the overstatement is worth correcting rather than
 * repeating: `settling` is cleared by the frame every landed write publishes —
 * the store re-reads the paths it just wrote (`@olai/store`'s probe forgets
 * their stamps), so even bytes identical to the ones already on disk publish a
 * revision. It is a WINDOW, not a leak, and it was checked in a browser by
 * telling the editor a date redraws and driving it both ways.
 *
 * What the window costs is the blur INSIDE it: somebody who clicks away while
 * the round trip is in flight has that blur dropped whole — the line is neither
 * committed nor closed — and is then pulled back into the row by the caret the
 * frame takes. Narrow, self-healing, and still not what anybody wants; a write
 * that cannot move the row should not open it at all.
 *
 * ## Why the marks are on the list and the two widgets are not
 *
 * A MARK can take the row off the page outright: with done rows hidden
 * (`../settings/done.ts`), `Ctrl+Enter` on the row you are typing in removes
 * it, which is the redraw this whole mechanism exists for. A `date` cannot —
 * it changes what the agenda and the day pages list, never this page's sibling
 * order — and a `mirror` cannot either, because the placement it makes is a new
 * row AFTER the one that made it.
 */

import type { Edit } from "@olai/surface"

/**
 * The verbs that can move the row, in one list.
 *
 * A `Set` of the surface's own words rather than a predicate per call site, so
 * "does this move the row" is asked once and answered from the vocabulary. A
 * verb this editor never sends is still listed when the answer is yes: what the
 * list states is a property of the WRITE, not of who happens to send it today.
 */
const MOVES: ReadonlySet<Edit["verb"]> = new Set<Edit["verb"]>([
  // The four indents and reorders, and the undo that puts a row back.
  "move",
  "place",
  // One row becomes two, or two become one.
  "split",
  "merge",
  // A mark can hide the row outright when done rows are hidden.
  "toggle",
  "walk",
  "mark",
  // The row leaves the page entirely, or comes back to it.
  "remove",
  "archive",
  "unarchive",
  "unmirror",
  // A new row appears where the draft was standing.
  "add",
])

export const redraws = (edit: Edit): boolean => MOVES.has(edit.verb)
