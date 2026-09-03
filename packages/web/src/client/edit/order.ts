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

import { foldIdOf } from "../fold/rows.ts"
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
 */
export type Wire =
  | { readonly kind: "row"; readonly row: Row }
  | { readonly kind: "draft"; readonly pending: Pending }

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
  if (drafts.length === 0) return flatten(rows, collapsed).map((row) => ({ kind: "row" as const, row }))
  const keyed = new Map<string, Pending[]>()
  const slot = (under: string, draft: Pending) => {
    const at = keyed.get(under) ?? []
    at.push(draft)
    keyed.set(under, at)
  }
  for (const draft of drafts) {
    const at = draft.at
    slot(
      at.kind === "first" ? "first"
        : at.kind === "before" ? `b:${at.id}`
        : at.kind === "after" ? `a:${at.id}`
        : `u:${at.id}`,
      draft,
    )
  }
  const out: Array<Wire> = []
  const lay = (level: ReadonlyArray<Row>): void => {
    for (const row of level) {
      const id = row.at.node.id
      for (const draft of keyed.get(`b:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft })
      }
      out.push({ kind: "row", row })
      for (const draft of keyed.get(`u:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft })
      }
      if (!collapsed.has(foldIdOf(row))) lay(row.children)
      for (const draft of keyed.get(`a:${id}`) ?? []) {
        out.push({ kind: "draft", pending: draft })
      }
    }
  }
  for (const draft of keyed.get("first") ?? []) {
    out.push({ kind: "draft", pending: draft })
  }
  lay(rows)
  return out
}
