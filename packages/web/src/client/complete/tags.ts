/**
 * The tags the loaded set already uses, and which of them a prefix means.
 *
 * ## An index read, not a walk
 *
 * `Derived.taggedBy` files every record under each tag its title or its note
 * writes, keyed by the written form (`@olai/format`'s `derive.ts`). So the
 * question this file asks — which tags does the set hold, and how many records
 * carry each — is the keys of that map and the length of each entry, and this
 * module is the READING over it: which of them the archive is out of, and what
 * order to offer them in.
 *
 * IT WALKED THE WHOLE CORPUS BEFORE (a `titleParts` per node of the set, per
 * derivation), and the roadmap item that changed it — `mentions-index-one-sigil`
 * — is on the PR with its numbers. The index was already being built for the
 * `@` half; what it cost to file the other sigil too, against what this walk
 * cost, is the trade the branch was asked to measure rather than assume, and
 * `./tags.bench.ts` prints both halves — including the walk AS IT STOOD, which
 * answered a smaller list than either arm of the A/B and is timed beside them
 * so the ratio cannot flatter itself.
 *
 * THE COUNTING STAYS HERE rather than moving beside `backlinksOf`, which is
 * where `@olai/format` keeps its other reading over these indexes, and the
 * reason is the one this file already gives one paragraph down: population is
 * ONE. What a format-side `vocabularyOf` would answer is `{sigil, name, count}`
 * — and this widget wants a fourth field on every row (`folded`, for matching
 * per keystroke), so the browser would map over the answer and allocate a
 * second object per tag per derivation, on the exact path the index was built
 * to make cheap. When a second face asks for this list, that map becomes the
 * caller and pays for itself; today it would buy a layer and cost a pass.
 *
 * ## Why this is not asked of the server, when node search is
 *
 * The `((` widget next door searches through the server's own procedure, and
 * `../search/nodes.ts` argues at length that a browser must not grow a second
 * matcher: what the ⌘K palette finds and what an agent's `search_nodes` finds
 * have to be one reading. That argument is about RANKING — a query language, a
 * score, four weighted fields — and none of it is here.
 *
 * What is here is an ENUMERATION, and the enumeration is already in the value
 * this tab is holding. Asking the wire for it would put a round trip and a
 * debounce inside a completion that has to keep up with typing, to re-derive a
 * fact this tab has in hand — and it would need a procedure MCP has no
 * equivalent of, which is a parity question this feature does not have to open.
 *
 * If a tag facet ever becomes a REPORT — "every tag, most used first, across a
 * corpus this tab does not hold" — that is a reading, it belongs on both faces,
 * and this file becomes its caller. Recorded rather than pre-built.
 *
 * ## The two sigils are two lists
 *
 * `#alice` and `@alice` are different tags (`@olai/format`'s `TAG_SIGILS`), so
 * typing `@` offers what has been written with an `@` and typing `#` offers
 * what has been written with a `#`. Offering one namespace's names under the
 * other's sigil would be the widget inventing tags the set does not hold. The
 * index keeps them apart for the same reason, in its keys.
 */

import {
  type Derived,
  isArchived,
  type LocatedRegular,
  type TagSigil,
  tagPart,
} from "@olai/format"

/** One tag of the set, and how much of it there is. */
export interface Tag {
  readonly sigil: TagSigil
  /** The name, without the sigil. */
  readonly name: string
  /** ...folded for case, once, when the index is read. Matching happens per
   *  keystroke over every tag of the set; folding there would be a throwaway
   *  string per tag per character typed. */
  readonly folded: string
  /** How many LIVE nodes carry it — what orders the list, because the tag
   *  somebody means is usually the tag they have used before. One per record,
   *  however often that record writes it. */
  readonly count: number
}

/** How many rows the widget offers. A row's popup is a shortlist. */
const LIMIT = 8

/**
 * Every tag in the set, most-used first and alphabetical within a count.
 *
 * MIRRORS ARE SKIPPED, which is the same rule every other reading of the set
 * follows: a placement has no title of its own, so a tag counted through one
 * would be the same node's tag counted twice. It is the INDEX that skips them
 * here — `taggedBy` files regular records only, and says so in its type — so
 * this reading no longer has to remember the rule.
 *
 * A TITLE OR A NOTE, because that is what the index files. A tag somebody wrote
 * in a note is part of the vocabulary this set uses and is worth completing
 * towards; before the index it was invisible here, which was an accident of
 * where the old walk looked rather than a decision anybody made.
 *
 * WHAT WAS PUT AWAY IS SKIPPED, and the count is why (ruled 2026-08-17:
 * archived nodes are drawn on the trash page and nowhere else). This number
 * says how much the LIVE set uses a name, and the list is which names are worth
 * reusing: counting the archive would rank a word by rows only the trash draws,
 * and would go on offering a tag whose every user is put away. The tag stays
 * WRITABLE, exactly as any word is — this list is what the set has used, never
 * what a title may say. The index keeps the archive (nothing about storage
 * belongs in a fold over prose), so the skipping is here — over the index's
 * entries rather than over every node of the corpus, and against a set of
 * archived PATHS judged once ({@link archives}) rather than a rule asked per
 * entry.
 *
 * THE OTHER COMPLETION IN THIS APP GOES THE OTHER WAY ON PURPOSE, and the two
 * are cross-referenced so that neither is "harmonized" into the other by
 * somebody meeting one of them alone: the chat composer's `@` offers every file
 * the directory serves, ARCHIVES INCLUDED (`../chat/files.ts`, argued in
 * docs/chat.md). They differ because they complete different things. That one
 * completes a PATH a person is about to name in a sentence — "what did we put
 * away last month" is a fair thing to ask an agent, and a path half-remembered
 * reaches it as a file that is not there. This one ranks the vocabulary of the
 * set a reader is looking at, and what is put away is not in it.
 *
 * ONE READING PER DERIVATION, kept in a `WeakMap` keyed on the derivation
 * itself. The alternative — a memo in the component — re-reads the index every
 * time a `TitleEditor` mounts, and one mounts per row the caret is moved to.
 * Keyed on the VALUE rather than cached by time, so a frame the store publishes
 * is read once and the old answer is collectable with the old derivation.
 * `undefined` (no set yet) is no tags rather than a throw.
 */
const counted = new WeakMap<Derived, ReadonlyArray<Tag>>()

export const tagsOf = (derived: Derived | undefined): ReadonlyArray<Tag> => {
  if (derived === undefined) return []
  const seen = counted.get(derived)
  if (seen !== undefined) return seen
  const tags = counting(derived)
  counted.set(derived, tags)
  return tags
}

const counting = (derived: Derived): ReadonlyArray<Tag> => {
  const away = archives(derived)
  const tags: Array<Tag> = []
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
 * Which of the served files are archives — judged ONCE per derivation, off the
 * file index, rather than per index entry.
 *
 * `isArchived` is a question about a PATH, and `@olai/format`'s own note beside
 * it says it is meant to be asked once per file per probe. This reading has an
 * entry per (record, tag) pair to get through — more entries than the directory
 * has files, by a lot, on a set where a name is written on a thousand rows — so
 * asking it there would put a string comparison where the whole point of the
 * index is that there is no walk left. The saving is measured: 0.63ms → 0.34ms
 * per derivation on the bench vault (`./tags.bench.ts`).
 *
 * WHAT IS LEFT is one map lookup per entry, and the honest word for the shape
 * of this reading is not "a handful": it is one pass over every (record, tag)
 * pair the directory holds. What the index bought is not fewer entries — it is
 * that none of them costs a regex.
 */
const archives = (derived: Derived): ReadonlySet<string> => {
  const away = new Set<string>()
  for (const file of derived.byFile.keys()) if (isArchived(file)) away.add(file)
  return away
}

/** How many of one tag's records are not put away — the archive rule, taken off
 *  the COUNT rather than off the corpus, so the tag itself stays offerable and
 *  only the rows only the trash draws stop being counted. */
const alive = (records: ReadonlyArray<LocatedRegular>, away: ReadonlySet<string>): number => {
  let live = 0
  for (const at of records) if (!away.has(at.file)) live++
  return live
}

/**
 * The tags of one sigil that `query` could be the start of, best first.
 *
 * A PREFIX first and a substring second, folded for case: typing `ho` puts
 * `#home` above `#household-of` and both above `#new-home`. That order is the
 * one property this needs — the tag somebody is typing towards is nearly always
 * one they have started spelling — and it is deliberately not a score.
 *
 * An EMPTY query answers with the whole list (capped), which is what makes a
 * bare `#` a way of seeing what this set even uses.
 *
 * ONE PASS, and the two buckets are filled rather than filtered twice: the
 * "buried" test used to be the negation of the "starts with" test written out
 * again, which is two predicates that have to stay opposite, and this runs per
 * keystroke over every tag the set holds.
 */
export const matchTags = (
  tags: ReadonlyArray<Tag>,
  sigil: TagSigil,
  query: string,
): ReadonlyArray<Tag> => {
  const wanted = query.toLowerCase()
  const starts: Array<Tag> = []
  const buried: Array<Tag> = []
  for (const tag of tags) {
    if (tag.sigil !== sigil) continue
    if (wanted === "" || tag.folded.startsWith(wanted)) starts.push(tag)
    else if (tag.folded.includes(wanted)) buried.push(tag)
    if (starts.length >= LIMIT) break
  }
  return [...starts, ...buried].slice(0, LIMIT)
}
