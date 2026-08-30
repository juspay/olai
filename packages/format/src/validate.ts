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
 * ## THE ERROR SCOPE IS PER FILE, and there is no other arm
 *
 * A validation ANSWERS WITH A SET. Whatever it finds, the directory loads: the
 * files a finding is about are published with their content withheld — keeping
 * their place, carrying their rows, drawing them on their own page — and every
 * other file is live, readable and writable. That is the human's ruling of
 * 2026-08-29, and it holds at a cold boot exactly as it holds at runtime,
 * because there is no boot arm here to hold anything different.
 *
 * It is the 2026-08-09 error scope finished. That resolution made a file whose
 * LINES did not parse a hole the rest of the set was rendered around, and left
 * every whole-set rule under one blanket: a duplicate id, a stale `see`, a
 * property that did not fit its declaration — each of them took the entire
 * vault off the screen, froze every write to every healthy file, and served
 * nothing at all at a cold boot (`cold-boot-all-or-nothing`,
 * `broken-file-blocks-healthy-writes`, `last-good-banner-flood`, and the trap
 * `bug-lastgood-locked` sat in). The scope is one rule now and it is the one
 * that was already right.
 *
 * TWO THINGS FOLLOW, and both are load-bearing further down.
 *
 * The rules are run over the WHOLE decoded set, always — the withholding is
 * applied to the answer and never to the input. So a file being withheld cannot
 * invent a finding against a healthy neighbour, and a `mirror` or a `see` from a
 * healthy file into a withheld one resolves to the dangling face the derivation
 * already draws ({@link ./derive.ts}'s `follow`) rather than to a fresh
 * `unknown-target` that would darken the file holding the edge.
 *
 * And a finding a rule WITHHELD because some file did not parse breaks nothing
 * at all ({@link ./verdict.ts}'s `blamed` reads the report, not the raw
 * findings). "`kitchen` is not a known id" is a guess while the line declaring
 * `kitchen` is the one that failed, and a guess may not take a page down. That
 * is the whole of the 2026-08-25 cold-boot incident: two dangling `see` edges,
 * both guesses, and an empty vault for thirty minutes.
 *
 * ## TWO WAYS TO REACH ONE VERDICT, and the narrowed one is the answer
 *
 * A validation handed the reading it FOLLOWS ({@link Previous}) re-asks only
 * the rules an edit could have changed the answer to: {@link ./incremental.ts}
 * takes the previous verdict, the previous view and a delta naming what moved,
 * and reaches the same verdict from the touched records instead of from the
 * directory. That arm is AUTHORITATIVE as of this file's `narrowly` — its
 * verdict is the one {@link validate} answers with, and the whole-set rules do
 * not run beside it.
 *
 * It ran as a SHADOW first (#383, 2026-08-25 → 2026-08-27): both arms on every
 * write, the full verdict obeyed, the narrowed one compared and dropped, and
 * every disagreement appended to a log an orchestrator read. Three quiet nights
 * and an empty log are what this change spends, and the shadow went with it —
 * a shadow of an authoritative thing is meaningless.
 *
 * {@link wholly} is what a validation that CANNOT narrow runs, and it is the
 * same six rules over the whole corpus that every validation used to run. It is
 * reached on a boot, on a rebuilt view, on a reading nobody validated, and on
 * the three doors the narrowing turns back at ({@link Cold}) — so the full
 * arm is not gone, it is the answer for the writes that have nothing to narrow
 * from.
 *
 * A THROW FROM THE NARROWED ARM IS NOT CAUGHT, which is a change of position
 * and a deliberate one. The shadow ran inside a `try` because it decided
 * nothing and a write that failed because its own understudy failed would have
 * been a strictly worse product. That premise is gone: the narrowing decides,
 * it has a word for every case it knows it cannot answer, and a validator that
 * swallowed its own defects and quietly answered a different way would make
 * the verdict depend on whether a bug threw or was merely wrong.
 *
 * THE RULES THEMSELVES ARE ONE FILE OVER ({@link ./rules.ts}), and that is what
 * makes the two arms one set of rules rather than two opinions about the
 * format. Each of them takes the records it is asked about, so the narrowed
 * validator asks the same functions about fewer of them — which is the whole of
 * what {@link ./incremental.ts} is.
 */

import { Result } from "effect"

import { derive, type Derived } from "./derive.ts"
import { type Document, isOutline } from "./document.ts"
import type { BrokenFile, OutlineError } from "./errors.ts"
import { type Decline, incrementally, type Ledger } from "./incremental.ts"
import type { Located } from "./node.ts"
import { type FileNodes, patch, patched, type SetDelta } from "./patch.ts"
import { type Pointing, pointingOf, repointed } from "./pointing.ts"
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
import { type OutlineSet, outlinesIn, withDocuments, withheld } from "./set.ts"
import { declarationsOf, type KindVocabulary, NO_KINDS, type Typed } from "./typing.ts"
import { blamed, type Verdict } from "./verdict.ts"

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
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/model-indices.md` and it was a change of one function
 * inside this file, with no consumer of this type able to tell — which was the
 * claim this paragraph made while the patcher was still ahead of it.
 */
export interface Reading {
  readonly set: OutlineSet
  readonly derived: Derived
  /**
   * WHAT POINTS WHERE — the set's own links, filed backwards
   * ({@link ./pointing.ts}).
   *
   * A THIRD MEMBER rather than a thirteenth index inside the derivation, and
   * that module's header argues it: `derive` is handed the RECORDS and
   * `patch` is handed a delta of them, so neither has ever been shown a face —
   * while the SET and the reading this one follows are exactly what is in hand
   * at the one place a reading is made. It travels here for the reason the two
   * above travel together: an index of one revision's documents held against
   * another's set is a plausible answer about the wrong directory.
   */
  readonly pointing: Pointing
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

/**
 * WHICH WORDS BEYOND THE FORMAT'S SEVEN A DECLARATION MAY NAME, and which of
 * them judge a value — the plugin-contributed vocabulary, handed in as data
 * ({@link ./typing.ts}'s `KindVocabulary`).
 *
 * A PARAMETER RATHER THAN AN IMPORT, because this package names no plugin: the
 * registry that knows them imports this one, so the table is assembled at the
 * composition root and travels down. It reaches exactly two rules — the
 * declarations rule, which refuses a `type` naming no word this BINARY was
 * built with, and the values rule, which holds a value to what this SERVE is
 * running.
 *
 * {@link NO_KINDS} BY DEFAULT, and that is a STATE rather than a fallback: it
 * is what `--plugins=` composes, and it is what every caller that has no
 * plugins to speak of — the browser's own derivation, a bench, a fixture — is
 * actually in. A vault declaring `terminal` under it is a vault whose key is
 * untyped and whose declaration is reported, which is precisely what a build
 * with no kolu should say about the word.
 */
export const validate = (
  set: OutlineSet,
  previous?: Previous,
  kinds: KindVocabulary = NO_KINDS,
): Result.Result<Reading, Verdict> => {
  // One set of indexes, built once and shared by every rule below, so no two
  // of them can disagree about which record an id names or what hangs under it
  // — and so the browser derives the tree from the same code. It LEAVES with
  // the verdict ({@link Reading}) rather than being dropped here: the caller
  // that publishes what this approves has no second corpus to walk.
  const view = viewOf(set, previous)
  const derived = view.derived

  // THE NARROWED ARM, AND ITS ANSWER IS THE ANSWER. This is the flip
  // (roadmap `perf-validate-flip`): the rules an edit could not have changed
  // the answer to are not re-asked, and what a write pays is the touched
  // files' records rather than the directory. {@link wholly} is the same six
  // rules the validator always ran, and it runs when — and only when — there
  // is nothing to narrow from ({@link Cold} names the six doors).
  const said = narrowly(set, previous, view, kinds)
  const ledger = typeof said === "string" ? wholly(set, derived, kinds, said) : said

  // WHAT A READER IS SHOWN: the parse errors first, which are the cause, the
  // guesses taken out, the whole thing in presentation order ({@link
  // ./rules.ts}'s `reportOf` assembles both halves).
  //
  // AND WHAT THE SET DOES WITH IT — which since the per-file ruling
  // (2026-08-29) is the only question left here. This used to consult a tier
  // table for whether the findings REFUSED the load, and every `set` class sat
  // at `refuses`: one dangling `see` and the store held its last good snapshot,
  // every page in the app went stale behind a banner, and a cold boot served
  // nothing at all (`cold-boot-all-or-nothing`). The ruling has no such member
  // in it. A finding breaks the FILES IT IS ABOUT and nothing else, so the set
  // is published with exactly those files withheld ({@link ./set.ts}'s
  // `withheld`, off {@link ./verdict.ts}'s `blamed`) — each one keeping its
  // place, carrying its rows, drawing them on its own page — and every healthy
  // neighbour stays live and stays writable.
  //
  // THE RULES RAN OVER THE WHOLE SET, always, and only the ANSWER is degraded.
  // That is what makes withholding stable rather than a cascade: a `see` from a
  // healthy file into a withheld one resolved when it was judged and dangles
  // when it is drawn, and the next validation starts from the full decoded set
  // again and reaches the same verdict.
  const report = reportOf(set, ledger.errors)
  const answer: Reading = report.length === 0
    ? { set, derived, pointing: view.pointing }
    : degraded(set, view, blamed(report))

  // WHAT THIS VALIDATION LEAVES FOR THE NEXT ONE, filed under the view it
  // ANSWERED WITH — which is the degraded one when there was something to
  // withhold, and is the point of filing it here rather than beside the
  // judgement. `Previous` is the last reading the store PUBLISHED, so the entry
  // a following validation looks up is this one, and it has to be found: an
  // entry it cannot find is `unledgered`, which says the reading came from
  // somewhere other than a validation and is not true of this one.
  //
  // A DIRTY LEDGER DECLINES ON ITS OWN, which is what makes filing it here
  // sound rather than merely tidy. A degraded reading is by definition one this
  // validation found something in, so the ledger under it has errors, and the
  // narrowing's second fact turns it back at the door ({@link
  // ./incremental.ts}'s `refused`): there is no claim that the untouched
  // records were ever found clean, so the corpus is walked. Which is exactly
  // right for a view with a file's records taken out of it.
  LEDGERS.set(answer.derived, ledger)
  return Result.succeed(answer)
}

/**
 * The reading a validation that found something publishes: the same set with
 * the broken files' content withdrawn, and a view and a pointing of THAT.
 *
 * The two derivations are patched rather than rebuilt where they can be. A
 * withheld file is a `removes` entry in the delta vocabulary the patcher
 * already takes ({@link ./patch.ts}), so the view of the degraded set is the
 * judged view with those files dropped out of it — and `patch` falls back to a
 * rebuild on its own terms for the cases it cannot answer, of which a duplicate
 * id is the commonest and is exactly the case that most often gets here.
 * `repointed` is the same story for what points where: it reads the two SETS
 * and walks only the documents that differ.
 */
const degraded = (
  set: OutlineSet,
  view: Taken,
  broken: ReadonlyArray<BrokenFile>,
): Reading => {
  const withdrawn = withheld(set, broken)
  // Nothing moved — a directory whose only trouble is a file that would not
  // parse, which `assemble` had already withheld. The judged view is a view of
  // this set, so there is nothing to patch and nothing to re-point.
  if (withdrawn === set) return { set, derived: view.derived, pointing: view.pointing }
  return {
    set: withdrawn,
    derived: patch(view.derived, {
      upserts: NO_UPSERTS,
      removes: broken.map((entry) => entry.file),
    }),
    pointing: repointed(view.pointing, set.documents, withdrawn.documents),
  }
}

/** A delta that only takes files away. One value, since every withholding is
 *  shaped exactly this way. */
const NO_UPSERTS: ReadonlyArray<readonly [file: string, entry: FileNodes]> = []

/**
 * WHY A VALIDATION HAD TO WALK THE CORPUS — one word per door, and the six of
 * them are the whole of when {@link wholly} runs.
 *
 *   - `first` — no reading to follow at all: the boot, or a caller that
 *     offered none;
 *   - `rebuilt` — the view was BUILT rather than patched, so it carries no
 *     relation to the one this validation follows ({@link patched} declined, or
 *     {@link isSet} refused the delta). A narrowing against it would be sound
 *     about nothing ({@link ./incremental.ts}'s first fact);
 *   - `unledgered` — a previous view this file has no verdict for, which is a
 *     reading minted somewhere other than a validation ({@link reading},
 *     {@link following});
 *   - and the three the narrowing itself turns back at
 *     ({@link ./incremental.ts}'s `Decline`).
 */
export type Cold = "first" | "rebuilt" | "unledgered" | Decline

/**
 * The narrowed ledger, or the word for why there is none.
 *
 * THREE CHECKS AND THEN THE NARROWING'S OWN THREE, in the order that makes each
 * one cheap: a validation with nothing to follow is turned back before a table
 * is read, and a rebuilt view before the previous one is looked up at all.
 *
 * IT DOES NOT CATCH. A throw from here is a defect in the validator and the
 * write fails with it — see this file's header for why that is a change of
 * position from the shadow's `try` and not an oversight.
 */
const narrowly = (
  set: OutlineSet,
  previous: Previous | undefined,
  view: Taken,
  kinds: KindVocabulary,
): Ledger | Cold => {
  if (previous === undefined) return "first"
  if (!view.patched) return "rebuilt"
  const followed = LEDGERS.get(previous.read.derived)
  if (followed === undefined) return "unledgered"
  const narrowed = incrementally(
    set,
    previous.read.derived,
    followed,
    previous.delta,
    view.derived,
    kinds,
  )
  if (typeof narrowed === "string") return narrowed
  reached({ kind: "narrowed", walked: narrowed.walked })
  return narrowed.ledger
}

/**
 * THE SIX WHOLE-SET RULES over the whole corpus — the validator as it was
 * before the flip, and what a validation with nothing to narrow from runs.
 *
 * Five of these visit every record in the directory and the sixth reads an
 * index (roadmap `perf-validate-incremental`), which is the cost the narrowed
 * arm exists to stop paying per keystroke — and which a boot, a `git pull` and
 * a duplicate id still pay, because each of those is a set nothing said
 * anything true about yet.
 *
 * IT ANSWERS WITH A LEDGER and not a list of findings, so that the two arms
 * leave the same value for whoever follows: the raw findings, the `.md` paths
 * this verdict was reached against, and the vocabulary the vault declared
 * ({@link ./incremental.ts}'s `Ledger` argues each of the three).
 */
const wholly = (
  set: OutlineSet,
  derived: Derived,
  kinds: KindVocabulary,
  why: Cold,
): Ledger => {
  reached({ kind: "whole", why })
  const errors: Array<OutlineError> = []
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
  // rule that reads them so that the ledger this leaves can carry them —
  // building this walks every document in the directory
  // ({@link ./rules.ts}'s `markdownPaths`), which is the one whole-corpus
  // reading here that is not a walk of the records and the one the narrowed
  // arm carries forward instead of repeating.
  const known = markdownPaths(set)
  // WHAT THE VAULT DECLARES about its property keys, read once and handed to
  // both halves of the typing rule below ({@link ./typing.ts}). One small
  // file's top level — the same shape and the same cost as the shelf's reading
  // one convention over — so it is built here rather than inside a rule that
  // would build it per record, and it LEAVES in the ledger so the next
  // validation can tell a vocabulary that moved from one that did not.
  const declarations = declarationsOf(derived)
  const typed: Typed = { declarations, derived, documents: known, kinds }
  reportDuplicateIds(all, derived, errors)
  reportParents(all, derived, errors)
  reportParentCycles(all, derived, errors)
  reportUnknownTargets(danglingIn(derived), derived, errors)
  reportAfterCycles(all, derived, errors)
  reportMirrorCycles(all, derived, errors)
  reportDocs(all, known, errors)
  reportDeclarations(derived, kinds, errors)
  reportPropValues(all, typed, errors)
  return { errors, known, typing: declarations }
}

/**
 * The verdict one validation reached, filed under the view it ANSWERED with —
 * read back by the next validation that follows this one.
 *
 * A `WeakMap`, so a view nobody holds takes its ledger with it; and BESIDE the
 * reading rather than inside it, so that a `Reading` minted by {@link reading}
 * or {@link following} — speculative, judged by nothing — carries no verdict
 * for a later validation to narrow from. Such a reading is `unledgered` at
 * {@link narrowly}'s third door, which is a rebuild and never a guess.
 */
const LEDGERS = new WeakMap<Derived, Ledger>()

/** What this file holds about a view, read back. Nothing in the product asks —
 *  it is here so that "the ledger a validation leaves is the one it ANSWERED
 *  with" is a checked claim rather than a paragraph
 *  (`./incremental.testlib.ts`). */
export const ledgerOf = (derived: Derived): Ledger | undefined => LEDGERS.get(derived)

/**
 * HOW ONE VALIDATION REACHED ITS VERDICT — narrowed to what the edit touched,
 * or over the whole corpus, and which door sent it there.
 *
 * It decides nothing and nothing in the product listens. What it exists for is
 * the differential (`./incremental.test.ts`): the two arms are held to one
 * answer by running both over the same set, and a run where the narrowing
 * DECLINED every time would be the full validator agreeing with itself on every
 * revision — a green suite proving nothing at all. Only this channel can tell
 * the two apart, so the floors that keep that suite honest are read off it.
 */
export interface Reached {
  readonly kind: "narrowed" | "whole"
  /** Which door, on `whole` — a count of them is a sum over five different
   *  things, and a floor met by booting sixty times has exercised none of
   *  them. */
  readonly why?: Cold
  /** Whether the narrowed arm had to walk the corpus ANYWAY, for the two rules
   *  that fall back to it — see {@link ./incremental.ts}'s `Narrowed`. Absent
   *  on `whole`, where there was no narrowed arm to ask. */
  readonly walked?: boolean
}

export type Watcher = (reached: Reached) => void

/**
 * Install the watcher — `null` takes it off, and off is the default.
 *
 * SILENCE AND NOT A SHOUT, which is where this differs from the shadow's
 * witness it replaces: a divergence was news and had to reach somebody through
 * a tree that had wired nothing, while "the validator narrowed this write" is
 * every write and is news to no one. One slot, so a suite cannot end up
 * printing what it is asserting on.
 */
export const watching = (installed: Watcher | null): void => {
  watcher = installed
}

let watcher: Watcher | null = null

const reached = (one: Reached): void => {
  watcher?.(one)
}

/**
 * The pair, without the rules — a set and the view of it, patched from a
 * previous reading where that is exact and rebuilt where it is not.
 *
 * {@link validate}'s first line and its last, with the six whole-set rules
 * taken out from between them, for a reading that is SPECULATIVE: nothing
 * draws it, nothing is published at it, and the set that reaches disk is
 * validated once, at the gate, as every write is. Running the rules over an
 * intermediate would be a whole-corpus check to reject something the final
 * check either catches or was never true of.
 *
 * IT IS THIS FUNCTION AND NOT `patch`, and that is the whole of why it is here.
 * The patcher is exported — the browser folded its delta frames with it once
 * (`model-indices` slice 4) — and a caller with nothing to hold the result
 * against is right to reach it. This one has something: a real
 * {@link OutlineSet}, and a view held against it by {@link viewOf}'s
 * disagreement check — the identity test that turns a delta which missed a file
 * into a rebuild rather than into a view where every record looks like a
 * duplicate of itself. So the door a set-holding caller comes through is the
 * patcher AND that guard, together, and nobody has to remember the second half.
 *
 * WHO STILL COMES THROUGH IT is the caller whose set and whose delta came from
 * DIFFERENT PLACES, and who is therefore making a claim about the two: this is
 * the shape the store's codec has, and `@olai/ops`' reference fold keeps
 * (`following.testlib.ts`). A caller that is WRITING files into a reading it
 * holds is making no such claim and wants {@link following} below, which builds
 * both halves out of the one argument and charges the check accordingly. Called
 * with no `previous` at all this is simply "derive a view of this set", which is
 * what a fixture and a test vault want.
 */
export const reading = (set: OutlineSet, previous?: Previous): Reading => {
  const view = viewOf(set, previous)
  return { set, derived: view.derived, pointing: view.pointing }
}

/**
 * THE READING THESE FILES LEAVE — the same pair {@link reading} answers, for a
 * caller that is WRITING into a set rather than holding a claim about one.
 *
 * `@olai/ops`' batch fold is that caller and it is the only one: it plans op
 * two against the set op one would leave, so per op it has a reading in hand
 * and a handful of freshly serialised documents to put into it. It used to
 * spell that itself — `reading(withDocuments(set, written), {read, delta})`,
 * with the `delta` built beside `written` out of the same loop — and paid
 * {@link viewOf}'s disagreement check for the privilege: a walk of every record
 * in the directory, per op, to test a claim it had just made twice. That is the
 * one per-op corpus-scaled term `perf-batch-assemble` left standing, and this
 * function is `perf-reading-patched-check` taking it out.
 *
 * **THE CLAIM AND THE CHECK ARE THE SAME SENTENCE HERE, so there is nothing
 * left to test.** What {@link viewOf}'s walk defends against is a DELTA THAT
 * MISSED A FILE, and it is a disagreement check rather than a proof of the
 * delta precisely because somebody else is making the claim: the store's set
 * comes from a directory of decoded files and its delta comes from a probe's
 * list of which of them ticked, so "these paths are every path that moved" is a
 * sentence that can be wrong, and the check is what makes it cost a rebuild
 * rather than a wrong answer. Here both halves come from ONE argument — the set
 * is {@link withDocuments} of `written` and the delta is the outlines in
 * `written` — so there is no second source to disagree with the first. The
 * corpus walk was this function checking itself.
 *
 * **WHAT IS STILL CHECKED is what this function DID**, per file it was handed
 * rather than per file the directory holds ({@link viewAfter}). It is the same
 * identity question {@link isSet} asks — is the record the view kept THIS
 * record — asked of the op's own footprint, and a disagreement declines the
 * patch and rebuilds exactly as {@link viewOf} does. So this is a narrowing of
 * that check and not the removal of one, and the thing it still catches is the
 * coupling the corpus walk was catching incidentally: the patcher SORTS the
 * records it is handed ({@link ./patch.ts}'s `regrouped`) where the set holds
 * them as the file spells them, so a file whose records did not arrive in line
 * order is a file the two would file differently.
 *
 * **AND THE REST OF THE CORPUS IS CARRIED RATHER THAN WALKED.** A
 * {@link Reading} is a set and the view it was JUDGED against — that is the
 * type's whole promise, and every door that makes one keeps it. So the files
 * this op did not touch are files the reading handed in has already been held
 * against; {@link withDocuments} carries their documents across by identity,
 * {@link patched} carries their `byFile` entries across by identity, and the
 * two orders are one comparator (`byPath`) on both sides. Walking them again
 * per op re-derived, N times, a fact op one had already established.
 *
 * The two claims have their own gates rather than a paragraph here:
 * `@olai/ops`' `following.equivalence.test.ts` holds this door to the checked
 * one at every op of a scripted batch, view and set both, and
 * `./validate.walks.test.ts` counts the records each of them reads.
 */
export const following = (
  read: Reading,
  written: ReadonlyArray<Document>,
): Reading => {
  const set = withDocuments(read.set, written)
  const view = viewAfter(read.derived, written)
  return {
    set,
    derived: view ?? derive(recordsIn(set)),
    // WHAT POINTS WHERE reads the two SETS rather than the delta, so it is
    // offered whichever way the view went — including the rebuild, since a
    // patcher that declined has said nothing at all about what any file points
    // at ({@link viewOf} makes the same call for the same reason).
    pointing: repointed(read.pointing, read.set.documents, set.documents),
  }
}

/**
 * The view after these files are written into the one that stands — patched
 * where the written records line up, `undefined` where they do not.
 *
 * {@link viewOf}'s two halves with the corpus taken out of both: the patch, and
 * the identity check narrowed to the paths that were WRITTEN. It answers
 * `undefined` for the four reasons that function rebuilds — the patcher
 * declined, a written file is not filed where it was written, it is filed
 * holding something other than what was written, or the write is one this
 * delta cannot describe at all (below) — and its caller spends the same rebuild
 * {@link viewOf}'s last line does.
 *
 * THE DELTA IS BUILT HERE, out of the documents themselves, which is the whole
 * of why the narrowing is sound: a caller cannot hand in a `written` and a
 * delta that disagree, because there is one of them. A `.md` contributes no
 * upsert — the fold writes one beside an outline in a single op — and that is
 * the same sentence {@link isSet} says from the other side: {@link
 * Derived.byFile} keys the RECORDS a path holds, and a path holding a body
 * holds none, so a file with nothing in it is spelt as no key at all rather
 * than as an empty one.
 *
 * **LAST-WINS BY PATH, over the WHOLE list**, and that is the one thing this
 * had to be told rather than left to read naturally. {@link withDocuments}
 * decides a path by the last document in `written` that names it, whatever kind
 * it is; a loop that filtered to the outlines first would decide it by the last
 * OUTLINE, and a `written` naming one path in two kinds would then leave the
 * set holding the body and the view still holding the outline's records — a
 * view that is not about the set, arrived at through the guard rather than
 * caught by it (pi's probe on PR 397; the whole-corpus check declined the same
 * input). The two halves of the one argument are read the one way, and a path
 * whose surviving document holds no records while the view files some there is
 * a write this cannot describe: it DECLINES, which is the answer the corpus
 * walk gave. No op the plan layer builds can produce such a list — the two
 * document verbs write no outline at all — but the door is exported, and a
 * safety argument that rests on a caller's good taste is not one.
 */
const viewAfter = (
  before: Derived,
  written: ReadonlyArray<Document>,
): Derived | undefined => {
  const surviving = new Map<string, Document>()
  for (const document of written) surviving.set(document.path, document)
  const upserts: Array<readonly [file: string, entry: FileNodes]> = []
  for (const [file, document] of surviving) {
    if (isOutline(document)) {
      upserts.push([file, { nodes: document.nodes }])
    } else if (before.byFile.has(file)) {
      return undefined
    }
  }
  const view = patched(before, { upserts, removes: [] })
  if (view === undefined) return undefined
  for (const [file, entry] of upserts) {
    const records = view.byFile.get(file)
    // ABSENCE IS HOW A FILE WITH NO RECORDS IS SPELT ({@link Derived.byFile}),
    // which is the one place this differs from comparing two lengths: a file
    // written empty must have no key, and a file written full must have one.
    if (records === undefined) {
      if (entry.nodes.length > 0) return undefined
      continue
    }
    if (records.length !== entry.nodes.length) return undefined
    // THE RECORDS THEMSELVES, by identity and in order — {@link isSet}'s
    // question, asked of this file. The order is what the sort above it makes
    // checkable at all: the view holds these records in line order and the set
    // holds them as the file spells them, and this is where the two are held to
    // being one thing.
    for (let at = 0; at < records.length; at++) {
      if (records[at] !== entry.nodes[at]) return undefined
    }
  }
  return view
}

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
 * IT SAYS WHICH WAY IT WENT, and since the flip that word decides which arm
 * answers: a narrowed verdict is only sound over a view that really was patched
 * from the one it is narrowing against ({@link ./incremental.ts}'s first fact),
 * and a rebuild carries no such relation — so a rebuilt view is `rebuilt` at
 * {@link narrowly}'s second door and the whole corpus is walked. It asks
 * {@link patched} rather than `patch` for that word — the patcher with its
 * fallback taken off, which is the same door `./patch.test.ts` uses to count
 * declines. The fallback the patcher would have taken is this function's own
 * last line, and the two are the same value: `derive` over the delta applied
 * to the previous grouping and `derive` over the set's own records are one
 * array whenever {@link isSet} would have passed, and whenever it would not,
 * this is the rebuild that used to happen anyway — one derivation now where a
 * missed file used to cost two.
 */
const viewOf = (set: OutlineSet, previous: Previous | undefined): Taken => {
  // WHAT POINTS WHERE is carried across the same step and by its own rule
  // ({@link ./pointing.ts}). It reads the two SETS rather than the delta, so it
  // is offered whenever a previous reading is — including on the revisions the
  // derivation gives up on, since a patcher that declined over a duplicate id
  // has said nothing at all about what any file points at.
  const pointing = previous === undefined
    ? pointingOf(set.documents)
    : repointed(previous.read.pointing, previous.read.set.documents, set.documents)
  if (previous !== undefined) {
    const view = patched(previous.read.derived, previous.delta)
    if (view !== undefined && isSet(view, set)) {
      return { derived: view, pointing, patched: true }
    }
  }
  return { derived: derive(recordsIn(set)), pointing, patched: false }
}

/** A view, and whether it was PATCHED from the reading this validation follows
 *  — see {@link viewOf}'s last paragraph for who asks and why. */
interface Taken {
  readonly derived: Derived
  readonly pointing: Pointing
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

