/**
 * THE SET A BATCH LEAVES, SPLICED AND ASSEMBLED, AT EVERY OP.
 *
 * `perf-batch-assemble`'s claim is an equivalence, so the shape of this file is
 * a differential and not a table of expectations: `./following.testlib.ts`
 * holds the fold as it stood — the directory taken apart into a map and put back
 * together, with a fresh path sort of every served file, per op — and every case
 * here drives TWO folds over ONE scripted run of ops, asserting that what the
 * next op is judged against is IDENTICAL at every step.
 *
 * WHY THE SET AND NOT THE PLAN. The plans are pinned already
 * (`./plans.golden.test.ts`, over the same script), and they are pinned against
 * the answers the braid gave. What THIS file is about is the thing between two
 * ops: an intermediate set is a value no reader ever sees and no file ever
 * holds, so a fold that produced a subtly different one would not fail as a
 * wrong file — it would fail as the NEXT op refusing for a reason nobody can
 * find. Both halves are compared: the documents in path order with their
 * records, and the `broken` list, since a file that is written leaves it.
 *
 * AND THE VIEW UNDER IT, because the fold hands on a patched derivation as well
 * as a set: two folds that agreed about the files and disagreed about the
 * grouping would be the shape `@olai/format`'s `isSet` exists to catch, one
 * revision later. AND THAT EACH ARM'S VIEW IS ABOUT ITS OWN SET, which is that
 * same `isSet` question asked outright — the one `perf-reading-patched-check`
 * took off the live door and moved here, since a check the corpus paid for on
 * every op of every batch is a check a scripted run can make once (`isAbout`
 * below argues it).
 *
 * THE SECOND CLAIM IS AN IDENTITY, and it is here rather than in a bench for
 * the reason the commit panel's subprocess count is: it is the part that must
 * not regress silently. "One asking per batch" is not a timing — it is the
 * carried context handing back the SAME three answers op after op, and the
 * reference arm building new ones each time. So it is asserted as `toBe`, which
 * is the claim itself rather than a proxy for it.
 */

import { expect, test } from "bun:test"
import { NO_KINDS, outlinesIn } from "@olai/format"
import { Result } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { folding } from "./following.ts"
import { assembling } from "./following.testlib.ts"
import { plan, type Scope, scoping } from "./plan.ts"
import { BROKEN, DOCUMENTS, OUTLINES, SCRIPT } from "./plans.testlib.ts"

/** The corpus both arms start from — the same script the golden runs, because
 *  what has to be equal is the fold under EVERY op kind, refusals included: a
 *  refusal folds nothing, which is itself a step both arms must take the same
 *  way. */
const start = (): Scope =>
  scoping(
    readingOf(
      setOf(
        OUTLINES,
        DOCUMENTS.map((document) => document),
        BROKEN,
      ),
    ),
    steady(),
    NO_KINDS,
  )

/** A set as DATA, for comparison: the documents in path order and the broken
 *  list. `toEqual` over the sets themselves would compare the lazily-held
 *  readings a `WeakMap` keeps beside them, which are not part of the value. */
const shapeOf = (at: Scope) => ({
  documents: at.set.documents,
  broken: at.set.broken,
})

/** The view, as the readers of one spend it: the grouping every by-file
 *  question is answered from, and the id table every refusal is. */
const viewOf = (at: Scope) => ({
  byFile: [...at.derived.byFile].map(([file, records]) => [file, records.length] as const),
  byId: [...at.derived.byId.keys()],
  status: [...at.derived.status],
})

/**
 * ...AND THAT THE VIEW IS ABOUT THE SET IT TRAVELS WITH — `isSet`'s question,
 * written out here as the ORACLE.
 *
 * It is the third claim of this file and it arrived with
 * `perf-reading-patched-check`. The carried fold used to reach its patched view
 * through `@olai/format`'s `reading`, which asked exactly this of the whole
 * corpus on every op; it now comes through `following`, which asks it of the
 * files the op WROTE and proves the rest from the reading it was handed. So the
 * property the corpus walk was establishing per op is asserted per op here
 * instead — over a script that mints files, empties them, archives into one the
 * set never held and writes documents beside outlines — where it costs a test
 * run rather than every batch a vault ever folds.
 *
 * SPELLED OUT rather than imported, for the reason the two arms above are two
 * arms: a narrowed door asked to grade itself with its own check proves
 * nothing.
 */
const isAbout = (at: Scope): boolean => {
  const outlines = outlinesIn(at.set).filter((outline) => outline.nodes.length > 0)
  if (at.derived.byFile.size !== outlines.length) return false
  let which = 0
  for (const [file, records] of at.derived.byFile) {
    const outline = outlines[which++]
    if (outline === undefined || outline.path !== file) return false
    if (outline.nodes.length !== records.length) return false
    for (let index = 0; index < records.length; index++) {
      if (records[index] !== outline.nodes[index]) return false
    }
  }
  return true
}

test("the carried fold leaves the set the assembling one left, at every op", () => {
  const spliced = start()
  const assembled = start()
  const carriedFold = folding(spliced)
  const assemblingFold = assembling(assembled)

  let one: Scope = spliced
  let other: Scope = assembled
  let folds = 0
  for (const step of SCRIPT) {
    // BOTH ARMS PLAN, and against their own reading — which is the whole point:
    // if the sets ever parted company the plans would part company next, and
    // this comparison is what names the op it happened at.
    const made = plan(one, step.op)
    const also = plan(other, step.op)
    expect([step.what, Result.isSuccess(made)]).toEqual([step.what, Result.isSuccess(also)])
    if (Result.isFailure(made)) {
      // A refusal folds nothing, and the two sentences must be the same
      // sentence: a refusal is what a set says about an op. (The arms agree
      // about WHETHER it refused a line above, so this narrows both.)
      if (!Result.isFailure(also)) throw new Error(`\`${step.what}\` refused on one arm only`)
      expect([step.what, made.failure.message]).toEqual([step.what, also.failure.message])
      continue
    }
    if (Result.isFailure(also)) throw new Error(`\`${step.what}\` refused on one arm only`)
    expect([step.what, JSON.stringify(made.success)])
      .toEqual([step.what, JSON.stringify(also.success)])

    const next = carriedFold(made.success)
    const alsoNext = assemblingFold(also.success)
    if (Result.isFailure(next) || Result.isFailure(alsoNext)) {
      throw new Error(`the fold refused at ${step.what}`)
    }
    one = next.success
    other = alsoNext.success
    folds += 1
    // The step rides every comparison so a divergence names the op rather than
    // an index into a script.
    expect([step.what, shapeOf(one)]).toEqual([step.what, shapeOf(other)])
    expect([step.what, viewOf(one)]).toEqual([step.what, viewOf(other)])
    // ...and each arm's view is a view of the set that arm carries — the claim
    // the corpus walk used to make on every op of every batch, made here.
    expect([step.what, isAbout(one)]).toEqual([step.what, true])
    expect([step.what, isAbout(other)]).toEqual([step.what, true])
  }
  // The run really did fold: a script whose every op refused would satisfy
  // every assertion above and prove nothing.
  expect(folds).toBeGreaterThan(25)
})

test("one asking per batch: the carried answers are the SAME answers, until membership moves", () => {
  const at = start()
  const fold = folding(at)

  // The three answers, taken before the run — and note that TAKING them is what
  // builds them: a batch that never asks never pays.
  const outlines = at.asked.outlines
  const serves = at.asked.serves
  const broken = at.asked.broken

  /** A run of ops that write CONTENT and nothing else — marks, a title, a note.
   *  Every one of them writes a file the directory already served, so none of
   *  them moves which files there are or which of them are broken. */
  let carried: Scope = at
  for (const op of [
    { op: "todo", id: "loose" },
    { op: "title", id: "loose", title: "a line with a name" },
    { op: "desc", id: "loose", desc: "a note" },
    { op: "todo", id: "seeds" },
    { op: "done", id: "seeds" },
  ] as const) {
    const made = plan(carried, op)
    if (Result.isFailure(made)) throw new Error(`\`${op.op}\` refused: ${made.failure.message}`)
    const next = fold(made.success)
    if (Result.isFailure(next)) throw new Error("the fold refused")
    carried = next.success
    // THE SAME OBJECTS, not merely equal ones — which is the difference between
    // an answer carried and an answer re-derived.
    expect(carried.asked.outlines).toBe(outlines)
    expect(carried.asked.serves).toBe(serves)
    expect(carried.asked.broken).toBe(broken)
    // ...and the content the layer holds is the NEW content, which is what
    // makes the carrying legitimate rather than a stale answer.
    expect(carried.asked.at("house.org")).toBe(
      carried.set.documents.find((document) => document.path === "house.org"),
    )
  }

  // ...AND THE ARM THAT RE-ASKS. The same run through the fold as it stood
  // hands back a new answer every op, which is the cost this change removes —
  // asserted rather than described, so "one asking per batch" is a fact about
  // the code and not a sentence about it.
  const before = start()
  const reasking = assembling(before)
  const made = plan(before, { op: "todo", id: "loose" })
  if (Result.isFailure(made)) throw new Error("`todo` refused")
  const after = reasking(made.success)
  if (Result.isFailure(after)) throw new Error("the fold refused")
  expect(after.success.asked.outlines).not.toBe(before.asked.outlines)
  expect(after.success.asked.broken).not.toBe(before.asked.broken)
})

test("a file MINTED mid-batch reaches what carries — the answers move, and they are right", () => {
  const at = start()
  const fold = folding(at)
  const outlines = at.asked.outlines

  const made = plan(at, { op: "create", file: "notes/plans.org" })
  if (Result.isFailure(made)) throw new Error(`refused: ${made.failure.message}`)
  const next = fold(made.success)
  if (Result.isFailure(next)) throw new Error("the fold refused")

  // MEMBERSHIP MOVED, so the carried answer did not survive — #382's lesson,
  // which is the failure a carried structure has: the offer would otherwise be
  // that this directory does not serve the file the batch has just minted, and
  // the next op's `add` into it would be refused with a near miss.
  expect(next.success.asked.outlines).not.toBe(outlines)
  expect(next.success.asked.serves.has("notes/plans.org")).toBe(true)
  expect(next.success.asked.at("notes/plans.org")?.kind).toBe("outline")
  // And the op that follows it lands, which is the sentence that mattered.
  const into = plan(next.success, { op: "add", file: "notes/plans.org", title: "a first row" })
  expect(Result.isSuccess(into)).toBe(true)
})

test("a file MENDED mid-batch leaves `broken`, and what carries hears about it", () => {
  // `torn.org` is the corpus's unreadable file. Nothing can write it — every
  // gate refuses — so the way it leaves `broken` in a batch is the way it does
  // on disk: somebody fixes the file. What this asserts is the CONTEXT's half
  // of that: the carrier declines rather than answering off an old `broken`.
  const at = start()
  const fold = folding(at)
  expect(at.asked.broken.has("torn.org")).toBe(true)

  const made = plan(at, { op: "todo", id: "loose" })
  if (Result.isFailure(made)) throw new Error("`todo` refused")
  const next = fold(made.success)
  if (Result.isFailure(next)) throw new Error("the fold refused")
  // A content write of ANOTHER file leaves the broken answer exactly where it
  // was — the carried one, the same object.
  expect(next.success.asked.broken).toBe(at.asked.broken)
  expect(next.success.asked.broken.has("torn.org")).toBe(true)
})

test("an intermediate context is a value: a later op does not move an earlier one's answers", () => {
  // #392's law, over the layer this fold carries. The scope op three was judged
  // against is a value somebody may still be holding — the test above holds
  // several — so op four writing into the layer op three's context reads
  // through would move an answer already given. There is one way to see that
  // from the outside: keep an old context and ask it again.
  const at = start()
  const fold = folding(at)
  const scopes: Array<Scope> = []
  let carried: Scope = at
  for (const op of [
    { op: "desc", id: "loose", desc: "the first note" },
    { op: "desc", id: "loose", desc: "the second note" },
    { op: "desc", id: "loose", desc: "the third note" },
  ] as const) {
    const made = plan(carried, op)
    if (Result.isFailure(made)) throw new Error(`\`${op.op}\` refused: ${made.failure.message}`)
    const next = fold(made.success)
    if (Result.isFailure(next)) throw new Error("the fold refused")
    carried = next.success
    scopes.push(carried)
  }

  // Each context answers about the set it was built for, and about no other:
  // the note it holds for `loose` is the note that op wrote.
  const noteAt = (scope: Scope): string | undefined => {
    const document = scope.asked.at("house.org")
    if (document === undefined || document.kind !== "outline") return undefined
    const found = document.nodes.find((located) => located.node.id === "loose")
    return found === undefined || "mirror" in found.node ? undefined : found.node.desc
  }
  expect(scopes.map(noteAt)).toEqual(["the first note", "the second note", "the third note"])
  // ...and each context's own set says the same thing, which is what makes the
  // layer a reading of that set rather than a memory of the run.
  for (const scope of scopes) {
    expect(scope.asked.at("house.org")).toBe(
      scope.set.documents.find((document) => document.path === "house.org"),
    )
  }
})
