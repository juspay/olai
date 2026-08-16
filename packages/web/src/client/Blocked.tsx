/**
 * What a node is waiting on, named in full — the `after` edges of the node
 * whose page you are reading.
 *
 * Blockedness is DERIVED (`@olai/format`'s `blocked` index): `a after b` holds
 * `a` up while `b` is a task that is not done, an unmarked target never blocks
 * because it is not work, and nothing about any of it is stored. So this
 * component looks nothing up — it draws the answer the page was already
 * handed, the same way the mark column draws a status.
 *
 * ROWS SAY IT DIFFERENTLY, and that is the split (resolved 2026-08-11, human):
 * a tree row is a title in a column of titles, so what it can afford is one
 * glyph in the mark column (`./marks.tsx`) plus the dimming of the row —
 * enough to sort the row, with the names an `aria-label`, a tip and a click
 * away. The page is where the node is READ, so it answers "waiting on what?"
 * outright, in the order the format promises, with every blocker at its own
 * address. That shape is not this file's: a labelled row of links to nodes is
 * what `see` draws too, and it is ./NodeRefs.tsx.
 *
 * Drawn nowhere at all when nothing is in the way, which is nearly every node.
 */

import type { InTheWay } from "@olai/format"

import { NodeRefs } from "./NodeRefs.tsx"
import { TESTID } from "./testids.ts"

export function Blocked(props: {
  /** What the node is waiting on, in the format's promised order. Empty is the
   *  usual answer, and draws nothing. */
  readonly blocked: ReadonlyArray<InTheWay>
}) {
  return (
    <NodeRefs
      label="blocked by"
      refs={props.blocked.map((one) => ({
        id: one.at.node.id,
        title: one.at.node.title,
        from: one.at.file,
      }))}
      testid={TESTID.blocked}
    />
  )
}
