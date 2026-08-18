/**
 * WHICH PAGE a drag is over, and what being over it MEANS — the half of the
 * gesture that a second pane made a question.
 *
 * With one page on screen there was nothing here to decide: the pointer was
 * over the rows or it was over nothing, and `./plan.ts` answered either way.
 * With two, a pointer names a PAGE before it names a gap, and the page it names
 * has an answer of its own to give — because the placement a drop sends is a
 * parent and a sibling in ONE FILE (`@olai/format`'s rule: every outline is an
 * independent tree), and the page under the pointer may hold no row of the file
 * the drag is carrying.
 *
 * SO AN AIM IS ONE OF TWO THINGS, and never neither-nor-both: a LANDING, which
 * is the same arithmetic and the same indicator an in-pane drop has always had,
 * or a REFUSAL, which says why before the pointer is released rather than after.
 * A union rather than a landing-plus-a-flag, because the two carry different
 * facts and a caller that had to check a boolean before reading a parent is a
 * caller that can forget to.
 *
 * THE REFUSAL IS RAISED HERE RATHER THAN AT THE WRITE, and that is the whole
 * design decision this module is. The ops layer refuses a cross-file `move_node`
 * in its own words, so a drop could simply be sent and quoted — but two things
 * are wrong with that. The indicator would have PROMISED a landing the release
 * could not keep, which is the one thing this gesture has never done (the
 * carried rows are left out of the candidates rather than guarded against;
 * `Placed.into` is `null` rather than checked at the drop). And worse, a drop at
 * the TOP LEVEL of the other pane's file names `parent: null`, which is not a
 * refusable request at all — it is a legal move to the top of the row's OWN
 * file, and it would land silently in a pane nobody was pointing at.
 *
 * WHAT IT IS NOT is a second policy about files. A page offers a landing
 * exactly when it draws a row the carried file could sit beside, which is the
 * same sentence `./dragging.ts` already measured by: rows of another file are
 * not candidates. A page with none left is a page with nothing to say yes with,
 * and this is it saying so out loud instead of saying nothing.
 */

import type { Box } from "./lines.ts"
import { type Landing, type Placed, planDrop } from "./plan.ts"

/** One editable page, measured for the drag in flight. */
export interface Aimed {
  /** The file this page is OF — what a refusal names (`./fields.ts`). */
  readonly file: string
  /** Where the pane is, and the box a refusal is drawn over. */
  readonly box: Box
  /** The rows a drop may land beside HERE: this page's rows, in the carried
   *  file, with everything being carried left out. Empty is a real answer, and
   *  it is the one that becomes a refusal. */
  readonly placed: ReadonlyArray<Placed>
}

/** Why a drop cannot happen here, and where to say so — the pane's own box,
 *  flat on the refusal for the reason a `Landing` carries its line flat: it is
 *  one answer, and a caller reaching through a field for half of it would be a
 *  caller that could draw one without the other. */
export interface Refusal extends Box {
  /** The sentence, in full. Drawn over the pane while the pointer is held, and
   *  said again on the bar when it is released — ONE spelling, because two
   *  would be two answers to the same question. */
  readonly why: string
  /** The file that refused, for a scenario to name without reading prose. */
  readonly file: string
}

/** What the pointer is asking for right now. */
export type Aim =
  | { readonly kind: "drop"; readonly landing: Landing }
  | { readonly kind: "refused"; readonly refusal: Refusal }

/**
 * WHICH page the pointer is in — decided on X alone, and clamped to the nearest.
 *
 * X alone because a split is COLUMNS: the panes tile the width and share the
 * height, so which one a pointer is over is a horizontal question, and the
 * vertical one is the gap-between-rows question `./plan.ts` already answers.
 *
 * Clamped rather than answered with `null`, and that is what keeps a lone page
 * behaving exactly as it did: a pointer dragged out over the sidebar, the
 * gutter, or past the last pane is still aiming at the page nearest it — which
 * with one page on screen is the only page there is, which is the gesture that
 * shipped.
 */
const awayFrom = (field: Aimed, x: number): number => {
  const right = field.box.left + field.box.width
  return x < field.box.left ? field.box.left - x : x > right ? x - right : 0
}

const aimedAt = (
  fields: ReadonlyArray<Aimed>,
  x: number,
): Aimed | undefined =>
  fields.reduce<Aimed | undefined>(
    (nearest, field) =>
      nearest === undefined || awayFrom(field, x) < awayFrom(nearest, x) ? field : nearest,
    undefined,
  )

/**
 * The words a page with no landing has for the row over it.
 *
 * Two cases, and they are two different pieces of news rather than one message
 * with a hole in it. A page of ANOTHER FILE is the format's rule, and it is
 * said in the ops layer's own terms (`ops/src/plan.ts` refuses the same move in
 * nearly these words) so a person who then reads a refusal from an agent's
 * `move_node` reads one story. A page of the SAME file with nothing left is the
 * gesture having eaten its own candidates — every row drawn there is inside
 * what the hand is holding — which is not about files at all.
 */
const whyNot = (field: Aimed, carried: string): string =>
  field.file === carried
    ? `every row drawn in \`${field.file}\` here is inside what you are carrying, ` +
      `so there is nowhere in this pane to put it`
    : `\`${field.file}\` is another file, and this row lives in \`${carried}\`. ` +
      `Every outline is an independent tree, so a parent is always in the same ` +
      `file — archiving is what moves a subtree between them, and a mirror is ` +
      `how one node is drawn in two.`

/**
 * What a pointer at `(x, y)` is asking of these pages — the ONE thing this
 * module answers.
 *
 * `carried` is the file the rows in the air came from, which is a fact about
 * the GESTURE rather than about any page: a drag begun in a mirror's expanded
 * children carries rows of the file that mirror points at, and those land among
 * their real siblings wherever they are drawn.
 *
 * `null` only when there is no page at all, which is a workspace showing a day,
 * a document or the Trash in every pane — nowhere to aim, and nothing to say
 * about it either.
 */
export const aimAt = (
  fields: ReadonlyArray<Aimed>,
  carried: string,
  x: number,
  y: number,
): Aim | null => {
  const field = aimedAt(fields, x)
  if (field === undefined) return null
  if (field.placed.length === 0) {
    return { kind: "refused", refusal: { ...field.box, why: whyNot(field, carried), file: field.file } }
  }
  const landing = planDrop(field.placed, x, y)
  return landing === null ? null : { kind: "drop", landing }
}
