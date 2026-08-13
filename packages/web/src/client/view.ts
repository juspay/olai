/**
 * How this tab is reading THIS PAGE, as opposed to what the files say.
 *
 * One switch, and it is here rather than on the wire for the reason every
 * client-local value is: it belongs to a reading rather than to the outline,
 * none of it goes to the server, and hiding what is done is a row not drawn
 * rather than anything marked. Two readers looking at the same node see the
 * same outline and may read it differently.
 *
 * WHAT IS FOLDED USED TO BE THE OTHER ONE, and its leaving is the shape of this
 * file. Folding was a fresh set per route — so zooming in and back, or
 * reloading, opened everything again. The argument was that a page you zoom
 * into is a new thing to read; the answer (2026-08-13, human) is that real
 * outlines have big trees, and re-collapsing them on every visit is a bug and
 * not a doctrine. A fold is a preference of this browser now
 * (`./fold/memory.ts`), and deliberately NOT a member here: what is folded
 * outlives every page, so the rows that draw it read that memory itself —
 * exactly as the directory's folders do (`./Sidebar.tsx`), and as the theme and
 * the panel widths are read wherever they are wanted. A wrapper on this object
 * would be a second conduit for one mechanism, and a per-page holder standing
 * in front of a browser-wide fact is the shape that invites a copy of it.
 *
 * So what is left is the Done switch, and it is a page's for a reason the fold
 * turns out not to share: whether you want to look at finished work AT ALL is a
 * fact about the READER, so the page holds `undefined` until somebody presses
 * the switch on it and `undefined` reads `settings/done.ts`. Changing the
 * preference therefore moves every page nobody has pressed it on, including
 * this one, and leaves the pages somebody has exactly as they left them. That
 * is what `createStamped` (./stamped.ts) is holding — a value that starts over
 * when the page does, with no effect watching the route and so no frame in
 * which the held value and the open page disagree.
 *
 * Notes are not a reading switch either. Every row draws one way (one dim
 * clamped line under the title; click or tap expands in place, click again or
 * away collapses) — see Tree.tsx and day/DayNode.tsx. There is no density cell
 * and no per-place unfold set.
 */

import type { Row } from "@olai/format"
import { withoutDone } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import { hrefOf, type Route } from "./routes.ts"
import { doneHiddenDefault } from "./settings/done.ts"
import { createStamped } from "./stamped.ts"

export interface View {
  readonly doneHidden: Accessor<boolean>
  readonly toggleDone: () => void
  /** The rows this reading actually draws. The switch and what it does to a
   *  tree are one thing, so every page asks the same question rather than each
   *  re-deciding what "hidden" means. */
  readonly visible: (rows: ReadonlyArray<Row>) => ReadonlyArray<Row>
}

export const createView = (route: Accessor<Route>): View => {
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
    doneHidden,
    // Pressed against what is ON SCREEN — the memo above, not the reading it
    // is derived from.
    toggleDone: () => reading.set(!doneHidden()),
    visible: (rows) => doneHidden() ? withoutDone(rows) : rows,
  }
}
