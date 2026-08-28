/**
 * The tags the set already uses, and which of them a prefix means.
 *
 * ## An index read, not a walk
 *
 * {@link Derived.taggedBy} files every record under each tag its title or its
 * note writes, keyed by the written form ({@link ./derive.ts}). So the question
 * this file asks — which tags does the set hold, and how many records carry
 * each — is the keys of that map and the length of each entry, and this module
 * is the READING over it: which of them the trash is out of, and what order to
 * offer them in. It sits beside {@link ./backlinks.ts} for that reason, which
 * is the other reading over the same pair of reverse indexes.
 *
 * IT WALKED THE WHOLE CORPUS ONCE (a `titleParts` per node of the set, per
 * derivation), and the roadmap item that changed it — `mentions-index-one-sigil`
 * — is on the PR with its numbers. The index was already being built for the
 * `@` half; what it cost to file the other sigil too, against what this walk
 * cost, is the trade that branch was asked to measure rather than assume, and
 * `./vocabulary.bench.ts` prints both halves — including the walk AS IT STOOD,
 * which answered a smaller list than either arm of the A/B and is timed beside
 * them so the ratio cannot flatter itself.
 *
 * ## Why it is HERE, and not in the browser where it was
 *
 * It was `@olai/web`'s `complete/tags.ts` until `vault-in-browser`'s PR 2, and
 * that file argued at length for staying: the enumeration was already in the
 * value the tab was holding, so asking the wire for it would have been a round
 * trip to re-derive a fact in hand.
 *
 * The premise went, not the argument. The human's ruling (2026-08-19,
 * `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/vault-in-browser.md`) is that the browser may hold at
 * most the current page's data — never the whole vault — so there is no local
 * `taggedBy` left to enumerate, and the tab that used to answer this for itself
 * now asks (`@olai/web`'s `complete/asking.ts`, over the `vocabulary.tags`
 * procedure). What that file predicted for the day a second face asked is what
 * happened, one door earlier than it expected: the list became a reading, and a
 * reading belongs in this package, where both sides of the wire can call it.
 *
 * ## What is here and what is not
 *
 * {@link vocabularyOf} is the ENUMERATION — every tag of the live set, counted,
 * ranked. {@link completingTags} is the MATCH — which of them one prefix under
 * one sigil means, capped for a popup. Two functions rather than one, because
 * they change at different rates and the split is what makes the memo above
 * worth having: the vocabulary moves when the directory does, and the prefix
 * moves per keystroke.
 *
 * NO MATCHER's worth of anything, and it is worth saying which door this is not.
 * `./filter.ts` reads a QUERY LANGUAGE — four weighted fields, operators, a
 * score — and every search in this product is one caller of it, because two
 * rankings would be two products. What is here is an ENUMERATION with a prefix
 * test over it: no grammar, no score, and nothing an agent's `search_nodes`
 * could disagree with.
 *
 * ## The two sigils are two lists
 *
 * `#alice` and `@alice` are different tags ({@link TAG_SIGILS}), so asking with
 * `@` offers what has been written with an `@` and asking with `#` offers what
 * has been written with a `#`. Offering one namespace's names under the other's
 * sigil would be answering with tags the set does not hold. The index keeps them
 * apart for the same reason, in its keys.
 */

import { Schema } from "effect"

import {
  type Derived,
  TAG_SIGILS,
  type TagSigil,
  tagPart,
} from "./derive.ts"
import { isPutAway, type LocatedRegular } from "./node.ts"

/**
 * What a completion ASKS: one sigil's list, narrowed by what has been typed.
 *
 * A THIRD REQUEST SHAPE beside `./searching.ts`'s two, and deliberately not a
 * flag on either: a search reads a grammar and ranks what it finds, and this
 * reads no grammar at all. The two files are neighbours rather than one because
 * the vocabulary of a set is not a query over it.
 */
export const TagsRequest = Schema.Struct({
  /** WHICH namespace — the whole of what makes this two lists (see the header).
   *  Required, because there is no such thing as the vocabulary of both: a
   *  popup opened by a `#` may not offer an `@`. */
  sigil: Schema.Literals(TAG_SIGILS),
  /** What has been typed after the sigil, folded for case here. EMPTY is a
   *  question rather than a missing one: a bare `#` asks what this set even
   *  uses, and is answered with the head of the list. */
  query: Schema.String,
  /**
   * How many rows to answer with — REQUIRED, and that is the one place this
   * differs from `SearchRequest`, which defaults.
   *
   * A row count is a fact about a DOOR rather than about a question (the same
   * sentence `@olai/ops`' `Query.search` makes about its cap): eight is what a
   * popup under a caret shows, and a floor holding that number would be holding
   * somebody else's layout. With exactly one door there is no honest default to
   * pick — an absent limit would mean whichever number this package guessed —
   * so the door says, every time.
   */
  limit: Schema.Number,
})
export type TagsRequest = typeof TagsRequest.Type

/**
 * One row of the answer: the name, and how much of it there is.
 *
 * NO SIGIL, because the sigil is the QUESTION — every row of one answer carries
 * the same one, and putting it on each would be the request echoed back n
 * times. The caller writing `#home` into a title has it in hand: it is the
 * character that opened the popup.
 */
export const TagCompletion = Schema.Struct({
  name: Schema.String,
  /** How many LIVE records carry it — what orders the list, because the tag
   *  somebody means is usually the tag they have used before. One per record,
   *  however often that record writes it. */
  count: Schema.Number,
})
export type TagCompletion = typeof TagCompletion.Type

/** What the set's tags are, for one sigil and one prefix — ranked, capped, and
 *  nothing else. No total: a shortlist under a caret is not a report, and
 *  "eight of two hundred" is not a sentence anybody would draw there. */
export const TagsAnswer = Schema.Struct({
  tags: Schema.Array(TagCompletion),
})
export type TagsAnswer = typeof TagsAnswer.Type

/** One tag of the live set, as this module counts one. NOT the wire's row: the
 *  fold is a matching cost and the sigil is a bucketing key, and neither is a
 *  thing an answer says. */
export interface TagUse {
  readonly sigil: TagSigil
  /** The name, without the sigil. */
  readonly name: string
  /** ...folded for case, once, when the index is read. Matching happens over
   *  every tag of the set; folding there would be a throwaway string per tag
   *  per question asked. */
  readonly folded: string
  readonly count: number
}

/**
 * ONE READING PER DERIVATION, kept in a `WeakMap` keyed on the derivation
 * itself.
 *
 * The alternative — counting per question — re-reads the index on every settled
 * keystroke of a tag being typed, and the vocabulary of a set cannot have moved
 * between two of them unless the set did. Keyed on the VALUE rather than cached
 * by time, so a revision is read once and the old answer is collectable with
 * the old derivation. It is the same arrangement `./filter.ts` keeps for its
 * per-record fold, one index up.
 */
const counted = new WeakMap<Derived, ReadonlyArray<TagUse>>()

/**
 * Every tag in the set, most-used first and alphabetical within a count.
 *
 * MIRRORS ARE SKIPPED, which is the same rule every other reading of the set
 * follows: a placement has no title of its own, so a tag counted through one
 * would be the same node's tag counted twice. It is the INDEX that skips them
 * here — {@link Derived.taggedBy} files regular records only, and says so in
 * its type — so this reading does not have to remember the rule.
 *
 * A TITLE OR A NOTE, because that is what the index files. A tag somebody wrote
 * in a note is part of the vocabulary this set uses and is worth completing
 * towards; before the index it was invisible here, which was an accident of
 * where the old walk looked rather than a decision anybody made.
 *
 * WHAT WAS PUT AWAY IS SKIPPED, and the count is why (ruled 2026-08-17:
 * archived nodes are drawn on the trash page and nowhere else). This number
 * says how much the LIVE set uses a name, and the list is which names are worth
 * reusing: counting the trash would rank a word by rows only that page draws,
 * and would go on offering a tag whose every user is put away. The tag stays
 * WRITABLE, exactly as any word is — this list is what the set has used, never
 * what a title may say. The index keeps the trash (nothing about storage
 * belongs in a fold over prose), so the skipping is here — over the index's
 * entries rather than over every node of the corpus, and against a set of
 * put-away PATHS judged once ({@link putAway}) rather than a rule asked per
 * entry.
 */
export const vocabularyOf = (derived: Derived): ReadonlyArray<TagUse> => {
  const seen = counted.get(derived)
  if (seen !== undefined) return seen
  const tags = counting(derived)
  counted.set(derived, tags)
  return tags
}

const counting = (derived: Derived): ReadonlyArray<TagUse> => {
  const away = putAway(derived)
  const tags: Array<TagUse> = []
  for (const [written, records] of derived.taggedBy) {
    // A DIRECTORY WITH NOTHING PUT AWAY pays nothing per entry, which is nearly
    // every directory: the count is then the entries themselves.
    const live = away.size === 0 ? records.length : alive(records, away)
    if (live === 0) continue
    const { sigil, tag } = tagPart(written)
    tags.push({ sigil, name: tag, folded: tag.toLowerCase(), count: live })
  }
  return tags.sort((one, other) =>
    other.count - one.count || one.name.localeCompare(other.name)
  )
}

/**
 * Which of the served files are out of the live vocabulary — judged ONCE per
 * derivation, off the file index, rather than per index entry.
 *
 * {@link isTrashed} / {@link isLeftoverArchive} are questions about a PATH, and
 * `./node.ts`'s own note beside them says they are meant to be asked once per
 * file per probe. This reading has an entry per (record, tag) pair to get
 * through — more entries than the directory has files, by a lot, on a set where
 * a name is written on a thousand rows — so asking them there would put a
 * string comparison where the whole point of the index is that there is no walk
 * left. The saving is measured: 0.63ms → 0.34ms per derivation on the bench
 * vault (`./vocabulary.bench.ts`).
 *
 * WHAT IS LEFT is one map lookup per entry, and the honest word for the shape
 * of this reading is not "a handful": it is one pass over every (record, tag)
 * pair the directory holds. What the index bought is not fewer entries — it is
 * that none of them costs a regex.
 */
const putAway = (derived: Derived): ReadonlySet<string> => {
  const away = new Set<string>()
  for (const file of derived.byFile.keys()) {
    if (isPutAway(file)) away.add(file)
  }
  return away
}

/** How many of one tag's records are not put away — the trash rule, taken off
 *  the COUNT rather than off the corpus, so the tag itself stays offerable and
 *  only the rows only the trash draws stop being counted. */
const alive = (
  records: ReadonlyArray<LocatedRegular>,
  away: ReadonlySet<string>,
): number => {
  let live = 0
  for (const at of records) if (!away.has(at.file)) live++
  return live
}

/**
 * THE ONE DOOR: the tags of the request's sigil that its query could be the
 * start of, best first.
 *
 * The package's whole surface for this subject, and it is one function rather
 * than two on purpose. {@link vocabularyOf} and {@link offering} are two
 * concerns and stay two functions — they change at different rates, which is
 * what makes the memo worth having — but a CONSUMER wiring them together would
 * be a consumer holding the composition, and the composition is the primitive.
 * There is nothing a caller could usefully do between them: the enumeration is
 * memoised per derivation, so passing it in buys nothing it does not already
 * have, and passing it in wrong (an older revision's list) is a way to be wrong
 * that this shape does not admit.
 */
export const completingTags = (
  derived: Derived,
  request: TagsRequest,
): ReadonlyArray<TagCompletion> => offering(vocabularyOf(derived), request)

/**
 * A PREFIX first and a substring second, folded for case: asking `ho` puts
 * `#home` above `#household-of` and both above `#new-home`. That order is the
 * one property this needs — the tag somebody is typing towards is nearly always
 * one they have started spelling — and it is deliberately not a score.
 *
 * An EMPTY query answers with the whole list (capped), which is what makes a
 * bare `#` a way of seeing what this set even uses.
 *
 * ONE PASS, and the two buckets are filled rather than filtered twice: the
 * "buried" test used to be the negation of the "starts with" test written out
 * again, which is two predicates that have to stay opposite.
 *
 * IT TAKES THE VOCABULARY rather than the derivation, which is what lets the
 * enumeration be memoised once per revision and this run per question — and
 * what makes it a pure function of a list, answerable without a set.
 */
const offering = (
  vocabulary: ReadonlyArray<TagUse>,
  request: TagsRequest,
): ReadonlyArray<TagCompletion> => {
  const wanted = request.query.toLowerCase()
  const starts: Array<TagCompletion> = []
  const buried: Array<TagCompletion> = []
  for (const tag of vocabulary) {
    if (tag.sigil !== request.sigil) continue
    // AN EMPTY QUERY NEEDS NO ARM OF ITS OWN: everything starts with nothing,
    // so the head of the ranked list is what a bare `#` is answered with, by
    // the same test every other prefix takes.
    const into = tag.folded.startsWith(wanted)
      ? starts
      : tag.folded.includes(wanted)
      ? buried
      : null
    // NEITHER BUCKET GROWS PAST THE CAP, which is a fact about the allocation
    // rather than about the answer: a common substring (`o`, `e`) is inside
    // hundreds of names on a large vault, and every row past the eighth was
    // built here and thrown away by the slice. The prefix bucket is what ends
    // the scan; the substring bucket just stops paying.
    if (into === null || into.length >= request.limit) continue
    into.push({ name: tag.name, count: tag.count })
    if (starts.length >= request.limit) break
  }
  return [...starts, ...buried].slice(0, request.limit)
}
