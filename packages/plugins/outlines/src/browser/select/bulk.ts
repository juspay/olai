/**
 * What a bulk verb SENDS: one edit per selected row, in the order that produces
 * the shape a person is asking for.
 *
 * Nothing new crosses the wire. Every verb here is the edit the same key
 * already sends for one row (`../../../surface/src/edit.ts`), repeated — which
 * is exactly what an agent does when it is asked to indent three things, and is
 * the whole of how this feature keeps the consistency rule: a bulk
 * gesture is N calls, not a bulk op the browser can make and MCP cannot.
 *
 * THE ORDER IS THE FEATURE, and it is the only arithmetic in this file. Each
 * edit is judged against what the one before it did (`../edit/queue.ts` runs
 * them one at a time), so "indent these three" is three `move in`s whose
 * meaning depends on the row above each one AS IT THEN STANDS:
 *
 *   - **in / up — drawn order.** Indenting `B, C` of `A, B, C` moves `B` under
 *     `A`; `C`'s row above is then `A` again, so it follows `B` under it. Taken
 *     the other way round, `C` would go under `B` — which is a different shape,
 *     and not the one anybody dragged across three rows to ask for.
 *   - **out / down — reverse.** Outdenting `B, C` of `P > [A, B, C]` puts each
 *     immediately after `P`; done in drawn order, `C` lands between `P` and `B`
 *     and the run comes out backwards. Taken from the bottom, each one lands
 *     above the one already there and the run keeps its order.
 *
 * COMPLETE IS A TOGGLE, per row, because that is what `Ctrl+Enter` is for one
 * row and a bulk key that meant something else would be a second answer to the
 * same chord. A run of rows that are not all in the same state therefore flips
 * each of them, which is what Workflowy does too — the mark is the node's, and
 * nothing here decides on anybody's behalf what a mixed run "really" meant.
 *
 * WHICH ID EACH NAMES is the editor's own rule, unchanged: a MOVE is about the
 * row's own record (so a placement moves as the placement it is), and a MARK is
 * about the node the row SHOWS (so a mirror ticks off its target).
 */

import type { Row } from "@olai/format"
import type { Edit } from "@olai/surface"

/** The verbs a selection answers to. The four moves are the surface's own
 *  `move` words, spelled once; `complete` and `archive` are the two the `•••`
 *  menu already spells for a single row. */
export type Bulk = "complete" | "in" | "out" | "up" | "down" | "trash"

/** Which way the rows are walked. A table rather than a condition in the loop,
 *  so the argument in the header is checkable against the list rather than
 *  reconstructed from an `if`. */
const REVERSED: Record<Bulk, boolean> = {
  complete: false,
  in: false,
  up: false,
  out: true,
  down: true,
  trash: false,
}

/** The node a row draws, or `undefined` for a placement whose chain died or
 *  closed a loop — which has no mark, no title and nothing to archive. */
const shown = (row: Row): string | undefined =>
  row.kind === "node" || row.kind === "mirror" ? row.shows.node.id : undefined

/**
 * The edits, in the order they must be sent.
 *
 * `rows` is what {@link ../select/range.ts}'s `topmost` answered: the selected
 * rows nothing else selected contains, in drawn order. A row this verb has
 * nothing to say about is left out rather than sent as an op that would be
 * refused for asking about nothing — and the one verb where that can hide a
 * gesture (`archive`, which cannot take a placement away) says so on the bar
 * before anybody presses it ({@link archivable}).
 */
export const bulkEdits = (
  verb: Bulk,
  rows: ReadonlyArray<Row>,
): ReadonlyArray<Edit> => {
  const order = REVERSED[verb] ? [...rows].reverse() : rows
  return order.flatMap((row): ReadonlyArray<Edit> => {
    switch (verb) {
      case "in":
      case "out":
      case "up":
      case "down":
        return [{ verb: "move", id: row.at.node.id, how: verb }]
      case "complete": {
        const node = shown(row)
        return node === undefined ? [] : [{ verb: "toggle", id: node, mark: "done" }]
      }
      case "trash": {
        // A MIRROR is left out on purpose, and the bar refuses the whole
        // gesture rather than quietly dropping it ({@link archivable}): the
        // node a placement shows lives somewhere else, so archiving from here
        // would put away a subtree that is not the one being looked at — the
        // same argument the `•••` menu makes for not offering the verb on a
        // mirror at all (`../menu/verbs.ts`).
        const node = row.kind === "node" ? row.shows.node.id : undefined
        return node === undefined ? [] : [{ verb: "trash", id: node }]
      }
    }
  })
}

/** Whether every row in the selection is one this face may put away — a node of
 *  the outline being read, rather than a placement of one that lives elsewhere.
 *  The bar draws the verb only when this holds, and says what is in the way
 *  when it does not, because a Trash button that silently took three of four
 *  rows would be the quiet kind of wrong. */
export const archivable = (rows: ReadonlyArray<Row>): boolean =>
  rows.length > 0 && rows.every((row) => row.kind === "node")
