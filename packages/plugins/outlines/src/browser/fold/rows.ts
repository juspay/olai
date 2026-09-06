/**
 * What a fold is OF.
 *
 * A row is a PLACE — `Row.key` is the slash-joined chain of records above it
 * (`@olai/format`'s `derive.ts`) — and folding used to be keyed by that. Three
 * things follow from a place key that are all wrong for a fold somebody wants
 * kept: it changes when the node moves, it is a different string on a zoomed
 * page than on the whole outline (the walk under a node seeds the chain with
 * `""`), and two mirrors of one node are two of them.
 *
 * So a fold is of the NODE, and of the node a row SHOWS rather than the record
 * that stands there — which is the 2026-08-13 ruling, and it is what makes
 * every mirror of a node fold with it wherever the node appears. A row that
 * shows nothing (a mirror whose chain died, one that closed a loop) folds by
 * its own record: it has no children either way, so nothing ever asks, and a
 * total function beats a case the callers have to remember.
 *
 * The FILE travels with the id, because the memory is scoped by file
 * (./memory.ts) and it is the file the node is DEFINED in — not the one being
 * read. Folding a mirror of `herbs` while reading `house.olai` is a fact about
 * `garden.olai`, where `herbs` lives, and storing it under the page's file
 * would be the same node folded twice under two names.
 */

import { type Row, shownRecord } from "@olai/format"

/** One node's fold: which node, and which file says so. */
export interface Fold {
  readonly id: string
  /** The file the node is DEFINED in — `shows.file`, not the page's. */
  readonly file: string
}

/** The id a row folds by. Its own function because the walk that flattens a
 *  drawn page (`../edit/order.ts`) asks it of every row and wants no object
 *  for the answer.
 *
 *  WHICH RECORD that is comes from the format (`shownRecord`): what a row
 *  shows, or — for a row that shows nothing — its own. This module had that
 *  rule to itself until the FILTER needed the same one (a mirror of a matching
 *  node matches, wherever it is drawn), and two spellings of it would be two
 *  answers about the same row the day a fourth `kind` arrives. */
export const foldIdOf = (row: Row): string => shownRecord(row).node.id

/** The whole fold of a row — what a WRITE needs, which is the id and the file
 *  it is remembered under. */
export const foldOf = (row: Row): Fold => {
  const record = shownRecord(row)
  return { id: record.node.id, file: record.file }
}

/** Every fold under `row` (including `row` itself) that has children to hide or
 *  show — what "Collapse all" / "Expand all" name. Leaves are skipped: there is
 *  nothing for a fold to do.
 *
 *  Deduplicated, because the same node can stand in two places under one row
 *  (a mirror beside its target) and one node has one fold. */
export const foldsUnder = (row: Row): ReadonlyArray<Fold> => {
  const out: Fold[] = []
  const seen = new Set<string>()
  const walk = (here: Row): void => {
    if (here.children.length > 0) {
      const fold = foldOf(here)
      if (!seen.has(fold.id)) {
        seen.add(fold.id)
        out.push(fold)
      }
    }
    for (const child of here.children) walk(child)
  }
  walk(row)
  return out
}
