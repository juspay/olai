/**
 * What a write CHANGED, in one word — classified by the same function the
 * commit panel's rows are.
 *
 * A write that landed already answers `id`, `title`, `file` and a `summary`,
 * and none of those says what KIND of change it was: `done: fix the sink` is
 * the commit convention's phrasing, not a value anything can switch on. The
 * chat panel needs the switchable one, because a transcript row about an olai
 * write is never a text diff — a `.jsonl` diff is one enormous line, which is
 * the commit panel's own rule — and what it shows instead is the node-level
 * story in the vocabulary that already exists (*marked done*, *note rewritten*,
 * *moved*).
 *
 * So it is DERIVED rather than tabulated. A table from op name to {@link Sort}
 * would be a second classification of the same events, free to disagree with
 * `changesOf` the day either moves — and it would have to re-answer questions
 * the comparison already answers from the records: an `undo` that takes a mark
 * off, a `set_date` clearing one, a `create` whose seed captured a subtree. The
 * two readings this compares are the set the write was planned against and the
 * records the plan will write, which are both in hand at the moment the reply
 * is assembled and cost one pass over the touched files.
 *
 * When several nodes moved, the word is the one about the node the write was
 * ABOUT — the `id` the reply already names — and {@link biggestOf}'s fixed
 * priority is the fallback for the writes where nothing matches it. That order
 * is deliberate: archiving plans a dated bucket in the archive as well as the
 * subtree that goes into it, so the biggest change alone reads *created* about
 * a write whose whole point was to take something away.
 */

import {
  biggestOf,
  changesOf,
  type Node,
  type OutlineSet,
  type Sort,
} from "@olai/format"

import type { FilePlan } from "./plan.ts"

/**
 * The one word for what this plan does to that set, or `undefined` when it does
 * nothing at all.
 *
 * `undefined` is a real answer and not a failure: a `set_done` on a node that
 * is already done plans a file whose records are identical, which is a write
 * that landed and changed nothing. Saying *edited* there would be inventing a
 * change to report.
 *
 * Only the files the plan TOUCHES are compared, which is what keeps this a pass
 * over one or two outlines rather than over the corpus. That is sound because
 * the only op that moves a node between files is `archive`, and it plans both
 * ends — so a node that left one file is matched to the record that arrived in
 * the other, and reads as *archived* rather than as a departure and an unrelated
 * arrival.
 */
export const sortOfWrite = (
  before: OutlineSet,
  files: ReadonlyArray<FilePlan>,
  /** The node the write was about, so the word is about it rather than about
   *  whatever else the same plan touched. */
  about: string,
): Sort | undefined => {
  const touched = new Set(files.map((planned) => planned.file))
  const was = new Map<string, Array<Node>>()
  for (const located of before.nodes) {
    if (!touched.has(located.file)) continue
    const nodes = was.get(located.file)
    if (nodes === undefined) was.set(located.file, [located.node])
    else nodes.push(located.node)
  }
  const now = new Map(files.map((planned) => [planned.file, planned.nodes]))
  const changes = changesOf(was, now)
  return (changes.find((change) => change.id === about) ?? biggestOf(changes))?.sort
}
