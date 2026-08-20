/**
 * WHETHER a node the picker found can take the row being moved — and, when it
 * cannot, the sentence that says why.
 *
 * The picker searches the WHOLE SET, so most of what it finds is somewhere the
 * row cannot go: another outline, the Trash, or somewhere this row already
 * draws. Nothing is hidden — a reader typing a title they can see must find it
 * (`../edges/EdgePanel.tsx` argues that at length for the edge panel: a browser
 * that dropped rows would teach a rule this app does not have) — so every hit
 * is drawn and the ones that cannot take the row say so.
 *
 * ## Asked at the AIM, which is #238's shape read for a keyboard
 *
 * A drop over the wrong pane fills that pane with the reason BEFORE the hand
 * lets go (`../drag/Refusal.tsx`), because a person told no after doing the
 * work has been told too late. A list walked with the arrows has the same two
 * moments — the row under the cursor, and the `Enter` — so the reason is drawn
 * as the cursor arrives and `Enter` sends nothing. What that costs is this
 * module: a second reading of rules the ops layer already has.
 *
 * It is a SECOND READING and never a second POLICY, which is the whole of why
 * it is safe. Every sentence here is about a rule `planMove` enforces
 * (`ops/src/plan.ts`), the write still goes through that planner, and a
 * destination this module says nothing about can still be refused there — an
 * id that has since moved, a file that stopped parsing — and lands in the
 * panel's said line in the ops layer's own words. What it must never do is
 * refuse something the planner would allow, which is why every rule below is a
 * fact about the SET as this tab is drawing it, and none of them is a guess
 * about the write.
 *
 * ## The one walk, and the case a parent walk cannot see
 *
 * "Inside" is asked of the DRAWING graph (`@olai/format`'s `drawnFrom`, walked
 * by its `drawingPath`) rather than of parent links, and that is a correction
 * this module shipped without: a parent walk answers "is the destination one of
 * my descendants", which misses the destination that a descendant PLACEMENT
 * draws. A Now section is mirrors of live work, so
 *
 *     now
 *       now-install   (a mirror of install)
 *     kitchen
 *       install
 *         handles
 *
 * offers `install` and `handles` as destinations for `now` — and moving it
 * there draws `now` inside itself for ever. The parent walk was silent, the
 * planner had no rule either, and the write gate's validator refused the SET:
 * an undimmed row, a keystroke, and a refusal about a file nobody wrote, which
 * is the exact shape this module exists to prevent (found by review, and the
 * planner grew the same walk in the same change).
 *
 * One walk answers every case: the destination is inside this row's own
 * subtree, is what a placement inside it shows, or — where the row IS a
 * placement — is what this row itself shows.
 *
 * ## The current parent is refused too, and that was a decision
 *
 * The roadmap asked for a ruling: does the picker offer the row's own parent?
 * It is OFFERED (finding it and not finding it is a reader hunting for a bug)
 * and REFUSED, because it is not the no-op it looks like. A `move_node` naming
 * a parent and no anchor lands the row LAST among that parent's children, so
 * picking the parent a row already has is a REORDER — silently, to the bottom
 * of a list that may be long, from a gesture that reads as "put it where it
 * already is". This app has two affordances that mean exactly that and say so
 * (`Alt+Shift+↑/↓`, and dragging), and the sentence points at them.
 */

import {
  chainOf,
  type Derived,
  drawingPath,
  isTrashed,
  isMirror,
} from "@olai/format"

import { SAME_FILE } from "../across.ts"

/**
 * THE ROW BEING MOVED — one value, read off the set where the picker is
 * created (`./moving.tsx`) and handed whole to everything that asks about it.
 *
 * Three of the four fields are what a destination is judged against and the
 * fourth is what the panel calls the row out loud, and they are ONE value
 * because the domain has one: "the row being moved". Passed as a judging shape
 * plus a title beside it, the two would be held together by an unenforced rule
 * (that the title is the title of what the row shows) at the one reader that
 * needs both.
 *
 * It names the row's OWN RECORD throughout, which is what the write names and
 * what the drawing walk starts from — so a mirror moves as the placement it is,
 * and what it draws is asked of the record rather than of the node it stands
 * for. This value carried that node as a field for one release; the walk made
 * it unnecessary, because `drawnFrom` follows a placement to its target itself.
 */
export interface Moved {
  /** The row's OWN record — what the write names, so a mirror moves as the
   *  placement it is and the node it stands for stays where it lives. */
  readonly id: string
  /** What the row SAYS: the title of the node it shows, for the one line the
   *  panel writes about what is being moved. The only field here no rule
   *  judges — a title is what a reader recognises the row by, and every other
   *  field is an id or a path. */
  readonly title: string
  /** The outline it lives in. */
  readonly file: string
  /** The node it sits under NOW, or `null` at the top level of its file. */
  readonly parent: string | null
}

/** A node the search offered, in the three fields a verdict reads. */
export interface Destination {
  readonly id: string
  readonly title: string
  readonly file: string
}

/**
 * Why this destination cannot take this row — or `null` when it can.
 *
 * The ORDER of the tests is what a reader gets told, and each one is in front
 * of the ones it would otherwise be answered by:
 *
 *   - the row ITSELF first, because every other sentence would be true of it
 *     and none of them would be the news;
 *   - the TRASH before the file rule, because an archive is another outline by
 *     construction and "another outline" is a true sentence about the wrong
 *     fact;
 *   - the FILE rule before the drawing walk, because that is the planner's own
 *     order (`planMove` refuses a cross-file parent before it asks about
 *     loops), and this module previews the planner rather than out-ruling it.
 */
export const whyNot = (
  moved: Moved,
  to: Destination,
  derived: Derived,
): string | null => {
  if (to.id === moved.id) {
    return `\`${to.title}\` is the row you are moving — nothing can go under itself.`
  }
  if (isTrashed(to.file)) {
    return `\`${to.title}\` has been put away — the Trash holds what is finished ` +
      `with, and nothing is moved INTO it. \`Put back\` is how something comes out.`
  }
  if (to.file !== moved.file) {
    return `\`${to.title}\` is in \`${to.file}\` and this row lives in ` +
      `\`${moved.file}\`. ${SAME_FILE}`
  }
  const drawn = drawingPath(derived, moved.id, to.id)
  if (drawn !== null) return insideItself(derived, to, drawn)
  if (to.id === moved.parent) {
    return `\`${to.title}\` is already this row's parent. A destination puts the row ` +
      `LAST under it, so picking this one would reorder rather than move — ` +
      `Alt+Shift+↑/↓ and dragging are the two ways to say that.`
  }
  return null
}

/**
 * The sentence for a destination this row already draws — TWO of them, because
 * they are two different mistakes and only one of them is visible on the page.
 *
 * A chain of plain parent links is a destination the reader can SEE under the
 * row they are moving, and saying so is enough. A chain through a PLACEMENT is
 * a destination that may be three branches away on screen, and the reader has
 * no way to know what this row draws — so that one names the chain, in the
 * spelling `chainOf` gives every other refusal about a loop in this codebase
 * (the validator's, and the two the ops layer raises). A person who then meets
 * the planner's own words about the same move reads one story.
 */
const insideItself = (
  derived: Derived,
  to: Destination,
  drawn: ReadonlyArray<string>,
): string => {
  const through = drawn.some((id) => {
    const at = derived.byId.get(id)
    return at !== undefined && isMirror(at.node)
  })
  return through
    ? `\`${to.title}\` is drawn inside this row, through a placement — ${
      chainOf(drawn)
    } — so putting it there would make the page draw itself for ever.`
    : `\`${to.title}\` is inside the row you are moving, so this would fold the ` +
      `branch into itself.`
}
