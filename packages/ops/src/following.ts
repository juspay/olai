/**
 * The set as it reads AFTER a plan — what makes a batch a fold rather than a
 * second planner.
 *
 * {@link ./plan.ts} answers one request against one {@link Reading}, and every
 * refusal it makes is a statement about that reading: which ids exist, what
 * stands above a landing, which row a node is first in. A batch has to ask
 * those questions of the set the ops BEFORE it left behind — otherwise the
 * second op of `[add {id: "step"}, after {id: "x", add: ["step"]}]` refuses an
 * id the first one just minted, and "each op sees what the ops before it did"
 * is prose the code does not keep.
 *
 * So this is the missing half: a plan in, the reading it produces out, and the
 * next op planned against that. No rule of the format lives here — what a plan
 * MEANS is `plan.ts`'s, and what a SET is (how decoded files become one, how
 * one is taken back apart, how a view is patched onto another) is
 * `@olai/format`'s, reached through `assemble`, `apart` and `reading`. What is
 * left in this file is the translation between them, which is the only half
 * that is actually this layer's.
 *
 * **IT GOES THROUGH THE WRITER AND THE PARSER, deliberately, and there are two
 * reasons rather than the one it is easy to remember.** A plan is whole RECORDS
 * with no `file:line` on them — a `Node`, not a `Located` — and line numbers
 * are not decoration in this format: siblings with equal `ord` break their tie
 * on the line they sit on, and every refusal names one. That is the first. The
 * second is NORMALISATION, and it is the one a shortcut would trip over: the
 * records a planner builds are drafts, and a draft may spell something the file
 * cannot hold — an empty `custom` map, a field the writer omits — so the record
 * an op two would be judged against has to be the record the parser produces
 * from the bytes, not the draft that produced them. Serialising through the
 * format's own writer and reading the result back is exactly what the store
 * does after a rename, so the reading op two sees is the reading it would have
 * seen had op one been its own call and its own commit.
 *
 * **WHAT IT COSTS, honestly.** Per op, per file that op TOUCHED: one serialise
 * and one parse of that whole file, one `assemble` of the directory, and one
 * patched view. The serialise/parse pair is the dominant term and it is
 * quadratic in the batch against one outline's size — a hundred ops over one
 * large outline is a hundred round trips of it — which is the price of every
 * intermediate being a real set rather than a shortcut. The patched view is
 * cheap only when the batch leaves some file untouched: the patcher declines
 * when nothing of the old view is left to patch onto (`@olai/format`'s
 * `patch`), so a single-outline directory rebuilds its derivation each op. Both
 * are bounded by `BATCH_AT_MOST`, and both are one write's worth of work rather
 * than N writes' worth of disk.
 *
 * **WHAT IT DOES NOT DO IS VALIDATE**, and that is the batch's whole shape: one
 * validation pass over the set the LAST op leaves, run where every write is
 * validated (`@olai/store`'s gate, through `./codec.ts`). An intermediate set is
 * a state no reader ever sees and no file ever holds, so validating each of them
 * would be N whole-corpus checks to reject something the final check either
 * catches or was never true of. The planner's own refusals still run per op, in
 * order, which is what makes a bad batch fail at an INDEX rather than as one
 * illegible report about a file nobody wrote.
 */

import {
  apart,
  assemble,
  bodiedDocument,
  type Document,
  type OpFailure,
  type OutlineError,
  parseOutline,
  type Reading,
  reading,
  serializeOutline,
  type SetDelta,
  ValidationFailure,
} from "@olai/format"
import { Result } from "effect"

import type { Plan } from "./plan.ts"

/** One decoded file, as `assemble` takes it. Spelled once because the map this
 *  module carries between ops is a map of them. */
type Decoded = Result.Result<Document, ReadonlyArray<OutlineError>>

/**
 * The fold over the planner: the reading each op is judged against, carried
 * from the one before it.
 *
 * A CLOSURE rather than a function taking and returning a map, because the map
 * is the thing being carried and a caller that had to thread it would be a
 * caller that could thread the wrong one. It is built from a reading and it
 * answers with readings; what it holds between calls is the inside of exactly
 * one loop.
 */
export type Folding = (made: Plan) => Result.Result<Reading, OpFailure>

export const folding = (from: Reading): Folding => {
  // LAZY, and that is not a micro-optimisation: `folded` breaks before folding
  // the LAST op — nothing is judged against the set it leaves — so a one-op run
  // never calls this at all. A single-field `update` is exactly such a run, and
  // it is a gesture an agent makes constantly; taking the directory apart for
  // it would be a corpus walk to build a value nobody reads.
  let files: Map<string, Decoded> | undefined
  let at = from

  return (made) => {
    files ??= apart(at.set)
    const upserts: Array<SetDelta["upserts"][number]> = []
    for (const planned of made.files) {
      const text = serializeOutline(planned.nodes)
      const read = parseOutline(planned.file, text)
      if (Result.isFailure(read)) {
        // Unreachable through any request: these records came out of the
        // planner and went through the format's own writer, so a file that
        // does not parse back is a defect in one of those two rather than
        // anything a caller sent. It is a refusal and not a throw because the
        // batch's promise is that nothing lands — a defect that took the
        // process down would be a promise kept the expensive way — and it
        // carries the parser's own rows so the defect is diagnosable.
        return Result.fail(
          new ValidationFailure({
            reason:
              `\`${planned.file}\` did not read back after being planned, so the ` +
              `batch was abandoned and nothing was written. This is a defect in ` +
              `olai rather than in the call.`,
            errors: read.failure,
          }),
        )
      }
      files.set(planned.file, Result.succeed(read.success))
      upserts.push([planned.file, { nodes: read.success.nodes }])
    }
    for (const document of made.documents ?? []) {
      files.set(document.file, Result.succeed(bodiedDocument(document.file, document.text)))
    }

    // The view PATCHED rather than derived — reached through `reading`, which
    // is the patcher plus the disagreement check `validate` makes, so this
    // caller cannot forget the half that turns a delta which missed a file into
    // a rebuild instead of into a view where every record looks like a
    // duplicate of itself.
    at = reading(assemble(files), { read: at, delta: { upserts, removes: [] } })
    return Result.succeed(at)
  }
}
