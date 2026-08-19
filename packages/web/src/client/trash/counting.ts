/**
 * How much is in the Trash — asked of the SET, which is the only place it can
 * honestly be asked.
 *
 * This is `../menu/subtree.ts`'s `under` one page along, and it exists for that
 * function's reason rather than for tidiness: what a person is being asked to
 * agree to must be what the write moves, and the rows on screen are not that.
 * They differ here for TWO independent reasons, either of which alone would
 * make a count read off the page an understatement:
 *
 *   - the filter box narrows this page like any other (`../filter/`), so a
 *     query typed in the Trash takes rows out of what is drawn while taking
 *     nothing out of the archive;
 *   - a MIRROR inside an archive draws the children of the node it shows, and
 *     those are records of some live outline rather than of this pile. Counting
 *     rows would count them, and emptying the Trash does not touch them.
 *
 * So it counts RECORDS, per file, over every archive the directory holds —
 * including the ones a filter has emptied, and including the archive's own
 * signpost titles, which are records the write deletes and rows a reader can
 * see.
 *
 * Pure over its two inputs, so the thing most easily got wrong — a sentence
 * that promises less than it does — is a unit test rather than a browser
 * gesture nobody repeats.
 */

import { type Derived, nodesOf } from "@olai/format"

export const inTrash = (
  derived: Derived,
  /** Every archive the directory holds, in path order — the page model's own
   *  list (`../page.ts`), which is a fact about the DIRECTORY and so is not
   *  narrowed by anything. */
  files: ReadonlyArray<string>,
): number => files.reduce((count, file) => count + nodesOf(derived, file).length, 0)
