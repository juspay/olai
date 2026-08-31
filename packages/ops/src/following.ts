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
 * MEANS is `plan.ts`'s, and what a SET is (how decoded files become one, what
 * one file written into it leaves, how a view is patched onto another) is
 * `@olai/format`'s, reached through `following` — that package's door for a
 * caller writing files into a reading it holds, which builds the set and
 * patches the view out of the one list. What is left in this file is the
 * translation between them, which is the only half that is actually this
 * layer's.
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
 * and one parse of that whole file, one SPLICE of that file into the set the op
 * before it left, and one patched view held against the files it wrote. The
 * serialise/parse pair is the dominant term and it is quadratic in the batch
 * against one outline's size — a hundred ops over one large outline is a
 * hundred round trips of it — which is the price of every intermediate being a
 * real set rather than a shortcut. The patched view is cheap only when the
 * batch leaves some file untouched: the patcher declines when nothing of the
 * old view is left to patch onto (`@olai/format`'s `patch`), so a
 * single-outline directory rebuilds its derivation each op. Both are bounded by
 * `BATCH_AT_MOST`, and both are one write's worth of work rather than N
 * writes' worth of disk. WHAT IS NO LONGER IN THAT LIST is a term that scaled
 * with the DIRECTORY rather than with the op — see the second paragraph below.
 *
 * **THE SPLICE USED TO BE AN ASSEMBLY**, and that is what `perf-batch-assemble`
 * took out. This fold took the whole directory APART into a map on its first
 * op and then put it back together on every one — a fresh path SORT of every
 * served file per op, so a hundred-op batch paid for the directory a hundred
 * times, to move one file. The set it starts from is already in path order and
 * an op touches one file or two, so the intermediate is the previous set with
 * those files swapped in (`@olai/format`'s `withDocuments`), which is one pass
 * over an array of references and a binary search per file written. Nothing
 * about the ANSWER moved: the two are held to each other at every op of
 * scripted batches (`./following.equivalence.test.ts`), because a fold that
 * produced a subtly different set would refuse the next op for reasons no
 * reader could find.
 *
 * **AND THE DISAGREEMENT CHECK USED TO WALK THE CORPUS**, which is what
 * `perf-reading-patched-check` took out and is the term that node was filed on.
 * This fold reached its patched view through `@olai/format`'s `reading`,
 * handing it a set it had just spliced and a delta it had just built out of the
 * same files — and that function's guard then walked every record in the
 * directory to check the two agreed. The guard is for a caller whose set and
 * whose delta came from DIFFERENT PLACES (the store's, whose delta is a probe's
 * claim about which files ticked); this loop was its own claimant, so the walk
 * was the fold checking itself, per op, at the size of the vault rather than of
 * the op. `following` is the door that says so: it takes the reading and the
 * files, builds both halves, and holds them together at the paths it wrote.
 * Nothing about the ANSWER moved here either, and it is the same file that says
 * so — the reference arm still comes through `reading` with the full check, and
 * the two are compared view and set at every op.
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
  bodiedDocument,
  type Document,
  following,
  type OpFailure,
  parseOutline,
  serializeOutline,
  ValidationFailure,
  verdictOf,
} from "@olai/format"
import { Result } from "effect"

import { askedOf, carried } from "./asked.ts"
import { type Plan, type Scope, typedIn } from "./plan.ts"

/**
 * The fold over the planner: the reading each op is judged against, carried
 * from the one before it.
 *
 * A CLOSURE rather than a function taking and returning a set, because the set
 * is the thing being carried and a caller that had to thread it would be a
 * caller that could thread the wrong one. It is built from a reading and it
 * answers with readings; what it holds between calls is the inside of exactly
 * one loop.
 */
export type Folding = (made: Plan) => Result.Result<Scope, OpFailure>

export const folding = (from: Scope): Folding => {
  // WHAT IS CARRIED is the last SCOPE this fold produced — and, for the first
  // op, the caller's own, which is why nothing here writes into either
  // (`@olai/format`'s `withDocuments`, reached through `following`, takes the
  // copy). There is nothing to build up front any more: the fold used to invert
  // the directory into a map on its first op, which was a corpus walk a one-op
  // run never had a use for — `folded` breaks before folding the LAST op, so a
  // single-field `update` calls this not at all.
  let at = from
  // THE ASKING, and the two things that carry it. `base` is the context every
  // op looks through — the batch's own first asking, or a fresh one from the op
  // that moved which files there are — and `wrote` is everything this batch has
  // written since that asking, by path. Handing both to {@link carried} is what
  // makes an op's questions about the directory cost a layer lookup rather than
  // a re-asking, and what makes the decline exact: a file MINTED or MENDED
  // moves membership, and membership must reach what carries (#382's lesson).
  let base = from.asked
  let wrote = new Map<string, Document>()

  return (made) => {
    const written: Array<Document> = []
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
            verdict: verdictOf(read.failure),
          }),
        )
      }
      written.push(read.success)
    }
    for (const document of made.documents ?? []) {
      written.push(bodiedDocument(document.file, document.text))
    }

    // THE VIEW PATCHED RATHER THAN DERIVED, and the SET built beside it out of
    // the same list — one call, because they are one sentence. `following` is
    // `@olai/format`'s door for a caller that is WRITING into a reading it
    // holds: it splices these documents into the set (`withDocuments`), patches
    // the view with the records they carry, and holds the two together at the
    // files this op wrote. What it no longer does is walk the corpus to test a
    // delta this loop had built itself — the per-op term `perf-batch-assemble`
    // left standing, and the one `perf-reading-patched-check` took out. The
    // protection did not move: it is the same identity check over the op's own
    // footprint, and a disagreement still costs the same rebuild.
    const next = following(at, written)

    // The layer grows by what this op wrote, and the context is carried onto the
    // new set — or, where that op moved which files there are, the base becomes
    // this set's own asking and the layer starts again empty. Either way the
    // next op reads through ONE layer.
    //
    // A FRESH MAP rather than a write into the one the last op's context is
    // holding, which is the aliasing law and not an economy (#392): the scope
    // handed to op three is a value, and op four writing through its layer would
    // move an answer somebody already has. It costs a copy of what this BATCH
    // has touched — one entry per file, not per record — and it is what makes
    // every intermediate context safe to keep.
    wrote = new Map(wrote)
    for (const document of written) wrote.set(document.path, document)
    const asked = carried(base, next.set, wrote)
    if (asked === undefined) {
      base = askedOf(next.set)
      wrote = new Map()
    }
    // `typed` is REBUILT rather than carried, where `asked` above is carried:
    // it is a map read off the view this op would leave, and a batch whose
    // first op declares a key has to be judged by its second against that
    // declaration ({@link ../plan.ts}'s `typedIn`).
    at = {
      ...next,
      context: at.context,
      asked: asked ?? base,
      // The VOCABULARY is carried, where the typing is rebuilt: what a plugin
      // taught this vault is a fact about the process and no write can move it,
      // so it comes off the scope this batch started with.
      typed: typedIn(next, at.typed.kinds),
    }
    return Result.succeed(at)
  }
}
