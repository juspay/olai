/**
 * WHETHER a node the picker found can take the row being moved — and, when it
 * cannot, the sentence that says why.
 *
 * The picker searches the WHOLE SET, so most of what it finds is somewhere the
 * row cannot go: another outline, its own subtree, the Trash. Nothing is
 * hidden — a reader typing a title they can see must find it (`../edges/
 * EdgePanel.tsx` argues that at length for the edge panel: a browser that
 * dropped rows would teach a rule this app does not have) — so every hit is
 * drawn and the ones that cannot take the row say so.
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
 * refuse something the planner would allow, which is why the rules below are
 * the four that are facts about the SET as this tab is drawing it, and none of
 * them is a guess about the write.
 *
 * ## The current parent is ONE of them, and that was a decision
 *
 * The roadmap asked for a ruling: does the picker offer the row's own parent?
 * It is OFFERED (finding it and not finding it is a reader hunting for a bug)
 * and REFUSED, because it is not the no-op it looks like. A `move_node` naming
 * a parent and no anchor lands the row LAST among that parent's children, so
 * picking the parent a row already has is a REORDER — silently, to the bottom
 * of a list that may be long, from a gesture that reads as "put it where it
 * already is". This app has two affordances that mean exactly that and say so
 * (`Alt+Shift+↑/↓`, and dragging), and the sentence points at them.
 *
 * Pure, and over the one step of ancestry it needs rather than over a whole
 * derivation: `parentOf` is `derived.byId.get(id)?.node.parent`, and taking it
 * as a function is what lets every rule below be a unit test with a `Map` in it
 * (`./destination.test.ts`).
 */

import { isArchived } from "@olai/format"

import { SAME_FILE } from "../across.ts"

/** The ROW being moved, as the four facts a destination is judged against. */
export interface Moved {
  /** The row's OWN record — what the write names, so a mirror moves as the
   *  placement it is and the node it stands for stays where it lives. */
  readonly id: string
  /** The outline it lives in. */
  readonly file: string
  /**
   * The node the row SHOWS — itself for an ordinary row, and a mirror's target
   * for a placement.
   *
   * It is what the never-inside-itself rule is asked of, and the two cases are
   * one question: a row may not go inside what it DRAWS. For an ordinary row
   * that is its own subtree (the move would make a loop, which is the
   * ops layer's own `containing` refusal); for a mirror it is the target's
   * subtree, where a placement of a node inside what that node shows expands
   * forever (`planMirror`'s refusal, and the validator's).
   *
   * `undefined` for a placement whose chain is broken — nothing is drawn, so
   * there is nothing to be inside.
   */
  readonly shows: string | undefined
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
 * of the ones it would otherwise be answered by: a node in the Trash is in
 * another file too, and hearing "another outline" about work that has been put
 * away is a true sentence about the wrong fact.
 */
export const whyNot = (
  moved: Moved,
  to: Destination,
  parentOf: (id: string) => string | undefined,
): string | null => {
  if (to.id === moved.id) {
    return `\`${to.title}\` is the row you are moving — nothing can go under itself.`
  }
  const inside = drawnBy(moved.shows, to.id, parentOf)
  if (inside) {
    return moved.shows === moved.id
      ? `\`${to.title}\` is inside the row you are moving, so this would fold the ` +
        `branch into itself.`
      : `\`${to.title}\` is inside what this row shows, so the placement would be ` +
        `drawn inside itself and expand forever.`
  }
  if (isArchived(to.file)) {
    return `\`${to.title}\` has been put away — the Trash holds what is finished ` +
      `with, and nothing is moved INTO it. \`Put back\` is how something comes out.`
  }
  if (to.file !== moved.file) {
    return `\`${to.title}\` is in \`${to.file}\` and this row lives in ` +
      `\`${moved.file}\`. ${SAME_FILE}`
  }
  if (to.id === moved.parent) {
    return `\`${to.title}\` is already this row's parent. A destination puts the row ` +
      `LAST under it, so picking this one would reorder rather than move — ` +
      `Alt+Shift+↑/↓ and dragging are the two ways to say that.`
  }
  return null
}

/**
 * Is `to` inside the subtree rooted at `shows` — itself included?
 *
 * UPWARD through the parents, which is the direction the question is actually
 * asked in ("is what I picked one of my own descendants?"), and the walk the
 * ops layer's `containing` makes for the identical refusal. Bounded by a set of
 * what it has seen: a cycle is a set the validator refuses, so this can only
 * meet one in a frame drawn before that verdict, and a browser must not hang on
 * one.
 */
const drawnBy = (
  shows: string | undefined,
  to: string,
  parentOf: (id: string) => string | undefined,
): boolean => {
  if (shows === undefined) return false
  const seen = new Set<string>()
  let at: string | undefined = to
  while (at !== undefined && !seen.has(at)) {
    if (at === shows) return true
    seen.add(at)
    at = parentOf(at)
  }
  return false
}
