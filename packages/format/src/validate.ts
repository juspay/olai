/**
 * Phase two of the codec: the one whole-set validator.
 *
 * Format rules are checked in exactly one place. `parseOutline` owns the rules
 * a single line answers by itself; everything below needs to know what else
 * exists, and nothing outside these two functions — not the reader, not the
 * store, not the web layer — is allowed to reject an outline.
 *
 * Every rule runs, and every error is collected. Stopping at the first would
 * turn "fix this file" into a loop of load-fix-load, which is the workflow the
 * format exists to remove.
 *
 * A set may arrive with files that did not parse (`set.broken`), and what this
 * function decides about them is the ERROR SCOPE (resolved 2026-08-09):
 *
 *   - if the files that DID parse are clean, the set is accepted with those
 *     failures embedded in it. The broken outline renders its own errors, in
 *     its own place, and every other outline stays live — a typo in one file is
 *     not a reason to blank the other nine;
 *   - if anything else is wrong, or a rule had to withhold a finding because
 *     the missing nodes made it a guess, the set is rejected and the report
 *     carries the parse errors alongside whatever else was found. The store
 *     then keeps its last good snapshot and the browser shows a banner.
 *
 * THE RULES THEMSELVES ARE ONE FILE OVER ({@link ./rules.ts}), and that move is
 * about the SHADOW rather than about length. Each of them takes the records it
 * is asked about, so a second validator can ask the same functions about fewer
 * of them — which is what {@link ./incremental.ts} does, and what
 * {@link ./shadow.ts} runs beside every call below to prove the two agree.
 * Nothing about the verdict this function reaches has changed: the full rules
 * run over the whole corpus, exactly as they always did, and the narrowed
 * arm's answer is compared and dropped.
 */

import { Result } from "effect"

import { derive, type Derived } from "./derive.ts"
import type { OutlineError } from "./errors.ts"
import type { Located } from "./node.ts"
import { patched, type SetDelta } from "./patch.ts"
import {
  danglingIn,
  markdownPaths,
  reportAfterCycles,
  reportDeclarations,
  reportDocs,
  reportDuplicateIds,
  reportMirrorCycles,
  reportOf,
  reportParentCycles,
  reportParents,
  reportPropValues,
  reportUnknownTargets,
} from "./rules.ts"
import { type OutlineSet, outlinesIn } from "./set.ts"
import { shadowed } from "./shadow.ts"
import { declarationsOf, type Typed } from "./typing.ts"

/**
 * A set, and the view it was JUDGED against.
 *
 * The two travel together for the reason {@link Derived} carries its own nodes
 * ({@link ./derive.ts}): a caller holding one revision's set against another's
 * indexes draws a plausible tree rather than failing, and a live store has two
 * revisions in flight often enough to make that a real possibility rather than
 * a theoretical one.
 *
 * It is what {@link validate} ANSWERS WITH, which is the whole of why it
 * exists: the derivation every rule below was checked against used to be built,
 * read six times and dropped at the door, so the next reader — the store
 * publishing the snapshot, the planner judging the next keystroke — walked the
 * corpus again for a value that had just been in hand. The pair is published,
 * and a reader above reads the view the validator built rather than building a
 * second one that is free to disagree with it.
 *
 * WHAT IT HIDES is where it has now earned its keep. Every reader above — the
 * planner, the query walks, the keystroke resolver, the per-file projection the
 * wire is cut from — names this pair and nothing else, so HOW the view came to
 * exist is behind it: PATCHED from the reading this one follows when a caller
 * offers one and the records line up ({@link Previous}, {@link viewOf}), and
 * built from scratch when either is missing. That landed as slice 3 of
 * `docs/brainstorming/model-indices.md` and it was a change of one function
 * inside this file, with no consumer of this type able to tell — which was the
 * claim this paragraph made while the patcher was still ahead of it.
 */
export interface Reading {
  readonly set: OutlineSet
  readonly derived: Derived
}

/**
 * The reading this one FOLLOWS, and what has moved since — what lets a
 * validation PATCH its view instead of building one ({@link ./patch.ts}).
 *
 * Offered, never required: {@link validate} without it is exactly the function
 * it always was. What it buys is the keystroke case, where the difference
 * between the two views is one record and the difference in cost is the whole
 * corpus.
 *
 * The delta must be about the SET being validated — the same files, the same
 * records — because the answer is a view of that set. Its one caller is the
 * store's codec, which is handed both by a package whose whole job is knowing
 * which files moved ({@link ../../store/src/codec.ts}'s `Since`).
 */
export interface Previous {
  readonly read: Reading
  readonly delta: SetDelta
}

export const validate = (
  set: OutlineSet,
  previous?: Previous,
): Result.Result<Reading, ReadonlyArray<OutlineError>> => {
  const errors: Array<OutlineError> = []
  // One set of indexes, built once and shared by every rule below, so no two
  // of them can disagree about which record an id names or what hangs under it
  // — and so the browser derives the tree from the same code. It LEAVES with
  // the verdict ({@link Reading}) rather than being dropped here: the caller
  // that publishes what this approves has no second corpus to walk.
  const view = viewOf(set, previous)
  const derived = view.derived

  // THE RECORDS ARE THE VIEW'S, which is the same records the set holds one
  // level down. Asking the derivation is what keeps this from being a second
  // flattening beside the one every rule below is run against — and the
  // identity the duplicate-id rule turns on is exactly that these are the set's
  // records rather than copies of them.
  //
  // BOUND ONCE, because a patched view builds this reading when somebody asks
  // ({@link Derived.nodes}) and five rules asking is one question, not five.
  const all = derived.nodes
  // The `.md` paths a `doc` may point at, bound here rather than inside the
  // rule that reads them so that the ledger the shadow files can carry them —
  // building this walks every document in the directory
  // ({@link ./rules.ts}'s `markdownPaths`).
  const known = markdownPaths(set)
  // WHAT THE VAULT DECLARES about its property keys, read once and handed to
  // both halves of the typing rule below ({@link ./typing.ts}). One small
  // file's top level — the same shape and the same cost as the shelf's reading
  // one convention over — so it is built here rather than inside a rule that
  // would build it per record, and it LEAVES with the shadow so the narrowed
  // arm can tell a vocabulary that moved from one that did not.
  const declarations = declarationsOf(derived)
  const typed: Typed = { declarations, derived, documents: known }
  reportDuplicateIds(all, derived, errors)
  reportParents(all, derived, errors)
  reportParentCycles(all, derived, errors)
  reportUnknownTargets(danglingIn(derived), derived, errors)
  reportAfterCycles(all, derived, errors)
  reportMirrorCycles(all, derived, errors)
  reportDocs(all, known, errors)
  reportDeclarations(derived, errors)
  reportPropValues(all, typed, errors)

  // THE UNDERSTUDY, and it decides nothing: it runs the narrowed validator over
  // the same set and the same view, compares its verdict with the one above,
  // and shouts if they differ ({@link ./shadow.ts}, which also says when and how
  // the flip may happen and that it is not this call's to make). It returns
  // nothing and it cannot throw.
  shadowed(
    set,
    previous?.read.derived,
    // The delta is offered only when the patch was TAKEN. A rebuilt view has no
    // relation to the one this validation follows, so a narrowing against it
    // would be sound about nothing ({@link ./incremental.ts}'s first fact).
    view.patched ? previous?.delta : undefined,
    derived,
    errors,
    known,
    declarations,
  )

  // Any error at all refuses the set, INCLUDING one that was withheld: the
  // withheld ones are unresolved references, and a snapshot whose nodes point
  // at ids nobody can resolve is not a set anything could draw. So the report
  // becomes the parse errors, which is the cause, and the last good snapshot
  // stays on screen underneath it ({@link ./rules.ts}'s `reportOf` assembles
  // both halves and puts them in order).
  return errors.length > 0
    ? Result.fail(reportOf(set, errors))
    : Result.succeed({ set, derived })
}

/**
 * The pair, without the rules — a set and the view of it, patched from a
 * previous reading where that is exact and rebuilt where it is not.
 *
 * {@link validate}'s first line and its last, with the six whole-set rules
 * taken out from between them, and it exists for one caller: `@olai/ops`' batch
 * fold, which plans op two against the set op one would leave and then throws
 * that set away. That reading is SPECULATIVE by construction — nothing draws
 * it, nothing is published at it, and the only set that reaches disk is the one
 * the write gate validates, exactly once, as it validates every write. Running
 * the rules over each intermediate would be N whole-corpus checks to reject
 * something the final check either catches or was never true of.
 *
 * IT IS THIS FUNCTION AND NOT `patch`, and that is the whole of why it is here.
 * The patcher is exported — the browser folded its delta frames with it once
 * (`model-indices` slice 4) — and a caller with nothing to hold the result
 * against is right to reach it. This one has something: it assembles a real
 * {@link OutlineSet} per op and plans the next one against it, which is
 * precisely what {@link viewOf}'s disagreement check is for — the identity test
 * that turns a delta which missed a file into a rebuild rather than into a view
 * where every record looks like a duplicate of itself. So the door a
 * set-holding caller comes through is the patcher AND that guard, together, and
 * nobody has to remember the second half.
 */
export const reading = (set: OutlineSet, previous?: Previous): Reading => ({
  set,
  derived: viewOf(set, previous).derived,
})

/**
 * THE SET FLATTENED, for the rebuild that is handed a list — once per
 * validation and only when there IS a rebuild, which is the cost `./set.ts`
 * names for serving documents rather than a `nodes` collection beside them.
 *
 * It used to run on every validation, patched or not, and the flat list it made
 * was then compared with the one the patch had made: two arrays of every record
 * in the directory, for a question about identity. {@link isSet} asks that
 * question of the grouping instead, so a patched validation reaches this
 * function not at all and spends its one flattening where the rules actually
 * read the records ({@link Derived.nodes}, built when asked).
 *
 * It is here rather than exported because of what would happen if it were:
 * a `nodesOf(set)` on the set's own surface is a node-only list to import, and
 * the whole of PR 2 is that there is none. The derivation is what a reader
 * that wants every record asks — and it carries its own indexes, so what it
 * hands back cannot be paired with another revision's.
 */
const recordsIn = (set: OutlineSet): ReadonlyArray<Located> =>
  outlinesIn(set).flatMap((outline) => outline.nodes)

/**
 * The view every rule below is run over: patched from the last one where that
 * is possible, built from scratch where it is not.
 *
 * The two are the same value — that is the patcher's contract and its property
 * test — so this is a statement about COST and about nothing else. Which is why
 * it is one branch inside this file rather than a decision any caller makes:
 * `Reading` was written to hide exactly this.
 *
 * THE RECORDS THEMSELVES ARE COMPARED, and identity is the right question
 * rather than a strict one. The rules below read the view against the set: a
 * duplicate id is "the record `byId` kept is not THIS record"
 * ({@link reportDuplicateIds}), and that is an identity test. So a view built
 * from a delta that missed a file — or from records equal to the set's rather
 * than the set's own — is not merely stale, it makes every record look like a
 * duplicate of itself. Nothing about that could be caught by counting, and the
 * records to compare are in hand on both sides: the view's grouping, and the
 * outlines the set already holds ({@link isSet}, which walks the FILES rather
 * than flattening the corpus a second time to compare against a first).
 *
 * It is a DISAGREEMENT check and not a proof of the delta. What stands behind
 * that is the store's own claim that these paths are every path that moved,
 * which is the same claim the wire already spends when it publishes per file;
 * this is what makes a broken claim cost a rebuild rather than a wrong answer.
 *
 * THE PATCHED VIEW ITSELF once that holds, records and places and all. It used
 * to hand back `{...view, nodes}` — the SET's own array swapped in, so a
 * rebuilt reading and a patched one shared one list with the set. Neither array
 * is the set's any more, so that spread would rebuild the view to hold an array
 * equal to the one it already had, and throw away the one identity worth
 * keeping: the patched list is stable across revisions that touched nothing.
 *
 * IT SAYS WHICH WAY IT WENT, which the shadow needs and nothing else does: a
 * narrowed verdict is only sound over a view that really was patched from the
 * one it is narrowing against ({@link ./incremental.ts}'s first fact), and a
 * rebuild carries no such relation. It asks {@link patched} rather than
 * `patch` for that word — the patcher with its fallback taken off, which is
 * the same door `./patch.test.ts` uses to count declines. The fallback the
 * patcher would have taken is this function's own last line, and the two are
 * the same value: `derive` over the delta applied to the previous grouping and
 * `derive` over the set's own records are one array whenever {@link isSet}
 * would have passed, and whenever it would not, this is the rebuild that used
 * to happen anyway — one derivation now where a missed file used to cost two.
 */
const viewOf = (set: OutlineSet, previous: Previous | undefined): Taken => {
  if (previous !== undefined) {
    const view = patched(previous.read.derived, previous.delta)
    if (view !== undefined && isSet(view, set)) return { derived: view, patched: true }
  }
  return { derived: derive(recordsIn(set)), patched: false }
}

/** A view, and whether it was PATCHED from the reading this validation follows
 *  — see {@link viewOf}'s last paragraph for who asks and why. */
interface Taken {
  readonly derived: Derived
  readonly patched: boolean
}

/**
 * Whether a view is about THIS set — the check that decides whether a patch is
 * taken or thrown away for a rebuild.
 *
 * ASKED FILE BY FILE, of the view's own grouping, and that is the whole of what
 * changed here: it used to flatten the set and compare the two flat lists, so a
 * write that patched paid for the corpus in one array to check a view that had
 * just paid for it in another — two allocations of every record in the
 * directory, for a question about identity that neither of them added anything
 * to. {@link Derived.byFile} is what a patch already holds and what the set
 * already is, and comparing those spends no allocation at all.
 *
 * It is STRICTLY the stronger question, not the cheaper half of the old one:
 * the flat lists agreeing said the records were the same objects in the same
 * order, and this says that AND that the view files them under the paths the
 * set spells, in the order an assembled set is in.
 *
 * IT STILL WALKS THE RECORDS, and what that is worth was measured rather than
 * left as the obvious next lever: 0.122ms over the bench vault's ~980 files and
 * 21,552 records, against 0.070ms for the same walk comparing one POINTER per
 * file. So the whole of what array identity could buy here is about five
 * hundredths of a millisecond — and buying it means {@link Derived.byFile}
 * holding the set's own arrays, which means `derive` being handed a grouping
 * instead of the flat list it is written against. A worse interface, one layer
 * down, for a twentieth of what one patch costs. A file holding nothing is
 * absent from `byFile` ({@link Derived.byFile} says so), so the set's empty
 * outlines are stepped over rather than matched — which is itself a rule the
 * flat comparison could not see either way.
 */
const isSet = (view: Derived, set: OutlineSet): boolean => {
  // The outlines the grouping HAS a key for. A file holding nothing is absent
  // from {@link Derived.byFile} — that map says so itself, and a file that did
  // not parse holds nothing — so dropping the empty ones is what lets the two
  // be stepped side by side. One entry per FILE, where the flat comparison this
  // replaced allocated one per RECORD, twice.
  const outlines = outlinesIn(set).filter((outline) => outline.nodes.length > 0)
  if (view.byFile.size !== outlines.length) return false
  let which = 0
  for (const [file, records] of view.byFile) {
    const outline = outlines[which++]
    if (outline === undefined || outline.path !== file) return false
    if (outline.nodes.length !== records.length) return false
    for (let at = 0; at < records.length; at++) {
      if (records[at] !== outline.nodes[at]) return false
    }
  }
  return true
}

