/**
 * THE SAME VERDICT, REACHED FROM WHAT MOVED — the validator narrowed to the
 * records an edit could have changed.
 *
 * `./validate.ts` runs six whole-set rules, and five of them walk every record
 * in the directory on every write (roadmap `perf-validate-incremental`; the
 * costs are in `docs/brainstorming/model-indices.md:57`). This is the other way
 * to reach the same answer: the previous verdict, the previous view, and a
 * delta naming the files that moved are enough to say which findings could
 * possibly be different, and every other record's answer is the one it already
 * had.
 *
 * IT IS A SHADOW AND IT IS NOT AUTHORITATIVE. Every write runs both arms
 * ({@link ./shadow.ts}); the full validator's verdict is what the product
 * obeys, and this one's is compared and thrown away. Making it authoritative is
 * a later PR of ONE LINE, gated on the divergence log being empty and on a
 * soak — see `./shadow.ts` for the gate and the deadline. Nothing here may be
 * read as "the validator now does this".
 *
 * ## What it rests on, in one place
 *
 * Four facts, and the narrowing below is unsound without any of them. Three are
 * checked at the door ({@link incrementally}) and the fourth is the patcher's
 * own published invariant.
 *
 *   1. **The patch was TAKEN.** {@link ./patch.ts}'s `patched` builds the new
 *      view by re-filing only the files the delta names, so every other file's
 *      records are the same OBJECTS in the same order — and `./validate.ts`'s
 *      `isSet` has already checked that the result really is a view of the set
 *      being judged. A rebuilt view carries no such relation to the previous
 *      one, and the narrowing declines.
 *   2. **The previous verdict was CLEAN.** A set with a finding in it is never
 *      published, so the reading a validation is handed to follow is always one
 *      that passed ({@link ../../store/src/codec.ts}'s `Since` holds the last
 *      value the codec ANSWERED with). That is what makes "every untouched
 *      record was fine" a fact rather than a hope, and it is why this file
 *      carries no machinery for merging old findings with new ones: there are
 *      no old findings. A ledger that says otherwise declines.
 *   3. **The corpus is duplicate-free.** Not an assumption but the patcher's
 *      gate read out loud ({@link claimsAreUnique}): `patched` hands a corpus
 *      with two claims on one id straight back to `derive`, and refuses to let
 *      an arriving record claim an id an untouched file already holds. So a
 *      patched view has exactly one record per id, which is the whole of the
 *      duplicate-id rule's answer and the reason `byId.get(x)` is "the record
 *      that claims x" rather than "the first of several".
 *   4. **Nothing outside the delta moved** — for the OUTLINES, checked by
 *      `./validate.ts`'s `isSet` before this is ever called, and for the
 *      DOCUMENTS, checked here ({@link carriedDocuments}). That split is not
 *      tidiness: `isSet` compares a view against a set and a view holds no
 *      documents, so it is structurally unable to witness the half this file's
 *      `doc` rule spends. The store claims the delta names every path that
 *      moved; a `.md` it missed would leave the outlines matching, the patch
 *      taken, and the carried `.md` list quietly wrong — a `ledger` divergence
 *      today and a missed `missing-doc` after the flip. So the carry is held
 *      against the set it is about, every time, and a disagreement DECLINES
 *      rather than answering. It is one pass of membership tests over the
 *      documents, allocating nothing, where building the list afresh allocates
 *      three arrays the size of the directory's `.md` count.
 *
 * ## The narrowing, rule by rule
 *
 * Each of the six says which INDEX it reads to find the records it must
 * re-ask, and every one of those indexes is already maintained by the patcher
 * — this file adds no index and no bookkeeping of its own to the write path.
 *
 *   - **duplicate ids** — nothing to ask. Fact 3 says the corpus has none, so
 *     the rule's answer is the empty list, in `O(files)`.
 *   - **parents** — {@link Derived.children}, which is `parent` read backwards
 *     and is keyed by the id AS WRITTEN, dangling ones included. A record's
 *     three parent findings are decided by the id it names and by the record
 *     that claims that id, so the records to re-ask are the edited ones plus
 *     the children of every id whose claimant moved.
 *   - **unknown targets** — {@link Derived.namedBy}, `targetsOf` read
 *     backwards, and {@link Derived.byId}. An id dangles when something names
 *     it and nothing declares it, and both halves of that can only have changed
 *     for an id the edit named or an id whose claimant moved.
 *   - **the three cycle walks** — no index: the trigger is the SHAPE of what
 *     was replaced ({@link structural}). A loop is a claim about the graph, and
 *     an edit that left every `parent`, `mirror`, `after` and `blocks` in the
 *     corpus where it was left the graph where it was. That is the narrowing
 *     `model-indices.md:57` names, and it is why a keystroke, a mark, a date or
 *     a re-ordering pays no cycle walk at all while a reparent pays the full
 *     one.
 *   - **documents** — {@link Ledger.known}, the set of `.md` paths, carried
 *     from the last validation and kept current from the delta's own file names
 *     ({@link ./rules.ts}'s `markdownPaths` argues why a path decides it). A
 *     record's `doc` resolves against files, so only a `.md` that WENT AWAY can
 *     break a record nobody edited.
 *
 * ## What it costs
 *
 * The touched files' records, twice (once as they were, once as they are), plus
 * one index lookup per id they claim and per id they name. Nothing here is
 * proportional to the directory except the two arms it declines to narrow — the
 * cycle walks, when the graph moved — and `./validate.bench.ts` prints both.
 */

import { byCorpus, type Derived } from "./derive.ts"
import { isMarkdown } from "./document.ts"
import type { OutlineError } from "./errors.ts"
import { fileKind } from "./kinds.ts"
import { isMirror, type Located, targetsOf } from "./node.ts"
import { claimsAreUnique, recordsIn, type SetDelta, touchedBy } from "./patch.ts"
import {
  reportAfterCycles,
  reportDocs,
  reportMirrorCycles,
  reportParentCycles,
  reportParents,
  reportUnknownTargets,
} from "./rules.ts"
import type { OutlineSet } from "./set.ts"

/**
 * WHAT ONE VALIDATION LEAVES FOR THE NEXT — the whole of the state this
 * narrowing carries, and deliberately two fields.
 *
 * `errors` is the previous verdict's RAW findings, before the error scope takes
 * the withheld ones out ({@link ./rules.ts}'s `reportOf`): what the narrowing
 * needs to know is whether any rule found anything at all, not what a reader
 * was shown. `known` is the `.md` paths that verdict was reached against, which
 * is the one whole-corpus reading the rules do that is not a walk of the
 * records.
 *
 * It is kept BESIDE the view rather than inside it ({@link ./shadow.ts} holds
 * the table) for the reason `Derived` holds indexes and not verdicts: a view is
 * what a set MEANS, and every reader of one — the browser, the planner, the
 * publisher — would otherwise carry a validator's scratch space around with it.
 */
export interface Ledger {
  readonly errors: ReadonlyArray<OutlineError>
  readonly known: ReadonlySet<string>
}

/**
 * What the narrowed arm answered — the ledger for whoever follows, and one
 * word about what this run COST.
 *
 * `walked` is the honest half. Two of the six rules can decline to narrow and
 * fall back to the corpus — the cycle walks when the graph moved, and the `doc`
 * rule when a `.md` went away — so a run that says `true` did the very
 * whole-corpus work this whole file exists to avoid. It is a fact the shadow
 * OBSERVED, published on the one channel the shadow has out
 * ({@link ./shadow.ts}'s `Seen`); what spends it today is the property test's
 * ceiling, which is what stops a narrowing that walked every time from passing
 * as one that narrowed. A soak that wanted the same number could count it from
 * the same place, and the two rows of `./validate.bench.ts` say what the two
 * fallbacks cost, which is nothing like each other.
 */
export interface Narrowed {
  readonly ledger: Ledger
  readonly walked: boolean
}

/**
 * WHY the narrowing turned back — one word per door, and a word rather than a
 * bare `null`.
 *
 * A decline is not a failure and is not a divergence: it is the ordinary answer
 * for a rebuild, a first load, or a validation following one that was refused.
 * But "cold" was ONE bucket for four different things, and a property test
 * asserting a floor on the sum could not say the run had reached the right
 * kinds — so the reason travels with the decline, the shadow puts it on the
 * witness, and the floors below it are claims rather than a total.
 *
 * A decline is published rather than swallowed for {@link ./patch.ts}'s reason:
 * a narrowing that quietly fell back to walking the corpus would agree with the
 * full arm on every write and prove nothing.
 */
export type Decline = "refused" | "duplicates" | "documents"

/**
 * The narrowed verdict, or the word for why there is none
 * ({@link Decline} — a string, so `typeof` is the narrowing).
 */
export const incrementally = (
  set: OutlineSet,
  before: Derived,
  ledger: Ledger,
  delta: SetDelta,
  derived: Derived,
): Narrowed | Decline => {
  // Fact 2: a verdict with anything in it belongs to a set that was refused,
  // and a refused set is not one anybody published — so there is nothing here
  // to carry, and no claim that the untouched records were ever found clean.
  if (ledger.errors.length > 0) return "refused"
  // Fact 3, asked rather than assumed. It is `O(files)` and it is what the
  // duplicate-id rule's whole answer rests on, so it is cheaper to check than
  // to argue about at four in the morning.
  if (!claimsAreUnique(derived)) return "duplicates"

  const touched = touchedBy(delta)
  // The touched files' records as they WERE and as they ARE. Everything below
  // is a question about one of these two lists or about an index keyed by what
  // they claim, which is the bound this whole file promises.
  const gone = recordsIn(before.byFile, touched)
  const fresh = recordsIn(derived.byFile, touched)

  // Every id whose CLAIMANT moved — the ids leaving with the old records and
  // the ids arriving with the new ones, as one set. A union rather than a
  // difference: a record re-decoded in place is a different object at the same
  // id, and two rules below resolve an id to the record itself.
  const moved = new Set<string>()
  for (const at of gone) moved.add(at.node.id)
  for (const at of fresh) moved.add(at.node.id)

  const errors: Array<OutlineError> = []

  // ids — see fact 3. The empty list, and it is the rule's real answer rather
  // than a rule skipped.

  // parents: the edited records, and whoever hangs off an id whose claimant
  // moved. `children` is keyed by the parent id as WRITTEN, so a record whose
  // parent is an id nothing declares is filed there too and is re-asked when
  // that id arrives.
  const asking = new Set<Located>(fresh)
  for (const id of moved) {
    for (const child of derived.children.get(id) ?? []) asking.add(child)
  }
  reportParents(asking, derived, errors)

  // The three cycle walks, in the full arm's own order so that two findings at
  // one site cannot come out in two orders. Either the graph moved and all
  // three run exactly as they always did, or it did not and the previous
  // verdict's answer — no loops, by fact 2 — is still the answer.
  const moving = structural(gone, fresh)
  if (moving) reportParentCycles(derived.nodes, derived, errors)

  // targets: every id the edit NAMED, from either side, plus every id whose
  // claimant moved. One sentence rather than two: those are exactly the ids
  // whose entry in `namedBy` or in `byId` this delta could have touched, and an
  // id in neither has the answer it had — which was that it does not dangle.
  const named = new Set<string>(moved)
  for (const at of gone) for (const [, id] of targetsOf(at.node)) named.add(id)
  for (const at of fresh) for (const [, id] of targetsOf(at.node)) named.add(id)
  const dangling: Array<string> = []
  for (const id of named) {
    if (derived.namedBy.has(id) && !derived.byId.has(id)) dangling.push(id)
  }
  // PUT BACK IN `namedBy`'s KEY ORDER, which is the order the report promises
  // for two findings at one site ({@link ./rules.ts}'s `reportUnknownTargets`).
  // Sorted rather than maintained: a valid corpus has no dangling ids at all,
  // so this list is nearly always empty and the sort is nearly always free —
  // where keeping a dangling set in corpus order across every edit would be a
  // second index, maintained on the write path, for the benefit of sets the
  // validator is about to refuse anyway.
  dangling.sort((one, other) => byNaming(derived, one, other))
  reportUnknownTargets(dangling, derived, errors)

  if (moving) {
    reportAfterCycles(derived.nodes, derived, errors)
    reportMirrorCycles(derived.nodes, derived, errors)
  }

  // documents: the `.md` paths carried forward and brought up to date from the
  // delta's own file names, removals first and then the changes, which is the
  // order a delta is applied in ({@link ../../store/src/codec.ts}'s `Since`
  // says why a path can be in both lists).
  const known = new Set(ledger.known)
  const lost: Array<string> = []
  for (const file of delta.removes) if (known.delete(file)) lost.push(file)
  for (const [file] of delta.upserts) if (markdownPath(file)) known.add(file)
  // Fact 4's document half, asked of the SET rather than assumed of the delta
  // — see this file's header. A `.md` the delta did not name leaves the
  // outlines matching and this list quietly wrong, and there is no other door
  // that could notice.
  if (!carriedDocuments(known, set)) return "documents"
  // A `doc` that resolved before goes on resolving unless the file it named
  // LEFT, so a directory that only gained documents re-asks nothing. When one
  // did leave, every record's `doc` is back in question and the rule runs whole
  // — there is no index from a resolved path back to the records that name it,
  // and inventing one for a file deletion would be bookkeeping on every write
  // to save a walk on almost none.
  const walking = lost.some((file) => !known.has(file))
  reportDocs(walking ? derived.nodes : fresh, known, errors)

  return { ledger: { errors, known }, walked: moving || walking }
}

/**
 * Whether the edit moved anything the three cycle walks can see.
 *
 * The graph is `parent`, `mirror`, `after` and `blocks` over the corpus, and
 * the findings it produces name a `file:line` — so what has to be unchanged is
 * that projection of every record, and the records outside the touched files
 * are the same objects (fact 1). This compares what the touched files gave up
 * against what they brought in, AS A MULTISET: a record that swapped places
 * with another carrying the same tuple leaves both the graph and every site
 * where they were, and a generator that swaps two lines is exactly how a
 * property test gets there.
 *
 * WHAT IS NOT IN THE PROJECTION is as load-bearing as what is: a title, a note,
 * a mark, a date, a `doc`, a `see`, an `ord`, a `custom` key. None of them is
 * an edge and none of them is a place, so the overwhelmingly common edits — a
 * keystroke, a checkbox, a scheduling, a drag between siblings — leave this
 * false and pay no cycle walk at all. `see` is in `targetsOf` and NOT here on
 * purpose: it is a soft reference the ordering graph does not normalise
 * ({@link ./derive.ts}'s `orderings` reads `after` and `blocks` only), so a
 * `see` that closes a loop is not a loop.
 */
const structural = (
  gone: ReadonlyArray<Located>,
  fresh: ReadonlyArray<Located>,
): boolean => {
  if (gone.length !== fresh.length) return true
  const held = new Map<string, number>()
  const tally = (at: Located, by: number): void => {
    const shape = shapeOf(at)
    held.set(shape, (held.get(shape) ?? 0) + by)
  }
  for (const at of gone) tally(at, 1)
  for (const at of fresh) tally(at, -1)
  for (const count of held.values()) if (count !== 0) return true
  return false
}

/** One record's place and its edges, as a key — see {@link structural} for what
 *  each field is doing here and what a missing one would cost. */
const shapeOf = (at: Located): string =>
  JSON.stringify([
    at.file,
    at.line,
    at.node.id,
    at.node.parent ?? null,
    isMirror(at.node) ? at.node.mirror : null,
    isMirror(at.node) ? null : at.node.after ?? null,
    isMirror(at.node) ? null : at.node.blocks ?? null,
  ])

/**
 * Two dangling ids, in the order {@link Derived.namedBy} holds their keys.
 *
 * That map is built by one walk of the corpus filing each record's targets, so
 * a key sits where the record that FIRST named it sits — and where two ids are
 * first named by one record, in the order that record's own fields name them
 * ({@link targetsOf}). Both halves are read straight off the index rather than
 * reconstructed: the first naming is the head of the key's list, and the field
 * order is the record's.
 *
 * A key whose list is empty cannot happen — `namedBy` files a key by filing a
 * naming into it — and the fallback ties rather than throwing, because a
 * comparator is not where a shadow gets to take the process down.
 */
const byNaming = (derived: Derived, one: string, other: string): number => {
  const first = derived.namedBy.get(one)?.[0]?.at
  const second = derived.namedBy.get(other)?.[0]?.at
  if (first === undefined || second === undefined) return 0
  if (first !== second) return byCorpus(first, second)
  for (const [, id] of targetsOf(first.node)) {
    if (id === one) return -1
    if (id === other) return 1
  }
  return 0
}

/**
 * Whether a path is one of the `.md` files a `doc` may point at — the kind
 * registry's answer about a NAME.
 *
 * A DELTA NAMES PATHS and the set holds DOCUMENTS, so the two halves of the
 * carry ask the same question two ways: this one of a path, and
 * {@link ./document.ts}'s `isMarkdown` — which is what `markdownPaths` narrows
 * by — of a decoded document's kind. They agree because a kind is decided by
 * the name ({@link ./set.ts}'s `assemble` gives a file that would not decode an
 * empty document OF ITS OWN KIND), and {@link carriedDocuments} is what holds
 * them to it: the day they part, the carry stops matching the set and the
 * narrowing declines instead of answering.
 */
const markdownPath = (file: string): boolean => fileKind(file) === "document"

/**
 * Whether the `.md` paths this edit CARRIED are the ones the set actually
 * holds — fact 4, asked for documents.
 *
 * MEMBERSHIP AND A COUNT, which together are set equality and neither of which
 * is on its own: every markdown the set holds is in the carry, and there are as
 * many of them as the carry has entries. A count alone is the proxy that let
 * last night's published-maps bug through — a file leaving as another arrives
 * keeps a count still — and membership alone would miss a carry that had grown
 * an extra path.
 *
 * One pass, no allocation. `markdownPaths` builds the same answer with three
 * arrays the size of the directory's `.md` count, which is exactly what the
 * carry exists to stop paying per write.
 */
const carriedDocuments = (known: ReadonlySet<string>, set: OutlineSet): boolean => {
  let held = 0
  for (const document of set.documents) {
    if (!isMarkdown(document)) continue
    held++
    if (!known.has(document.path)) return false
  }
  return held === known.size
}
