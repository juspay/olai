/**
 * The rows as a reader's eye runs down them.
 *
 * The tree is nested and the arrow keys are not: `↓` from the last child of a
 * branch lands on whatever is drawn next, wherever that is in the shape. So
 * something has to flatten the drawn tree, and it has to flatten exactly what
 * is DRAWN — a folded branch's children are not on screen, so `↓` may not stop
 * in them, and rows hidden by done-visibility are already gone from the list
 * this walks (the page's memo filters them before anything here sees them).
 *
 * Pure over rows and a fold set, so the one thing worth getting wrong — where
 * `↓` goes from the last child of a collapsed parent — is a unit test rather
 * than a thing to try in a browser.
 *
 * The fold set is NODE IDS (`../fold/rows.ts`), which is what the reading holds
 * — a place asks it about the node it shows. The caret is still a PLACE: two
 * mirrors of one node fold together and are two different rows to stand in.
 */

import { shownRecord } from "@olai/format"
import type { Row } from "@olai/format"
import type { Anchor } from "@olai/surface"

import { foldIdOf, foldOf } from "../fold/rows.ts"
import type { Fold } from "../fold/rows.ts"
import type { Pending } from "./draft.ts"

/** Every row on screen, in the order they are painted.
 *
 *  One array, filled as the walk goes. The `flatMap` this replaced allocated a
 *  fresh array per row and spread each child result into its parent's, which
 *  is O(rows × depth) copies for an answer that is a list — and this runs
 *  whenever the caret moves through a tree that can be thousands of rows. */
export const flatten = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
): ReadonlyArray<Row> => {
  const drawn: Array<Row> = []
  const walk = (level: ReadonlyArray<Row>): void => {
    for (const row of level) {
      drawn.push(row)
      if (!collapsed.has(foldIdOf(row))) walk(row.children)
    }
  }
  walk(rows)
  return drawn
}

/**
 * Where a RECORD is drawn now, given where it was drawn before.
 *
 * The one rule that keeps a person's place across a server-authoritative
 * redraw, and it is one rule because two things need it: the caret
 * (`./editing.tsx`, one place) and a multi-selection (`../select/selection.ts`,
 * a set of them). A place is a chain of ids, so `Tab` changes it — the row that
 * was `…/install/measure` is `…/handles/measure` the moment the file says so —
 * and anything still holding the old chain is pointing at nothing.
 *
 * The brainstorming note (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/editing-web.md) filed this as "a
 * primitive nobody owns", to be moved the day a second consumer appeared. It
 * appeared.
 *
 * By the row's OWN record rather than by the node it shows: a mirrored node is
 * drawn at more than one place, and what is being followed is the placement the
 * reader was standing in. `at` is where it was drawn — passed in, and answered
 * unchanged when that row is still there, so a caller can tell "it has not
 * moved" from "it has" without a second scan. `null` is for a place that has
 * never been drawn (a row an `add` has just made), which is the same question
 * with no previous answer.
 */
export const refound = (
  drawn: ReadonlyArray<Row>,
  record: string,
  at: string | null,
): string | undefined => {
  if (at !== null && drawn.some((row) => row.key === at)) return at
  return drawn.find((row) => row.at.node.id === record)?.key
}

/** The row before or after this place, or `undefined` at either end of the
 *  page — where the caret simply stays put, because there is nowhere to go and
 *  a wrap-around would be a surprise rather than a convenience.
 *
 *  It takes the page ALREADY FLATTENED, as {@link refound} does and for the
 *  same reason: both callers ask this beside one of the other two walkers, and
 *  a gesture that asks two questions of one page should walk it once
 *  (`./editing.tsx`'s `drawn`, `../select/selection.ts`'s `grow`). Flattening
 *  for itself, this made that walk a second one every time
 *  (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §4.8). */
export const neighbour = (
  drawn: ReadonlyArray<Row>,
  place: string,
  step: 1 | -1,
): Row | undefined => {
  const at = drawn.findIndex((row) => row.key === place)
  return at === -1 ? undefined : drawn[at + step]
}

/**
 * One step of the arrow keys: a ROW that is written, or a DRAFT that is still
 * being laid out. The tree's rows carry `kind` on what they SHOW, not on
 * themselves, so these two spell their own — the test is `kind`, which a
 * `Pending` happens to share (`"new"`), and "happens" is exactly why this
 * says it.
 *
 * `depth` on both, because the structure keys read the picture the same walk
 * produced: a blank that takes `Tab` asks which side of the seat it stands on
 * the row DIRECTLY above it — and the seat itself is deeper than its anchor
 * when it is a first child ({@link reanchored}).
 */
export type Wire =
  | { readonly kind: "row"; readonly row: Row; readonly depth: number }
  | { readonly kind: "draft"; readonly pending: Pending; readonly depth: number }

/**
 * The page as the ARROW KEYS walk it: {@link flatten}, with every blank draft
 * slotted where its ghost is drawn.
 *
 * `neighbour` walks rows alone — which was true to the keys while blanks had
 * no keys of their own — and it is false to the eye: the eye skips nothing, so
 * an arrow may not skip a blank either. A parked draft between two rows is a
 * line the caret lands on, at exactly the place `Ghosts.tsx` paints it:
 * `before:X` immediately above X; `after:X` at the FLOOR of X's subtree,
 * which is where `Enter` lays the next line out; `under:X` immediately under
 * X itself, the first-child's seat; `first` ahead of the first row. The fold
 * set bites once: a collapsed branch's floor is the row itself.
 *
 * One walk rather than `flatten` with the drafts threaded through it, because
 * the two lists live in different prisons and only the WALK couples them —
 * the rows come off the wire and the drafts out of `./draft.ts`, and what the
 * caller needs is the order they make together.
 */
export const wired = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  drafts: ReadonlyArray<Pending>,
): ReadonlyArray<Wire> => {
  // One walk for an empty page and a sketched one: when there are no drafts
  // the slots below are an empty map's three misses per row, which is the
  // walk {@link flatten} always did with the shapes a walk is cheaper to
  // keep in one place.
  const keyed = new Map<string, Pending[]>()
  const slot = (under: string, draft: Pending) => {
    const at = keyed.get(under) ?? []
    at.push(draft)
    keyed.set(under, at)
  }
  for (const draft of drafts) {
    const at = draft.at
    slot(
      at.kind === "first" ? "first"
        : at.kind === "before" ? `b:${at.id}`
        : at.kind === "after" ? `a:${at.id}`
        : `u:${at.id}`,
      draft,
    )
  }
  const out: Array<Wire> = []
  const lay = (level: ReadonlyArray<Row>, depth: number): void => {
    for (const row of level) {
      const id = row.at.node.id
      for (const draft of keyed.get(`b:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft, depth })
      }
      out.push({ kind: "row", row, depth })
      for (const draft of keyed.get(`u:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft, depth: depth + 1 })
      }
      if (!collapsed.has(foldIdOf(row))) lay(row.children, depth + 1)
      for (const draft of keyed.get(`a:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft, depth })
      }
    }
  }
  for (const draft of keyed.get("first") ?? []) {
    out.push({ kind: "draft", pending: draft, depth: 0 })
  }
  lay(rows, 0)
  return out
}

/**
 * WHERE A CARET STANDS on the wire: a blank by its slot, or a row by the place
 * it is drawn at. Two spellings because the two id spaces are two — a draft has
 * no `Row.key` until it has committed, and a row has no slot ever.
 */
export type Standing =
  | { readonly kind: "draft"; readonly slot: string }
  | { readonly kind: "row"; readonly place: string }

/**
 * The wire, and the index the caret stands at — `-1` when what it names is not
 * drawn (a row inside a fold, a draft whose anchor has gone).
 *
 * ONE walk and ONE search, because four keys ask the same question of it and
 * their answers may not differ: the arrows step one along ({@link Wire} either
 * side), `Backspace` on a blank reads the line above, and the four structure
 * keys measure the seat's own sibling list from here ({@link reanchored}). Each
 * of those spelled its own `findIndex` once, and one of them minted a fake
 * draft with a magic slot to find itself — three walks that could come to
 * disagree about which line is above, in a module whose whole job is that
 * nothing disagrees about it.
 */
export const seated = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  drafts: ReadonlyArray<Pending>,
  standing: Standing,
): { readonly walk: ReadonlyArray<Wire>; readonly at: number } => {
  const walk = wired(rows, collapsed, drafts)
  return {
    walk,
    at: walk.findIndex((step) =>
      step.kind === "draft"
        ? standing.kind === "draft" && step.pending.slot === standing.slot
        : standing.kind === "row" && step.row.key === standing.place
    ),
  }
}

/**
 * Where a BLANK's seat goes when the structure keys hit it.
 *
 * `at` is the anchor the key writes — the blank's drawing address — and
 * `open`, when present, is the fold that must lift for the seat to be ON the
 * page at all: Tab into a collapsed branch answers with the row the branch
 * would append to (below), and that row is not drawn until the fold goes —
 * Workflowy's own answer to indent-into-folded. Without it the ghost draws
 * nothing while its anchor says it sits under a triangle that reads closed,
 * and the first `Enter` writes into a fold nobody can see the result in
 * (the human's review of #493).
 */
export interface Reseating {
  readonly at: Anchor
  /** The node whose fold holds the seat — to be lifted exactly when this
   *  seat is taken (`../fold/rows.ts`'s half of the id+file pair). */
  readonly open?: Fold
}

/**
 * THE SEAT'S OWN SIBLING LIST, as the page draws it: the rows at the seat's
 * depth on either side of it, nearest first, and the row that ENDS the list
 * going up — which is the parent, and the one row `out` is about.
 *
 * The walk steps over two things and each is a rule the four keys share:
 *
 *   - a DEEPER row is a sibling's own flight and belongs to that sibling. An
 *     `after:X` seat sits at the FLOOR of X's subtree, so what trails directly
 *     above it may be X's last descendant three levels in.
 *   - a BLANK is not a record. Anchors name records, so no answer here can
 *     spell "between two sketches" — a parked blank is a line the arrows stop
 *     on and a line these keys step past, which is the honest half of a
 *     deferral rather than a disagreement (the ordering BETWEEN blanks at one
 *     seat is what is deferred).
 */
const flanking = (
  walk: ReadonlyArray<Wire>,
  at: number,
  depth: number,
): {
  readonly above: ReadonlyArray<Row>
  readonly below: ReadonlyArray<Row>
  readonly parent: Row | undefined
} => {
  const above: Array<Row> = []
  let parent: Row | undefined
  for (let i = at - 1; i >= 0; i--) {
    const step = walk[i]
    if (step === undefined || step.kind !== "row" || step.depth > depth) continue
    if (step.depth < depth) {
      parent = step.row
      break
    }
    above.push(step.row)
  }
  const below: Array<Row> = []
  for (let i = at + 1; i < walk.length; i++) {
    const step = walk[i]
    if (step === undefined || step.kind !== "row" || step.depth > depth) continue
    if (step.depth < depth) break
    below.push(step.row)
  }
  return { above, below, parent }
}

/**
 * `Tab`'s answer for one row: become its LAST CHILD.
 *
 * The server's own `move in` ({@link ../../../../server/src/edit.ts}), spelled
 * as an anchor — last child by name, or the `under` seat when the row has none.
 *
 * THE NODE IT SHOWS, never the row's own record, which is the one place this
 * walk stops reading placements: a childless MIRROR named as a parent is
 * `@olai/ops`' `notANode` — "that id is a placement, name the node" — so the
 * seat would draw, take a title, and be refused on the `Enter` that committed
 * it. The server resolves the same mirror the same way for a written row's
 * `Tab`, and the two faces of one key may not disagree about where under a
 * mirror is.
 *
 * A branch that reads CLOSED hands back the fold to lift with it: the seat has
 * to be ON the page it says it is at, or the ghost draws nowhere and the first
 * `Enter` writes into a fold nobody can see the result in. Asked of the FOLD
 * and not of the children, because a row that has lost its last child keeps the
 * memory of being folded — and the seat's own commit is what gives it one back.
 */
const asLastChild = (row: Row, collapsed: ReadonlySet<string>): Reseating => {
  const last = row.children[row.children.length - 1]
  return {
    at: last === undefined
      ? { kind: "under", id: shownRecord(row).node.id }
      : { kind: "after", id: last.at.node.id },
    ...(collapsed.has(foldIdOf(row)) ? { open: foldOf(row) } : {}),
  }
}

/**
 * Where a BLANK's anchor goes when the structure keys hit it: Tab (`in`),
 * Shift+Tab (`out`), Alt+Shift+↑/↓ (`up` / `down`), all LOCAL. Nothing here is
 * a write — a sketch is re-arranged as a sketch, on screen, and the ONE write
 * it eventually makes holds the shape the person arrived at.
 *
 * ONE WALK ({@link flanking}) and four rules over what it found, because the
 * four keys are four readings of one list and not four searches. Each of them
 * was its own loop once, and each loop re-decided what a deeper row and a
 * parked blank meant — which is how `in` came to indent three levels on one
 * press while `up` refused to cross a sketch at all (the review of #493 caught
 * both halves).
 *
 *   - `in`: the row above at the seat's OWN depth is the previous sibling, and
 *     the seat becomes its last child — one level, the same one `move in`
 *     gives a written row. No such row means the seat is already that side's
 *     first child, and the key has nothing to say.
 *   - `out`: the row that ended the list is the parent, and the seat takes its
 *     after-slot — drawn right below that whole branch, as the row Shift+Tab
 *     makes of a bullet.
 *   - `up`: one slot over the rows above. `before` the nearest when the seat
 *     was second in the list (the first-child's seat, written in a row's own
 *     name), `after` the one TWO up otherwise, so the blank lands between the
 *     two.
 *   - `down`: one slot over the rows below — `after` the nearest.
 *
 * Both ends of the list are where a key has nothing to say: a blank does not
 * wrap round any more than a row does ({@link neighbour}).
 *
 * `others` are the page's remaining parked blanks, so this wire is the one the
 * arrows read — one page, not two measuring sticks.
 */
export const reanchored = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  sketch: Pending,
  way: "in" | "out" | "up" | "down",
  others: ReadonlyArray<Pending> = [],
): Reseating | undefined => {
  const { walk, at } = seated(rows, collapsed, [...others, sketch], {
    kind: "draft",
    slot: sketch.slot,
  })
  const seat = walk[at]
  if (seat === undefined) return undefined
  const { above, below, parent } = flanking(walk, at, seat.depth)
  const after = (row: Row | undefined): Reseating | undefined =>
    row === undefined ? undefined : { at: { kind: "after", id: row.at.node.id } }
  const [nearest, over] = above

  switch (way) {
    case "in":
      return nearest === undefined ? undefined : asLastChild(nearest, collapsed)
    case "out":
      return after(parent)
    // One slot up: `after` the sibling TWO above, so the blank lands between
    // the two — or `before` the nearest when there is no second, which is the
    // first-child's seat written in a row's own name.
    case "up":
      return nearest === undefined ? undefined : over === undefined
        ? { at: { kind: "before", id: nearest.at.node.id } }
        : after(over)
    case "down":
      return after(below[0])
  }
}
