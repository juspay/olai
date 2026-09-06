/**
 * WHICH PAGE a drag is over, and what being over it MEANS — the half of the
 * gesture that a second pane made a question.
 *
 * With one page on screen there was nothing here to decide: the pointer was
 * over the rows or it was over nothing, and `./plan.ts` answered either way.
 * With two, a pointer names a PAGE before it names a gap, and the page it names
 * has an answer of its own to give — because what a drop measures is a gap
 * BETWEEN ROWS OF THE CARRIED FILE (`./dragging.ts` builds the candidates that
 * way, and `./plan.ts` reads a depth off them), and the page under the pointer
 * may hold no such row.
 *
 * THAT IS A LIMIT OF THIS GESTURE AND NOT OF THE SET, which is a distinction
 * this module used to be able to skip and no longer can. `move_node` carries a
 * row into another outline now, ids intact, and the move-to picker (⌘⇧M) sends
 * exactly that. A drag has no arithmetic for a pane it is not carrying rows of
 * — there is no gap to measure and no depth to read — so what it says is what
 * is true: not here, and here is where.
 *
 * SO AN AIM IS ONE OF TWO THINGS, and never neither-nor-both: a LANDING, which
 * is the same arithmetic and the same indicator an in-pane drop has always had,
 * or a REFUSAL, which says why before the pointer is released rather than after.
 * A union rather than a landing-plus-a-flag, because the two carry different
 * facts and a caller that had to check a boolean before reading a parent is a
 * caller that can forget to.
 *
 * THE REFUSAL IS RAISED HERE RATHER THAN AT THE WRITE, and that is the whole
 * design decision this module is. The indicator would otherwise have PROMISED a
 * landing the release could not keep, which is the one thing this gesture has
 * never done (the carried rows are left out of the candidates rather than
 * guarded against; `Placed.into` is `null` rather than checked at the drop). And
 * there is nothing at the far end to catch it either: a drop at the TOP LEVEL of
 * the other pane names `parent: null`, which is not a refusable request — it is
 * a legal move to the top of the row's OWN file — so a release nobody stopped
 * here would land the row somewhere the pointer was never pointing.
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

/** How far outside a span a point is, and `0` for one inside it. */
const outside = (at: number, from: number, extent: number): number =>
  at < from ? from - at : at > from + extent ? at - (from + extent) : 0

/**
 * How far the pointer is from a page's box — `0` while it is inside one.
 *
 * BOTH AXES, though today only one of them ever decides. A split is COLUMNS:
 * the panes tile the width and share the height, so every box gives the same
 * vertical answer and the horizontal one picks the pane. Reading Y as well
 * costs a subtraction and buys the projection the pane list already names as
 * next — children STACKED rather than side by side (`../pane/geometry.ts`'s
 * `Axis`) — where a horizontal-only reading would pick a plausible wrong pane
 * silently, which is the worst way for this to be out of date.
 *
 * Squared, because nothing compares it to a distance in pixels; it is only ever
 * held against another one of itself.
 */
const awayFrom = (field: Aimed, x: number, y: number): number => {
  const dx = outside(x, field.box.left, field.box.width)
  const dy = outside(y, field.box.top, field.box.height)
  return dx * dx + dy * dy
}

/**
 * WHICH page the pointer is in — the nearest one, and it is always one.
 *
 * Clamped rather than answered with `null`, and that is what keeps a lone page
 * behaving exactly as it did: a pointer dragged out over the sidebar, the
 * gutter, or past the last pane is still aiming at the page nearest it — which
 * with one page on screen is the only page there is, which is the gesture that
 * shipped.
 */
const aimedAt = (
  fields: ReadonlyArray<Aimed>,
  x: number,
  y: number,
): Aimed | undefined =>
  fields.reduce<Aimed | undefined>(
    (nearest, field) =>
      nearest === undefined || awayFrom(field, x, y) < awayFrom(nearest, x, y) ? field : nearest,
    undefined,
  )

/**
 * The words a page with no landing has for the row over it.
 *
 * Two cases, and they are two different pieces of news rather than one message
 * with a hole in it. A page of ANOTHER FILE is about the GESTURE: a drag lands
 * a row in a gap between rows of the file it is carrying, and this pane draws
 * none — so it names the door that CAN send the row there rather than a law,
 * because there is no longer a law to name (`move_node` crosses outlines, and
 * `⌘⇧M` is that same op with a search in front of it). A page of the SAME file
 * with nothing left is the gesture having eaten its own candidates — every row
 * drawn there is inside what the hand is holding — which is not about files at
 * all.
 */
const whyNot = (field: Aimed, carried: string): string =>
  field.file === carried
    ? `every row drawn in \`${field.file}\` here is inside what you are carrying, ` +
      `so there is nowhere in this pane to put it`
    : `\`${field.file}\` is another file, and this row lives in \`${carried}\` — a ` +
      `drag lands between rows of the outline it is carrying, and this pane draws ` +
      `none of them. Use Move to… (⌘⇧M) to send it to another outline.`

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
  const field = aimedAt(fields, x, y)
  if (field === undefined) return null
  if (field.placed.length === 0) {
    return { kind: "refused", refusal: { ...field.box, why: whyNot(field, carried), file: field.file } }
  }
  const landing = planDrop(field.placed, x, y)
  return landing === null ? null : { kind: "drop", landing }
}
