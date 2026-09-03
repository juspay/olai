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

import type { Row } from "@olai/format"
import type { Anchor } from "@olai/surface"

import { foldIdOf } from "../fold/rows.ts"
import { emptyPending } from "./draft.ts"
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
 * Where a BLANK's anchor goes when the structure keys hit it: Tab (`in`),
 * Shift+Tab (`out`), Alt+Shift+↑/↓ (`up` / `down`), all LOCAL. Nothing here is
 * a write — a sketch is re-arranged as a sketch, on screen, and the ONE write
 * it eventually makes holds the shape the person arrived at.
 *
 * Measured on the WIRE — the same list the eye and the arrows read — because
 * "the row above the blank" is a drawing question, not a tree one:
 *
 *   - `in`: the row DIRECTLY above the blank. Deeper than the blank's own
 *     seat (an `after:X` blank sitting at a subtree's FLOOR has that
 *     subtree's last rows trailing above it) → the blank joins THEIR flight,
 *     anchored after the last of them. The same depth (the row above is the
     * seat's own neighbour) → under it, the first-child seat. Shallower →
 *     the blank already sits at the first-child seat of its own side, and
 *     there is nothing closer to the parent to stand on: the key says nothing.
 *
 *   - `out`: the blank slips out of the sibling list it sits in, into the
 *     parent's own after-slot — drawn right below that whole branch, as the
 *     row Shift+Tab makes of a bullet.
 *
 *   - `up` / `down`: one slot within the seat's own sibling list — the first
 *     slot is the `under` seat (a `first` at a bare page) and the last is
 *     `after` the last drawn child, and both ends are where the key has
 *     nothing to say: a blank at the foot of its list does not wrap around
 *     any more than a row does ({@link neighbour}).
 */
export const reanchored = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  at: Anchor,
  way: "in" | "out" | "up" | "down",
): Anchor | undefined => {
  const walk = wired(rows, collapsed, [emptyPending(at, "sizing")])
  const me = walk.findIndex((step) => step.kind === "draft")
  const theSeat = walk[me]
  if (theSeat === undefined) return undefined

  if (way === "in") {
    for (let i = me - 1; i >= 0; i--) {
      const step = rowAt(walk, i)
      if (step === undefined) continue
      if (step.depth > theSeat.depth) return { kind: "after", id: step.row.at.node.id }
      if (step.depth === theSeat.depth) return { kind: "under", id: step.row.at.node.id }
      return undefined
    }
    return undefined
  }
  if (way === "out") {
    for (let i = me - 1; i >= 0; i--) {
      const step = rowAt(walk, i)
      if (step !== undefined && step.depth < theSeat.depth) {
        return { kind: "after", id: step.row.at.node.id }
      }
    }
    return undefined
  }

  // The siblings: everything at the seat's depth between one parent boundary
  // and the next. `up` slips the blank one slot over the rows ABOVE it; `down`
  // over the ones below. Either end of the list is undrawable territory.
  if (way === "up" || way === "down") {
    const above: Array<Row> = []
    for (let i = me - 1; i >= 0; i--) {
      const step = rowAt(walk, i)
      if (step === undefined) continue
      if (step.depth < theSeat.depth) break
      if (step.depth === theSeat.depth) above.push(step.row)
    }
    const below: Array<Row> = []
    for (let i = me + 1; i < walk.length; i++) {
      const step = rowAt(walk, i)
      if (step === undefined) continue
      if (step.depth < theSeat.depth) break
      if (step.depth === theSeat.depth) below.push(step.row)
    }
    if (way === "up") {
      // `above` is collected walking BACKWARD: above[0] is the row directly
      // above the seat, above[1] the sibling two up, above[last] the one at
      // the list's top. One slot up: the seat's floor becomes the row ONE
      // further above — `before` the nearest when the seat was second in the
      // list (the first-child's seat, written in a row's own name), `after`
      // the one TWO up otherwise, so the blank lands between the two. The
      // one-press-two-slots answer `above[last]` made is the one grok's
      // review of #493 caught: every test tree that pinned this sat the
      // blank at most two slots in, where the two spellings coincide.
      const top = above[0]
      if (top === undefined) return undefined
      const over = above[1]
      return over === undefined
        ? { kind: "before", id: top.at.node.id }
        : { kind: "after", id: over.at.node.id }
    }
    const next = below[0]
    if (next === undefined) return undefined
    return { kind: "after", id: next.at.node.id }
  }
  return undefined
}

/** The ROW-side entry at a wire index, or nothing for a draft — the walk and
 *  the skim both name it, so `findIndex` was a hole the type system knew
 *  nothing about. */
const rowAt = (
  walk: ReadonlyArray<Wire>,
  at: number,
): Extract<Wire, { kind: "row" }> | undefined => {
  const step = walk[at]
  return step?.kind === "row" ? step : undefined
}
