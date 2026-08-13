/**
 * How this tab is reading, as opposed to what the files say.
 *
 * Two switches so far — what is folded, and whether done nodes are drawn — and
 * they have the same nature: they belong to a reading, not to the outline. None
 * goes to the server, none is written to disk, and hiding what is done is a row
 * not drawn rather than anything marked. Two readers looking at the same node
 * see the same outline and may fold it differently, which is why this is
 * client-local rather than a cell on the wire.
 *
 * WHAT THEY DO NOT SHARE is how long they last, and that is this file's shape.
 *
 * Folding used to belong to the PAGE — a fresh set per route, so zooming in and
 * back, or reloading, opened everything again. The argument was that a page you
 * zoom into is a new thing to read; the answer (2026-08-13, human) is that real
 * outlines have big trees, and re-collapsing them on every visit is a bug and
 * not a doctrine. So a fold is a preference of this browser now, kept by node
 * id in `./fold/memory.ts`, and this file only spends it. Nothing else about
 * folding is decided here — not the key, not the storage, not the pruning —
 * because a reading that held its own copy would be a second answer to "is this
 * folded" free to disagree with the stored one.
 *
 * The Done switch is still a page's, and it is the one thing `createStamped`
 * (./stamped.ts) is still holding for this view: whether you want to look at
 * finished work AT ALL is a fact about the reader, so the page holds
 * `undefined` until somebody presses the switch on it and `undefined` reads
 * `settings/done.ts`. Changing the preference therefore moves every page nobody
 * has pressed it on, including this one, and leaves the pages somebody has
 * exactly as they left them.
 *
 * Notes are not a reading switch. Every row draws one way (one dim clamped
 * line under the title; click or tap expands in place, click again or away
 * collapses) — see Tree.tsx and day/DayNode.tsx. There is no density cell and
 * no per-place unfold set.
 */

import type { Derived, Row } from "@olai/format"
import { withoutDone } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import { collapsedNodes, setFolded } from "./fold/memory.ts"
import type { Fold } from "./fold/rows.ts"
import { hrefOf, type Route } from "./routes.ts"
import { doneHiddenDefault } from "./settings/done.ts"
import { createStamped } from "./stamped.ts"

export interface View {
  /** The nodes the reader has folded, by NODE ID (`./fold/rows.ts`) — so a
   *  fold survives a move, a zoom and a reload, and every mirror of a node is
   *  folded wherever the node appears. */
  readonly collapsed: Accessor<ReadonlySet<string>>
  readonly toggle: (fold: Fold) => void
  /** Fold every named node. Used by the row menu's "Collapse all". */
  readonly collapseAll: (folds: ReadonlyArray<Fold>) => void
  /** Unfold every named node. Used by the row menu's "Expand all". */
  readonly expandAll: (folds: ReadonlyArray<Fold>) => void
  readonly doneHidden: Accessor<boolean>
  readonly toggleDone: () => void
  /** The rows this reading actually draws. The switch and what it does to a
   *  tree are one thing, so every page asks the same question rather than each
   *  re-deciding what "hidden" means. */
  readonly visible: (rows: ReadonlyArray<Row>) => ReadonlyArray<Row>
}

/**
 * `live` is the set as this browser currently has it, and it is here for one
 * reason: a fold that names a node nobody serves any more is dropped as it is
 * written (`./fold/memory.ts`), and the derivation is what knows which those
 * are. Passed in rather than read from a context because a view is made once,
 * beside the subscription, before there is a tree to reach through.
 */
export const createView = (
  route: Accessor<Route>,
  live: Accessor<Derived | undefined>,
): View => {
  /** `undefined` is "nobody has pressed the switch on this page", which is a
   *  different fact from "shown" and is what defers to the preference. */
  const reading = createStamped(
    () => hrefOf(route()),
    (): boolean | undefined => undefined,
  )

  /** What this page was told, or — on a page nobody has told anything — the
   *  preference. The ONE statement of that rule: pressing the switch is a
   *  negation of this memo rather than of the reading behind it, because
   *  `!undefined` is "hidden" for a reader whose preference already is, which
   *  is a switch whose first press does nothing. */
  const doneHidden = createMemo(() => reading.value() ?? doneHiddenDefault())

  return {
    collapsed: collapsedNodes,
    // Pressed against what is FOLDED, which is the memory rather than anything
    // held here: the row asking was drawn from the same set, and a toggle that
    // read a second copy could disagree with the triangle that was clicked.
    toggle: (fold) => setFolded([fold], !collapsedNodes().has(fold.id), live()),
    collapseAll: (folds) => setFolded(folds, true, live()),
    expandAll: (folds) => setFolded(folds, false, live()),
    doneHidden,
    // Pressed against what is ON SCREEN — the memo above, not the reading it
    // is derived from.
    toggleDone: () => reading.set(!doneHidden()),
    visible: (rows) => doneHidden() ? withoutDone(rows) : rows,
  }
}
