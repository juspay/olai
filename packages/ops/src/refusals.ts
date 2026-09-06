/**
 * The sentences this layer says NO with — the ones more than one caller owes.
 *
 * A refusal here is a VALUE, never a throw: an `OpFailure` carrying the words
 * somebody reads and, where the validator spoke, its own rows pinned to
 * `file:line`. What makes these particular ones a module is that each is said
 * by callers who cannot both own it — a WRITE and a READ meet the identical
 * typo, the identical mirror, the identical file nobody could parse — and a
 * caller who mistypes a path once should not learn two different things about
 * it depending on which verb the typo landed at. Two spellings of one "no" is
 * the drift this file exists to make unwritable.
 *
 * They lived in {@link ./plan.ts} until now, and that was an accident of who
 * said each of them first: the planner is where a refusal is usually raised,
 * so it is where each of these was born, and {@link ./query.ts} — pure reads,
 * which plan nothing — imported three of them from the write planner in order
 * to say what a write says. Nothing about the sentences is a planner's: not
 * one of them takes a planning scope, and not one of them knows a request
 * exists. So they are HERE, where a read reaches them without reaching through
 * the writer, and the planner imports them like anybody else (#320's altitude
 * review, deferred there because the move is a move and that branch was about
 * batching reads).
 *
 * What is NOT here is every other "no" in the package. A refusal exactly one
 * op can make stays beside that op, because the reason it is worded as it is
 * IS the reason that op refuses; a drawer holding all of them would be a place
 * to look things up rather than a thing two callers share.
 */

import {
  bodyKind,
  type Derived,
  didYouMean,
  didYouMeanDeclared,
  isOutline,
  markdownIn,
  NotFoundFailure,
  type OpFailure,
  type Outline,
  type OutlineError,
  type OutlineSet,
  UsageFailure,
  ValidationFailure,
  verdictOf,
} from "@olai/format"
import { Result } from "effect"

import type { Asked } from "./asked.ts"

/**
 * An id nothing in the set declares — ONE refusal, whatever the id was doing.
 *
 * The node an op is about and a target it was asked to point at fail the same
 * way and want the same help, so they are one function rather than two
 * sentences: an agent that mistyped `instal` is in the same position whether it
 * was marking that node or hanging a mirror off it.
 *
 * It teaches the way the VALIDATOR does, with the validator's own rule
 * (`@olai/format`'s `nearestDeclared`): an unknown reference is nearly always a
 * misspelling, so the closest id within a typo's distance is offered and
 * anything further away is not, because a guess that is merely nearest teaches
 * a reader to distrust the offer. Where there is nothing close, the answer names
 * the tool that finds a node without knowing its id.
 *
 * `see` used to LIST every id in the set here. That is the right answer for the
 * OUTLINES of a directory — there are five of them — and the wrong one for the
 * nodes in it: a vault of a few thousand put its whole id space in one refusal,
 * with the one id worth reading somewhere in the middle of it.
 *
 * Exported over the DERIVATIONS rather than over a planning scope because the
 * miss is not only the planner's: `@olai/server` resolves a keystroke into a
 * request and meets the same missing id on the way there, and a person told
 * one sentence by the agent and another by the keyboard would be reading two
 * products.
 */
export const notFound = (derived: Derived, id: string): OpFailure =>
  missingId(id, derived.byId)

/**
 * The same sentence over whatever ids are KNOWN — the set's, or the set's plus
 * the ones a capture is about to mint.
 *
 * Split out for exactly one caller ({@link ./plan.ts}'s `wiring`): a capture's
 * edges may name a sibling in the same call, so an id that is a typo of one of
 * THOSE has to be offered too. A second spelling of this refusal would be a
 * `see` target corrected one way by `set_see` and another by `add_node`.
 *
 * IT TAKES THE MAP, not the ids, and the extra candidates BESIDE it rather than
 * concatenated onto it — which is what lets the offer be answered off an index
 * held against the derivation instead of a walk of every id per refusal
 * (`@olai/format`'s `./suggest.ts`, roadmap `perf-didyoumean`). A stale tab
 * replaying twenty refused edits is the shape that motivated it; the handful a
 * capture is minting stay a walk, and stay LAST, so a tie still goes to the id
 * the set already declares.
 */
export const missingId = (
  id: string,
  known: ReadonlyMap<string, unknown>,
  /** The ids a call is about to bring into being, if any — see above. */
  minting?: Iterable<string> | undefined,
): OpFailure => {
  // The CLAUSE is the format's too, not just the budget behind it: a refusal
  // and a load error say "did you mean" in one voice or in two.
  const near = didYouMeanDeclared(id, known, minting)
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${id}\` is not a node in the loaded set, and nothing in it is spelled ` +
        `close enough to be a typo of it — \`search_nodes\` finds a node by title, ` +
        `id or \`#tag\``
      : `\`${id}\` is not a node in the loaded set${near}`,
    named: id,
  })
}

/**
 * "That id is a placement, not a node — name the node."
 *
 * Exported for the reason {@link notFound} is: a caller ABOVE this layer meets
 * the same id and owes the same sentence. `@olai/server` resolves the nodes a
 * chat message is about the same way an op resolves the node it edits, and a
 * mirror is no more describable than it is editable — two spellings of this
 * would be two answers to one question about one id.
 */
export const notANode = (id: string, target: string): OpFailure =>
  new UsageFailure({
    reason: `\`${id}\` is a mirror — a second placement of \`${target}\`, ` +
      `not a node of its own. Name \`${target}\` instead.`,
  })

/**
 * WHAT A PATH THAT IS NOT A DOCUMENT IS TOLD — one sentence, for every verb
 * that can be handed one.
 *
 * {@link notFound}'s counterpart for the other thing an op can name. A
 * `write_document` and a `read_document` refuse the same miss, and each built
 * the same near-miss list out of the same set and then wrote the same sentence
 * before this was one function: a caller who mistypes a path once should not
 * learn two different things about it depending on which verb the typo landed
 * at. The near miss is `didYouMean` — the same function an unknown node id
 * gets, one moment earlier than the validator would give it.
 *
 * WHAT EACH CALLER KEEPS is the clause for a set with no near miss at all,
 * because there the useful thing to say genuinely differs: a read is pointed
 * at the listing, a write at the verb that starts a document. That is the one
 * per-verb part, so it is the one part passed in.
 *
 * HERE rather than on the floor, which is where it was first written. The
 * format declares what a refusal IS ({@link ../../format/src/failure.ts}) and
 * this layer is the only one that raises one — a package that started
 * composing agent-facing prose would be a second voice for the same "no".
 * `markdownIn` and `didYouMean` are down there, and they are the two FACTS
 * this sentence is made of.
 *
 * It takes the SET rather than a scope: {@link ./query.ts} calls it over a bare
 * one, which is what a read has.
 */
export const noSuchDocument = (
  set: OutlineSet,
  file: string,
  instead: string,
): OpFailure => {
  const near = didYouMean(file, markdownIn(set).map((entry) => entry.path))
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${file}\` is not a document under the served directory — ${instead}`
      : `\`${file}\` is not a document under the served directory${near}`,
    named: file,
  })
}

/**
 * WHAT A PATH THAT IS NOT AN OUTLINE IS TOLD — {@link noSuchDocument}'s twin
 * over the other kind of file, and the same sentence for every verb that can be
 * handed one.
 *
 * TWO CALLERS AND ONE VOICE, which is the whole of why it has a name: a write
 * placing a node at the top level of a file ({@link ./plan.ts}'s `landsIn`) and
 * a read asking for a whole outline ({@link ./query.ts}'s `subtree`) meet the
 * identical typo, and a caller who mistypes a path once should not learn two
 * different things about it depending on which verb the typo landed at.
 *
 * IT TEACHES BOTH WAYS, and which one it uses is decided by the set rather than
 * by the caller. Close enough to be a typo, and it names the candidate — the
 * `didYouMean` budget every unknown id and every unknown document path is
 * already offered. Nothing close, and it LISTS the outlines, which is the right
 * answer here for exactly the reason it is the wrong one for a node id
 * ({@link notFound} argues the split): a directory has a handful of outlines
 * and a few thousand nodes.
 */
const noSuchOutline = (asked: Asked, file: string): OpFailure => {
  const outlines = asked.outlines
  const near = didYouMean(file, outlines)
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${file}\` is not an outline under the served directory: ` +
        `${outlines.join(", ") || "there are none"}`
      : `\`${file}\` is not an outline under the served directory${near}`,
    named: file,
  })
}

/**
 * THE OUTLINE AT THIS PATH, or the refusal that says why not — {@link
 * ./plan.ts}'s `regularAt` counterpart for the other thing an op can name.
 *
 * The GUARD and the sentence together, because they are one question asked
 * twice over: a write placing a node at a file's top level ({@link ./plan.ts}'s
 * `landsIn`) and a read asking for a whole outline ({@link ./query.ts}'s
 * `subtree`) both have to decide whether a path names an outline this
 * directory serves, and both owe the same answer when it does not. Extracting
 * only the sentence left the test in front of it copied — two lines apart, in
 * two files — so a third verb naming an outline would have copied both halves
 * again.
 *
 * `isOutline` is the FORMAT's kind test, named there rather than spelled as a
 * `kind` comparison wherever it is wanted (`@olai/format`'s `document.ts`), and
 * the point lookup that answers what is at a path at all is the context's
 * ({@link ./asked.ts}). This composes the two; it decides nothing of its own.
 *
 * IT TAKES THE ASKING rather than the set, since `perf-batch-assemble`: what a
 * path holds is one of the three questions a planner used to ask the directory
 * per op, and the point of that node was that they are asked once and handed
 * over. A read holds no batch and no context to carry, so `read_subtree` builds
 * one for the call (`./query.ts`) — which costs nothing, because the answers
 * inside one are held with the set and computed only when somebody asks.
 */
export const outlineAt = (
  asked: Asked,
  file: string,
): Result.Result<Outline, OpFailure> => {
  const found = asked.at(file)
  if (found === undefined || !isOutline(found)) {
    return Result.fail(noSuchOutline(asked, file))
  }
  return Result.succeed(found)
}

/**
 * WHY the set does not hold what is in this file — one fact about the FILE,
 * independent of who is asking.
 *
 * The two kinds fail differently and a reader is owed which: a body is read or
 * it is not, and an outline is READ perfectly well and then has lines the
 * format cannot take. Three verbs meet that fact — the write gate ({@link
 * ./plan.ts}'s `writable`), and the two reads that answer a whole file
 * ({@link notLoaded}) — and they differ
 * only in what they cannot do about it, which is each one's own half of the
 * sentence and stays at each one.
 */
export const notLoadedBecause = (file: string): string =>
  bodyKind(file) !== null
    ? "could not be read, so what it holds is not loaded"
    : "has lines that do not parse, so its records are not loaded"

/**
 * WHAT A FILE THE SET COULD NOT LOAD IS TOLD A READER — a refusal constructor
 * like {@link noSuchDocument} and {@link noSuchOutline} beside it, over the one
 * thing that goes wrong with a path the set DOES hold.
 *
 * ONE SENTENCE FOR THE TWO READS THAT ANSWER A WHOLE FILE. `read_document` and
 * `read_subtree`'s `file` arm meet the identical fact with the identical
 * consequence — the file is there, nobody read what is in it, so there is
 * nothing to answer with — and answering either as an empty document or as an
 * outline holding nothing would be handing back a body nobody read. It is not
 * {@link ./plan.ts}'s `writable` refusal with a different clause: that one is
 * about a WRITE dropping what is not loaded, which is a different thing to be
 * told, and the half the three genuinely share is {@link notLoadedBecause}.
 *
 * The validator's own rows travel with it, for the reason a refused write
 * carries them: fix the file, then read it.
 */
export const notLoaded = (
  file: string,
  errors: ReadonlyArray<OutlineError>,
): OpFailure =>
  new ValidationFailure({
    reason: `\`${file}\` ${notLoadedBecause(file)} — there is nothing to answer ` +
      `with. Fix the file first.`,
    verdict: verdictOf(errors),
  })
