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
 * MEANS is `plan.ts`'s and what a set IS is `@olai/format`'s; this only puts
 * the two together the way the write path already does.
 *
 * **IT GOES THROUGH THE WRITER AND THE PARSER, deliberately, and that is the
 * one line worth defending.** A plan is whole RECORDS with no `file:line` on
 * them — a `Node`, not a `Located` — and line numbers are not decoration in
 * this format: siblings with equal `ord` break their tie on the line they sit
 * on, and every refusal names one. Making up line numbers here would make a
 * batch place a node somewhere a sequence of single calls would not. Serialising
 * through the format's own writer and reading the result back with the format's
 * own parser is exactly what the store does after a rename, so the reading an
 * op two sees is the reading it would have seen had op one been its own call
 * and its own commit. The round trip costs one serialise and one parse per
 * TOUCHED FILE per op, which is what a batch is buying its way out of paying
 * thirteen times over on the disk.
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
  assemble,
  type DecodedFile,
  type Located,
  type OpFailure,
  type OutlineError,
  parseOutline,
  patch,
  type Reading,
  serializeOutline,
  type SetDelta,
  ValidationFailure,
} from "@olai/format"
import { Result } from "effect"

import type { Plan } from "./plan.ts"

/** One decoded file, as `assemble` takes it. Spelled once because the map this
 *  module rebuilds is a map of them. */
type Decoded = Result.Result<DecodedFile, ReadonlyArray<OutlineError>>

/**
 * A set taken back APART into the per-file map `assemble` puts together.
 *
 * The inverse of `@olai/format`'s `assemble`, and written against it rather
 * than against a memory of it: a broken file keeps its place in `files` or in
 * `documents` AND is listed in `broken`, so the broken paths are read first and
 * the two lists below skip whatever they already answered. Getting that
 * backwards would hand a plan's fold an outline whose unreadable half had
 * quietly become an empty one.
 */
const apart = (at: Reading): Map<string, Decoded> => {
  const files = new Map<string, Decoded>()
  const torn = new Set<string>()
  for (const file of at.set.broken) {
    torn.add(file.file)
    files.set(file.file, Result.fail(file.errors))
  }
  // The records grouped back by the file each one already names. `Located`
  // carries its own path, so this is a regrouping rather than a guess, and the
  // order within a file is the set's own (line order, as assembled).
  const nodes = new Map<string, Array<Located>>()
  for (const located of at.set.nodes) {
    const held = nodes.get(located.file)
    if (held === undefined) nodes.set(located.file, [located])
    else held.push(located)
  }
  for (const file of at.set.files) {
    if (torn.has(file)) continue
    files.set(file, Result.succeed({ file, nodes: nodes.get(file) ?? [] }))
  }
  for (const document of at.set.documents) {
    if (torn.has(document.file)) continue
    files.set(document.file, Result.succeed(document))
  }
  return files
}

/**
 * A fold over the planner: the reading each op is judged against, carried from
 * the one before it.
 *
 * A CLASS-LESS object with one method rather than a function taking and
 * returning a map, because the map is the thing being carried and a caller that
 * had to thread it would be a caller that could thread the wrong one. It is
 * built from a reading and it answers with readings, so what it holds between
 * calls is an implementation detail of exactly one loop.
 */
export interface Folding {
  /** The reading that plan leaves behind, or the one refusal below. */
  readonly following: (made: Plan) => Result.Result<Reading, OpFailure>
}

export const folding = (from: Reading): Folding => {
  const files = apart(from)
  let at = from

  return {
    following: (made) => {
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
        files.set(document.file, Result.succeed({ file: document.file, text: document.text }))
      }

      // PATCHED rather than derived: the view the next op is judged against
      // differs from this one by the files this op touched, which is the exact
      // shape the format's patcher takes — and it is held to `derive` by that
      // module's own property test, so a fold of thirteen ops does not walk the
      // corpus thirteen times to learn what it already knew.
      at = {
        set: assemble(files),
        derived: patch(at.derived, { upserts, removes: [] }),
      }
      return Result.succeed(at)
    },
  }
}
