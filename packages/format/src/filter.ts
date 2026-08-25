/**
 * What a query MEANS — the one matcher, and the two SHAPES its callers want.
 *
 * A query is words and operators; this file says which nodes they select, and
 * which rows survive when a tree is narrowed to them. It is here, at the bottom
 * of the layering, for the same reason `derive`, `rowsOf` and `withoutDone` are:
 * the validator and the view read the format through one implementation, and a
 * second one written to the same paragraph is the thing this package exists to
 * make impossible.
 *
 * TWO SHAPES, and the split is what the file is arranged around:
 *
 *   - a SHORTLIST somebody reads — ranked, capped, every hit situated. {@link
 *     matching} over the whole set, ordered by {@link ranked}, and the caller
 *     is `@olai/ops`' `Query.search`, which is what an agent's `search_nodes`
 *     and the wire's `search.nodes` answer with (the ⌘K palette, the header's
 *     box and the chat composer's `@` list are doors onto that one procedure,
 *     so they get every operator here for free). What is left to the ops layer
 *     is the situating, the cap and the uncapped total;
 *   - a MEMBERSHIP over rows already on a screen — uncapped, unranked, ids to
 *     test rows against. That is a page's FILTER, and what it is asked of is
 *     the records THAT PAGE draws rather than the corpus (`./narrowing.ts`,
 *     over {@link selecting} with the page's own candidates in place of the
 *     set's). A capped, ranked, situated answer would be the wrong answer with
 *     more bytes in it.
 *
 * BOTH ARE ANSWERED ON THE SERVER, which is newer than this file is. The
 * matcher came DOWN here when the filter ran in a browser on every keystroke
 * over rows the tab already held — a client-side predicate written to the same
 * description is exactly the drift docs/search.md was written to forbid, with
 * `is:done` meaning one thing to an agent and another to the box a person types
 * in. The browser holds no vault to grep since `vault-in-browser`, and the
 * filter stopped being a call at all with `filter-ask-carries-revision`
 * (docs/brainstorming/filter-rides-the-page.md): what moved was WHO CALLS this,
 * never what it says, and the rule the move was made for is the reason it stays.
 * The ranking followed it down for the same reason, one door later: see
 * {@link ranked}.
 *
 * The design, with the alternatives that lost, is
 * docs/brainstorming/filter-in-place.md.
 */

import { Schema } from "effect"

import {
  ancestorsOf,
  byCorpus,
  type Derived,
  isBlocked,
  isMirrored,
  mayHoldTag,
  type Row,
  tagText,
  titleParts,
} from "./derive.ts"
import type { Markdown, Unkept } from "./document.ts"
import { type Custom, customOf } from "./custom.ts"
import { proseIn } from "./frontmatter.ts"
import { shiftDay, shiftMinutes, shiftMonth, weekdayOf } from "./calendar.ts"
import type { DayGroup } from "./dates.ts"
import { datesOf, dayOf, monthOf } from "./occasion.ts"
import { basenameOf } from "./paths.ts"
import { nothing } from "./write.ts"
import {
  mintedInto,
  PROPERTIES,
  isLeftoverArchive,
  isTrashed,
  isMirror,
  type Located,
  type LocatedRegular,
  type RegularNode,
  settles,
  storedMarker,
} from "./node.ts"
import {
  isDigitRun,
  type PropDeclarations,
  type PropType,
} from "./typing.ts"

// ── the four fields a word is looked for in ────────────────────────────

/** Where a word may be found, in the order a tie is broken. The one thing in
 *  this file the wire spells for itself (`@olai/surface`'s `SearchHit.matched`),
 *  which is why it is public where the table below is not. */
export const SEARCH_FIELDS = ["title", "id", "tag", "desc"] as const
export type SearchField = (typeof SEARCH_FIELDS)[number]

/** What a field is worth when a word is found in it. The order is racket's:
 *  the closer a hit is to what a node CALLS itself, the higher it goes.
 *
 *  Here rather than beside the penalty a finished node takes because {@link
 *  matchOf} has to answer WHICH field carried a match, and "which" and "how
 *  much" are one table. The penalty a finished node takes is {@link ranked}'s,
 *  one section down; the cap and the total are the caller's, since a row count
 *  is a fact about a door and a total is a fact about the answer. */
const FIELD_WEIGHT = { title: 1000, id: 750, tag: 500, desc: 250 } as const

/**
 * The folded text of a RECORD, kept for as long as the record is.
 *
 * Every door that matches a word folds four fields per node per question, and
 * two of them ask a question per keystroke: the browser's filter over a page,
 * and the chat composer's `@` list. A vault of twenty thousand nodes is
 * eighty thousand throwaway lowercase strings per character typed, of which the
 * overwhelming majority are the same strings as the keystroke before.
 *
 * A `WeakMap` on the RECORD rather than on the set, which is what makes it
 * correct without an invalidation rule: a record is a value here — a file that
 * changes is re-parsed into new records and the set is PATCHED with them
 * (`@olai/web`'s `outlines.ts`, over `./patch.ts`) — so a fold that is still
 * reachable is a fold of text that has not changed, and one nothing holds any
 * more is collectable with the record it was about. There is no frame, no
 * revision and no clearing.
 *
 * The two other completions keep a fold of their own for the same reason
 * (`web/src/client/file/matching.ts` over the served paths, `./vocabulary.ts`
 * over the set's tags). This one is HERE rather than beside them because the text it
 * folds is this file's own question, and a cache in a caller would be a second
 * answer for the four other doors to miss.
 *
 * WHAT IT BUYS is a leg rather than a sentence — `just bench`, over
 * `./filter.bench.ts`, one word typed a character at a time over 20,000 nodes:
 *
 *     cold   426.7ms over 7 keystrokes — 60.95ms each
 *     warm    67.3ms over 7 keystrokes —  9.61ms each
 *
 * The bench is in the tree because a reviewer asked where an earlier pair of
 * numbers in this paragraph came from and the honest answer was a scratch file
 * (#228). Run it on your own machine before quoting it: the ratio is the claim,
 * the milliseconds are one laptop's.
 *
 * WHAT IT COSTS, said rather than left to be discovered: the first word typed
 * anywhere in the app materialises a fold for every node the query reaches, and
 * it lives as long as the records do — four folded fields per node, held until
 * the record is replaced or the set is dropped. That is the shape, and it is
 * deliberately not a figure: the bench's own note says why the heap delta it
 * tried to report could not be stood behind.
 */
const folded = new WeakMap<RegularNode, Record<SearchField, ReadonlyArray<string>>>()

const haystacksOf = (
  node: RegularNode,
): Record<SearchField, ReadonlyArray<string>> => {
  const before = folded.get(node)
  if (before !== undefined) return before
  const now = foldOf(node)
  folded.set(node, now)
  return now
}

/** The fold itself — what a word is looked for in.
 *
 *  A tag is indexed TWICE, bare and as written, so `alice` finds `@alice` with
 *  the full start-of-field bonus and `@alice` finds only the one with that
 *  sigil. A single written form would have demoted every bare-word tag search
 *  by a character. One fold, and the bare name is a slice of it. */
const foldOf = (
  node: RegularNode,
): Record<SearchField, ReadonlyArray<string>> => ({
  title: [node.title.toLowerCase()],
  id: [node.id.toLowerCase()],
  // Guarded by the format's own cheap negative: `titleParts` runs a global
  // regex and allocates a part per segment, and most titles hold no tag at
  // all. The semantics are identical — it only ever yields a tag after a sigil.
  tag: mayHoldTag(node.title)
    ? titleParts(node.title).flatMap((part) => {
      if (part.kind !== "tag") return []
      const written = tagText(part).toLowerCase()
      return [written.slice(1), written]
    })
    : [],
  desc: node.desc === undefined ? [] : [node.desc.toLowerCase()],
})

/**
 * THE SAME FOLD, RUN TOGETHER — the one string an index outside this file has
 * to hold if the candidates it hands back are to be a SUPERSET of what {@link
 * matching} selects.
 *
 * A word is looked for in four fields ({@link SEARCH_FIELDS}); an index is
 * looked in once. So what it holds is the four with a newline between them, and
 * the seam that makes is the only interesting thing here: it can OVER-INCLUDE
 * and it cannot UNDER-INCLUDE. A needle straddling the join is a candidate this
 * record then FAILS when {@link matchOf} is run over it, which costs one
 * comparison; a needle inside one field is a candidate that same call confirms.
 * There is no third case, and that asymmetry is the whole safety argument for
 * narrowing a search with an index at all — a candidate the matcher rejects is
 * free, and one it never sees is a hit nobody finds.
 *
 * OFF THE FOLD THE MATCHER ALREADY KEEPS, never a second lowercasing of the
 * same text: {@link haystacksOf} is the cache, so a record folded for a
 * keystroke is indexed out of that fold and a record indexed first is folded
 * once for both. Two spellings of "the text of this record" is exactly how an
 * index comes to answer a question the matcher is not asking, and it is the
 * whole reason this lives here rather than in the package that keeps the index
 * (`@olai/index`).
 */
export const hayOf = (node: RegularNode): string => {
  const hay = haystacksOf(node)
  return SEARCH_FIELDS.map((field) => hay[field].join("\n")).join("\n")
}

/** What counts as the start of a word inside a field. A `const`, because this
 *  is the innermost loop of a scan over every node of the set and a regex
 *  literal is a fresh object every time it is evaluated. */
const WORD_EDGE = /[\s/_-]/

/** Where in the field the word landed. A field that STARTS with it beats one
 *  where it starts a word inside it, which beats one where it is buried.
 *  `-1` is "not in this field at all". */
const positionBonus = (haystack: string, needle: string): number => {
  const at = haystack.indexOf(needle)
  if (at === -1) return -1
  if (at === 0) return 100
  return WORD_EDGE.test(haystack[at - 1] as string) ? 50 : 0
}

// ── the grammar ────────────────────────────────────────────────────────

/** The marks `is:` selects on, plus the four questions that are not a mark:
 *  `marked` (any of the four — what makes `is:marked -is:done` sayable),
 *  `blocked` and `mirrored` (the two DERIVED values here — what is standing
 *  in a node's way, and where else the node is drawn) and `archived` (below).
 *  Which of them is answered by what is {@link being}, and that is a switch, so
 *  a value added to this list is a compile error there rather than a query that
 *  finds nothing.
 *
 *  `cancelled` is here in MARKS order and not at the end, so the four marks
 *  read as a group in every refusal this list writes ({@link teaching} joins
 *  it verbatim). `is:marked` takes it, which is the whole reason that value
 *  was not spelled as a list of three: `is:marked -is:done -is:cancelled` is
 *  "work, unsettled", and it stayed sayable the day the fourth mark landed. */
const IS_VALUES = [
  "done",
  "cancelled",
  "doing",
  "todo",
  "marked",
  "blocked",
  "mirrored",
  "trashed",
] as const
type IsValue = (typeof IS_VALUES)[number]

/** Is this word one of them? {@link isHasField}'s twin, and here for its
 *  reason: the cast it replaces was the last one left in {@link clauseOf}. */
const isIsValue = (value: string): value is IsValue =>
  (IS_VALUES as ReadonlyArray<string>).includes(value)

/**
 * THE THREE READINGS OF A RECORD AS DAYS, which are also the three operators
 * that take a span of them — one value grammar, told apart by nothing but
 * which days each asks for.
 *
 * READINGS rather than fields, and the distinction is why the list is not
 * called after the record's keys: two of these three ARE a field, and `date`
 * is not — it is ./dates.ts's `datesOf`, the journal's pair, which reads a
 * `date` and a dated `done` and would be misdescribed by either field's name.
 * What the three have in common is not where they are stored but that each
 * turns one record into the days it offers.
 *
 * `date:` reads the JOURNAL's two — what the node is scheduled FOR, and when
 * the work was finished (./dates.ts) — and the other two read the record's own
 * STAMPS, the instants the ops layer puts on a node when it is captured and
 * re-puts whenever it is written afterwards (./node.ts). Three sources, and
 * ONE grammar over them: a day, a month, a year, the twelve relative words, a
 * duration back from now, and a range of any of those mean under `created:`
 * exactly what they mean under `date:`, because {@link meaningOf} reads the value
 * before anything knows which operator asked. What DIFFERS between the three
 * is only the precision the record answers at, and that is the record's rather
 * than the grammar's: the stamps carry seconds, so a duration reaches them
 * exactly; a `date:` field carrying a bare day is compared at the width of a
 * day, so `date:1h` is effectively a question about done-instants
 * ({@link within} argues it, docs/search.md states it).
 *
 * WHICH IS THE ARGUMENT FOR THE LIST rather than for three operators written
 * out. A reader who has learnt `date:last-week` has learnt the other two, and
 * the day a fourth spelling of a span is added to that grammar it is added once
 * and reaches all three. This list is what the four tables that have to agree
 * about them are built from — {@link OPERATORS}, {@link HAS_FIELDS},
 * {@link clauseOf} and {@link teaching} — so a name added here is a compile
 * error in the two that switch until it says what it reads.
 *
 * WHAT EACH ONE READS is {@link dayWithin}, which is the one place a record
 * is read as days at all.
 *
 * FIVE READERS AND NOT FOUR, which is the correction this list needed rather
 * than the `satisfies` it briefly carried. {@link OPERATORS} and
 * {@link HAS_FIELDS} spread it; {@link clauseOf} and {@link teaching} switch on
 * it, so a name added here is a compile error in each until it says what it
 * takes. The fifth reader is {@link dayWithin}, which is the one that DOES the
 * reading and was the one with no such guarantee — its own doc says what that
 * cost and how it is closed.
 */
const DAY_READINGS = ["date", "created", "changed"] as const
type DayReading = (typeof DAY_READINGS)[number]

/** Is this `has:` row one of them — the rows that are an unbounded day
 *  question rather than a field test? A type guard for {@link isOperator}'s
 *  reason: {@link hasClause} splits the vocabulary on it ONCE, at the parse,
 *  and what comes out the other side is two clause kinds the matcher can no
 *  longer confuse. */
const isDayReading = (field: HasField): field is DayReading =>
  (DAY_READINGS as ReadonlyArray<string>).includes(field)

/** The optional fields of a record `has:` asks about. One row per field a
 *  reader might select on; `has:children` is deliberately absent, being a
 *  question about the SET rather than about the record.
 *
 *  THE THREE {@link DAY_READINGS} are the rows that are not a plain field
 *  test: each is its own operator asked with NO BOUNDS, which is what keeps
 *  the pair from disagreeing — a reader who finds a node with
 *  `created:2026-08-19` and then cannot find it with `has:created` has met two
 *  answers to one word. This list is the VOCABULARY `has:` takes, which is a
 *  different thing from the clause it produces: {@link hasClause} turns those
 *  three into an unbounded span and the rest into a field test, so nothing
 *  downstream has both to tell apart.
 *
 *  `repeat` could have looked like a fourth exception and is not. A rule needs
 *  a `date` to repeat FROM (./parse.ts refuses one without), so this row and
 *  that one answer about overlapping nodes from opposite ends — the rule is a
 *  field of the RECORD, the days are the JOURNAL's — and the field test is the
 *  honest reading of the rule. What the overlap means to somebody writing a
 *  query is docs/search.md's to say. */
const HAS_FIELDS = ["desc", ...DAY_READINGS, "see", "after", "doc", "repeat"] as const
type HasField = (typeof HAS_FIELDS)[number]

/** Is this word one of them? The guard {@link hasClause} reads, and the reason
 *  the cast that used to stand there is gone. */
const isHasField = (value: string): value is HasField =>
  (HAS_FIELDS as ReadonlyArray<string>).includes(value)

/**
 * The rows of {@link HAS_FIELDS} that ARE a plain field test — every one but
 * the three {@link DAY_READINGS}, which {@link hasClause} has already turned
 * into an unbounded span by the time a clause exists.
 *
 * A TYPE rather than a sentence, and it claims only what it delivers: nobody
 * can call `carries(node, "date")`, which would answer about the `date` FIELD
 * where the grammar answers about the journal's two dates. Since the split
 * happens at the parse it is no longer a rule {@link holds} has to keep — the
 * clause it receives cannot name one of the three, because none is ever built.
 */
type CarriedField = Exclude<HasField, DayReading>

/** The operator names. A colon after anything else is a colon in a word — see
 *  {@link parseFilter}. A QUOTED token is never one of these, whatever it
 *  spells: `"is:done"` is the text, which is the escape hatch out of this table
 *  and the reason quoting and the operators shipped together.
 *
 *  The three day operators are SPREAD IN from {@link DAY_READINGS} rather than
 *  listed again, which is what makes that list the one place a fourth of them
 *  would be added: it is read here, by {@link HAS_FIELDS}, by {@link clauseOf}
 *  and by {@link teaching}, and a name in none of them is not an operator. */
const OPERATORS = ["is", "has", ...DAY_READINGS, "prop"] as const
type Operator = (typeof OPERATORS)[number]

/** Is this word before a colon one of them? A type guard, so what follows is a
 *  switch the compiler can check rather than a chain of string comparisons. */
const isOperator = (name: string): name is Operator =>
  (OPERATORS as ReadonlyArray<string>).includes(name)

/** The one clause with a name of its own, because three functions take it and
 *  `Extract<Clause, { kind: "days" }>` spelled three times is one shape
 *  written three times. */
interface DaysClause {
  readonly kind: "days"
  readonly of: DayReading
  readonly from: string | null
  readonly to: string | null
}

type Clause =
  | { readonly kind: "is"; readonly value: IsValue }
  /** A field the record carries, and never one of the {@link DAY_READINGS}:
   *  `has:created` is a `days` clause with no bounds by the time it is one of
   *  these ({@link hasClause}). */
  | { readonly kind: "has"; readonly field: CarriedField }
  /**
   * An inclusive span, as ISO text, and WHICH of a node's dates it is asked of
   * ({@link DAY_READINGS}). `null` on either side is "unbounded that way",
   * which is what `date:..2026-08-10` and `created:2026-08-10..` are.
   *
   * A BOUND IS A DAY OR A MOMENT, and its own WIDTH is what says which — ten
   * characters for a day, a whole clock face and an offset for the moment a
   * duration names ({@link durationBefore}). There is no tag beside it, and
   * that is the point rather than an omission: ISO text is a prefix ordering,
   * so the string already carries its precision, and a tag would be a second
   * answer to "what kind of bound is this" free to disagree with the string it
   * sits next to. {@link within} reads each bound at its own width, which is
   * why the two ends may differ (`created:yesterday..3h`).
   *
   * ONE ARM FOR THE THREE, and the `of` is the whole difference between them:
   * the value was read by one {@link meaningOf} before anything knew which
   * operator asked, so what is left to carry is where to look. Three arms would
   * have been three copies of two nullable bounds, and the reading below
   * ({@link within}) would have had to be written once per copy.
   */
  | DaysClause
  /**
   * A CUSTOM property, by key — and by value when the token carried one.
   *
   * `value: null` is `prop:pr`, "carries this key at all", which is
   * {@link HAS_FIELDS}' question asked of a map that has no fixed list of keys
   * to put in that table. `prop:agent=claude-opus` is the same question with an
   * answer attached, and it is the one the design was written for: every lane
   * this agent ran, in one query, out of facts nobody had to re-parse by eye.
   */
  | {
    readonly kind: "prop"
    readonly key: string
    readonly value: string | null
    /**
     * ...and a SPAN is the third thing a `prop:` can ask, on a key whose
     * declaration says its values COMPARE ({@link ../typing.ts}).
     *
     * `prop:records=190..200`, `prop:dispatched=2026-08-20..` — the syntax `created:`
     * already has, reused rather than invented, because a range of days is a
     * range of days whichever field it is read of. It is meaningful ONLY on a
     * declared `date` or `int` key: comparing strings as if they were dates is
     * the lie types exist to prevent, so the same token on an untyped key is
     * REFUSED with the reason rather than answered as an equality nothing
     * matches ({@link propClause}).
     *
     * `value` is `null` beside it, and the two are never both present: a clause
     * asks one question of a key. It is an optional field rather than a third
     * arm of this union because everything else about a `prop:` clause — how
     * the key is folded and scanned, whether the hit reports it, that a
     * document answers it too — is the same question and would have been two
     * copies of it.
     */
    readonly span?: PropSpan
  }

/**
 * A span asked of a PROPERTY, and what kind of comparison it is.
 *
 * TWO ARMS, because the two kinds compare differently and the difference is not
 * cosmetic. A `date` is TEXT — ISO is a prefix ordering, and this package
 * compares stored date text everywhere rather than parsing an instant
 * ({@link daysClause} says why) — so its bounds are strings, exactly the ones
 * `created:` mints. An `int` is a NUMBER, which is the whole of what declaring
 * a key `int` bought: `9..10` must not answer `100`, and a string comparison
 * says it does.
 */
export type PropSpan =
  | { readonly of: "date"; readonly from: string | null; readonly to: string | null }
  | { readonly of: "int"; readonly from: number | null; readonly to: number | null }

/**
 * One thing a query can be satisfied BY — a word to find or a clause to hold —
 * each with the same question about whether the query wants it ABSENT.
 *
 * A UNION where there used to be two lists, and the reason is `OR`: a group can
 * hold both kinds (`is:todo OR overdue`), so "which alternatives are there" and
 * "what kind is each" stopped being answerable by which array a thing was in.
 * What the two lists were FOR — testing the cheap clauses before anything scans
 * a note — is {@link inCostOrder}, over whole groups, where it is a fact about
 * the query rather than about the shape of the value.
 *
 * A PHRASE is a term whose word holds spaces, and nothing here says so. That is
 * the whole of what quoting cost: the tokenizer stopped ending a token at a
 * space, and the matcher — which was already looking for a substring — went on
 * doing exactly what it did.
 */
type Alternative =
  | { readonly kind: "term"; readonly word: string; readonly negated: boolean }
  | { readonly kind: "clause"; readonly clause: Clause; readonly negated: boolean }

/**
 * Tokens joined by `OR`: ONE of them has to hold.
 *
 * A token nobody joined is a group of one, which is what every token in every
 * query was before this — so the AND across groups is the conjunction that was
 * always here, unchanged, and `OR` is a second binding level UNDER it rather
 * than a split over it. {@link parseFilter} argues why that way round.
 */
type Group = ReadonlyArray<Alternative>

/**
 * A token the grammar knows the name of and not the value — `is:open` (a mark
 * this format stopped having), `date:soon`, `date:2026-13`.
 *
 * Reported rather than quietly downgraded to a substring term, because a query
 * that silently finds nothing is precisely the ignored error HACKING.md
 * forbids: the reader typed an operator, and the honest answer is which values
 * it takes.
 *
 * A SCHEMA and not an interface, because it does not stay here: the filter over
 * the tree parses for itself and draws these, and the other three doors ask the
 * server — so a refusal rides `SearchAnswer.refusals` to a browser and to an
 * agent. One declaration, for the reason `./searching.ts` gives about the hit
 * it travels beside.
 */
export const Refusal = Schema.Struct({
  /** AS TYPED, case and all. A refusal that quoted the folded token would be
   *  telling somebody who wrote `is:OPEN` that they wrote something else —
   *  the refusal misquoting the reader, which is the defect it exists to
   *  prevent (see {@link parseFilter}). */
  token: Schema.String,
  reason: Schema.String,
})
export type Refusal = typeof Refusal.Type

/**
 * A query, in one of the three states it can be in — and a UNION rather than a
 * product of terms, clauses and refusals, because the third makes the other two
 * ungroundable.
 *
 * The product version read honestly field by field and lied in the joint: a
 * refused query still carried whatever half of it parsed, and "check
 * `refusals` before you read `terms`" was an arm-order convention every reader
 * had to know. Here there is nothing to know — a `refused` filter HAS no terms
 * to be tempted by, and `speaksOfTrash` exists only on the arm where an
 * archive rule means anything.
 *
 * The three are three different things to DO, which is why none of them
 * collapses into another: `nothing` is an empty box and draws the page whole;
 * `refused` is a query the reader typed and the grammar could not read, so it
 * selects nothing and the refusals are shown; `asking` is a query.
 */
export type Filter =
  /** Nothing was typed. Not the same thing as "typed, and matches nothing". */
  | { readonly kind: "nothing" }
  | { readonly kind: "refused"; readonly refusals: ReadonlyArray<Refusal> }
  | {
    readonly kind: "asking"
    /** Every group must hold, and a group holds when any of its alternatives
     *  does. In {@link inCostOrder} rather than in the reader's, which is a
     *  reordering of a conjunction and so cannot change an answer. */
    readonly groups: ReadonlyArray<Group>
    /**
     * The POSITIVE `prop:` clauses, in the order the query NAMED them — which
     * is the order a hit's `matchedProps` comes back in, and the order a search
     * row leads with (`@olai/web`'s `search/props.ts`: "the keys a `prop:`
     * clause selected this node on lead, in the order the query named them").
     *
     * A SECOND LIST beside the groups rather than a walk of them, for two
     * reasons that are the same reason. The groups are in {@link inCostOrder},
     * which is an EVALUATION order and not the reader's — so a `prop:` sharing
     * a group with a word is tested last and would have been reported last,
     * quietly breaking that contract for exactly the queries this pass added.
     * And it is read once per node a query SELECTS, where walking every group
     * of every query — nearly none of which name a property — was a scan per
     * hit for an answer that is a fact about the QUERY.
     *
     * Derived at parse time from the tokens it is built beside, exactly as
     * `speaksOfTrash` below is, and negated clauses are left out here for the
     * reason {@link Match.props} gives: a node found by `-prop:agent` was not
     * found ON `agent`.
     */
    readonly namedProps: ReadonlyArray<Extract<Clause, { kind: "prop" }>>
    /** True when the query names the archive at all, in either polarity. The
     *  archive is out of every reading unless it is ASKED for
     *  (docs/search.md), and this is the flag that says it was — so
     *  `is:trashed` reaches what was put away and `-is:trashed` says out
     *  loud what is otherwise the default. */
    readonly speaksOfTrash: boolean
  }

// ── the tokenizer ──────────────────────────────────────────────────────

/**
 * The one character that suspends a space, and so the one that can make a
 * token out of two words. ONE kind of quote: an apostrophe is a character
 * people write (`don't`), exactly as a colon is, and a grammar that read one as
 * punctuation could not search prose.
 */
const QUOTE = `"`

/** What ends a token — the split this file used to do with one regex, done a
 *  character at a time because a quote can now say "not this one". */
const SPACE = /\s/

/**
 * One token, as the reader typed it and as the grammar reads it.
 *
 * THREE FACTS BECAUSE THE FOLD AND THE QUOTES ARE BOTH LOSSY, and each is read
 * by something different: {@link Refusal} quotes `written`, the matcher and the
 * operator tables read `text`, and `quoted` is what says a token is TEXT
 * whatever it spells. Deriving any of them from another is what the old
 * `written` / `raw` pair could still do and this cannot — `"-force"` and
 * `-force` fold to the same string and mean opposite things, which is why the
 * dash is read here, where its position is still known.
 */
interface Token {
  /** AS TYPED — dash, quotes, capitals and all. What a refusal shows. */
  readonly written: string
  /** What the grammar reads: the quotes taken out, the case folded, the
   *  negation taken off the front. */
  readonly text: string
  /** Did the token OPEN with a quote (after at most one `-`)? Then it is a term
   *  whatever it holds, and never the {@link JOINER}. */
  readonly quoted: boolean
  readonly negated: boolean
}

/**
 * Text into tokens — and this is the whole of what quoting changed.
 *
 * A quote SUSPENDS the space that would have ended the token, so `"kitchen
 * remodel"` is one thing to look for; a quote at the FRONT of a token (after at
 * most one `-`) also says the token is text rather than an operator. Those are
 * two rules and they buy two different things — the first is `prop:agent="two
 * words"`, which needs no rule of its own; the second is `"is:done"`, the only
 * way to search for the text somebody wrote in a note when the grammar has
 * claimed that spelling. The FRONT is about that second rule only: a quote
 * anywhere in a token opens a region, wherever it sits.
 *
 * A QUOTE NOTHING CLOSES stops the scan and is reported, rather than being
 * closed at the end of the input on the reader's behalf: `"pick the` and `"pick
 * the"` are two different queries, and guessing which was meant is exactly the
 * quiet answer to an unasked question this grammar refuses everywhere else. The
 * tokens READ SO FAR come back with it, so a query that got two things wrong is
 * told about both.
 *
 * WHICH COSTS ONE TERM, and it is named rather than excepted: a lone `"` is a
 * quote nothing closes wherever it sits, so `36"` is refused instead of being
 * searched for as an inch mark. The alternative is a second rule about the same
 * character — a quote opens a region UNLESS nothing closes it, in which case it
 * was a character all along — which is a rule nobody can hold and which decides
 * what a token means by reading the end of the line. One rule and a refusal
 * that teaches it; the word is reachable without the mark (`36`).
 *
 * THE DASH IS READ HERE for the reason the header above gives: after the quotes
 * come out, a dash that negated the token and a dash somebody quoted are the
 * same character in the same place. `-"kitchen remodel"` is a phrase taken back
 * out; `"-force"` is a word people write.
 */
const tokensOf = (text: string): {
  readonly tokens: ReadonlyArray<Token>
  /** The token that opened a quote nothing closed, as typed — `null` when every
   *  quote was closed. */
  readonly unclosed: string | null
} => {
  const tokens: Array<Token> = []
  let at = 0
  while (at < text.length) {
    if (SPACE.test(text[at] as string)) {
      at += 1
      continue
    }
    const start = at
    // ONE leading `-`, and only in front of something: a bare `-` is a
    // character somebody typed, not a negation of nothing.
    const negated = text[at] === "-" && at + 1 < text.length &&
      !SPACE.test(text[at + 1] as string)
    if (negated) at += 1
    // Where a quote would be the token's FIRST character, which is what makes
    // it a phrase rather than a suspended space.
    const opens = at
    let read = ""
    let quoted = false
    let dangling = false
    while (at < text.length && !SPACE.test(text[at] as string)) {
      if (text[at] !== QUOTE) {
        read += text[at]
        at += 1
        continue
      }
      if (at === opens) quoted = true
      const closes = text.indexOf(QUOTE, at + 1)
      if (closes === -1) {
        at = text.length
        dangling = true
        break
      }
      read += text.slice(at + 1, closes)
      at = closes + 1
    }
    const written = text.slice(start, at)
    if (dangling) return { tokens, unclosed: written }
    tokens.push({ written, text: read.toLowerCase(), quoted, negated })
  }
  return { tokens, unclosed: null }
}

// ── the grammar, as tokens ─────────────────────────────────────────────

/**
 * What joins two tokens into one group, and THE ONE TOKEN IN THIS GRAMMAR THAT
 * IS NOT FOLDED.
 *
 * In capitals because `or` is a word people write — a note that says `walnut or
 * birch` is an ordinary note — and a grammar that read the lower-case one as a
 * joiner would have taken a common English word out of the language it is
 * searching. So the exception is the thing that keeps the rule: everything else
 * folds, and `or` goes on being a word because `OR` is the joiner. A note that
 * shouts it back has the other escape hatch: `"OR"` is the text.
 *
 * Compared against {@link Token.written} rather than against `text`, which is
 * what makes the two lines above one comparison: the folded form would answer
 * for `or`, and a quoted one carries its own quotes in `written` and so can
 * never equal this.
 */
const JOINER = "OR"

/** What a dangling `OR` is told. It NAMES THE RULE rather than the token, for
 *  the reason every refusal in this file does: the reader typed a joiner, and
 *  the honest answer is what a joiner joins. */
const JOINING =
  `${JOINER} joins the token before it to the token after it — one of them is missing`

/** ...and what an unclosed quote is told. Same sentence shape, same reason: a
 *  phrase is delimited, and the delimiter that is missing is the news. */
const UNCLOSED = `a quote nothing closes — a phrase runs from one ${QUOTE} to the next`

/** ...and what a phrase with no words in it is. Refused rather than matched,
 *  and it is `prop:stage=`'s rule exactly: an empty needle is in every node
 *  ever written, so a query nobody meant would answer with the whole directory
 *  — the loud twin of the silent empty answer. A phrase of nothing BUT
 *  WHITESPACE is the same query with the same answer, which is why the test
 *  below trims: `" "` finds every node whose title has a space in it, which is
 *  all of them and none of what was meant. */
const NOTHING_QUOTED =
  `a phrase with no words in it — what to look for goes between the ${QUOTE}s`

/**
 * Text into a query.
 *
 * Tokens ({@link tokensOf}); a leading `-` negates whichever kind the token
 * turns out to be; a token whose left-of-colon is one of {@link OPERATORS} is a
 * clause and everything else is a substring term. That last rule is the one
 * worth stating: `TODO:`, `note:x` and `http://example.com` are words people
 * write, and a grammar that refused every colon would be a grammar that could
 * not search prose.
 *
 * TWO BINDING LEVELS AND NO PARENTHESES, which is the ruling this pass exists
 * to make. `OR` joins the tokens on either side of it into one {@link Group};
 * the groups are ANDed exactly as adjacent tokens always were. So `OR` binds
 * TIGHTER than the conjunction, and `#home kitchen OR bathroom` is `#home` and
 * one of the other two — which is what somebody typing it means. The other way
 * round it reads `(#home AND kitchen) OR bathroom`, and the second half of that
 * answer is every bathroom in the directory, arriving with no `#home` about it:
 * a query that quietly WIDENED is the trap this grammar's deferral named, and
 * it is worse than a narrow one because the extra rows look like a search
 * working. The reader who wants the loose reading has the tighter one plus a
 * second query; the reader who wants the tight one, under the loose rule, has
 * nothing at all to type.
 *
 * A GROUP IS NOT NEGATED, and there is nothing missing, because the dash is a
 * TOKEN's and there are now two binding levels — which is exactly enough for
 * both of De Morgan's readings. `-a -b` is `NOT (a OR b)`, "neither": two
 * groups, both of which must hold. `-a OR -b` is `NOT (a AND b)`, "not both":
 * one group, either half of which will do. So this grammar is closed under both
 * laws without a parenthesis in it, and a group-level `-` would only be a
 * second spelling of one of the two.
 *
 * PURE, AND THE CLOCK IS AN ARGUMENT. `now` is what the relative words count
 * from (`date:yesterday`, `date:last-week`) — the day the reader is standing
 * on, or an instant on it ({@link relativeSpan} cuts one down to the other).
 * A DURATION COUNTS FROM THE SAME ARGUMENT and reads the whole of it
 * ({@link durationBefore}): `created:1h` is an hour before the moment `now`
 * names, so a clock handing over an instant is answered to the second and one
 * handing over a bare day is answered from midnight on it, which is what those
 * ten characters say. Every door that MATCHES hands over the instant a `done`
 * is stamped with (`@olai/ops`); the one door that parses without matching —
 * the tab's own read of its filter box, for the words to light and the
 * refusals to draw — hands over its day, and the bounds it mints are not what
 * anything is selected by (`@olai/web`'s `pane/PageView.tsx` says so at the
 * call).
 * It is a parameter rather than something read in here for two reasons that
 * are really one: a function that read a clock could not be tested against a
 * boundary, and the day is a fact about WHO IS ASKING — the tab's own local
 * day for the filter the browser parses itself, the server's for the three
 * doors that ask it, and no door has two. Those two CAN differ — a tab across
 * a time-zone boundary from the server has its own local day — and docs/
 * search.md says why that is accepted rather than fixed by putting a clock on
 * the wire. The deferral this lifts (docs/brainstorming/filter-in-place.md)
 * named the price as "threading `today` through the parse", and that is
 * exactly what it cost.
 *
 * CASE IS FOLDED FOR MATCHING AND NOT FOR QUOTING. The words and the operator
 * values are compared folded, so `is:DONE` and `#Home` work; a REFUSAL quotes
 * the token exactly as it was typed. Telling somebody who typed `is:OPEN`
 * that they typed `is:open` is the refusal misquoting the reader, which is
 * the same defect class the refusal exists to prevent — the split is why the
 * fold happens per token here rather than to the whole string on the way in.
 * {@link JOINER} is the one token this does not reach, and its own note says
 * why the exception is what keeps the rule.
 */
export const parseFilter = (
  text: string,
  now: string,
  /**
   * WHAT THE VAULT DECLARES about its property keys, for the doors that have
   * read it — and ABSENT, not empty, for the one that has not.
   *
   * It is what makes `prop:records=190..200` a span rather than an equality against
   * eight characters ({@link propClause}), so every door that MATCHES hands it
   * over: `search_nodes` and the two search boxes through `@olai/ops`' query,
   * and the box that narrows a page through `./narrowing.ts`. The door that
   * does not is the tab's own read of its filter box, which parses for the
   * words to light and the refusals to draw and selects nothing — it holds no
   * vault to read a declaration out of, and the server it asks holds the
   * answer. The consequence is named honestly rather than hidden: that box
   * cannot DRAW the refusal for a range on an untyped key, so such a query
   * comes back with no rows, which is the answer it already gave before this
   * parameter existed. docs/search.md says so.
   *
   * `undefined` and `NO_TYPING` are deliberately different: an empty map is a
   * vault that was read and declares nothing, and a range there IS refused,
   * naming the key nobody typed.
   */
  declarations?: PropDeclarations,
): Filter => {
  const groups: Array<Array<Alternative>> = []
  const namedProps: Array<Extract<Clause, { kind: "prop" }>> = []
  const refusals: Array<Refusal> = []
  let speaksOfTrash = false
  // The last token was a joiner, so the next one lands in the group before it
  // rather than opening one of its own.
  let joining = false
  // Some token has been read — which is what a joiner needs on its left, and
  // it is a TOKEN rather than a group: a token the grammar refused is still one
  // the reader typed, and reporting a dangling `OR` beside it would be this
  // grammar inventing a second mistake out of the first one.
  let read = false

  const { tokens, unclosed } = tokensOf(text)
  for (const token of tokens) {
    // The joiner, and it is the only token read as typed — see {@link JOINER}.
    // A quoted one carries its quotes here and so is a word.
    if (token.written === JOINER) {
      // Nothing before it, or another joiner before it: either way one of the
      // two things it joins is missing.
      if (joining || !read) {
        refusals.push({ token: token.written, reason: JOINING })
        continue
      }
      joining = true
      continue
    }
    read = true
    const alternative = alternativeOf(token, now, declarations)
    const joined = joining
    joining = false
    if ("reason" in alternative) {
      refusals.push({ token: token.written, reason: alternative.reason })
      continue
    }
    // The two facts about the WHOLE query that are read off its clauses, both
    // collected here in the order they were typed rather than walked back out
    // of the groups afterwards — where the order is no longer the reader's.
    if (alternative.kind === "clause") {
      const { clause } = alternative
      if (clause.kind === "is" && clause.value === "trashed") speaksOfTrash = true
      if (clause.kind === "prop" && !alternative.negated) namedProps.push(clause)
    }
    const last = groups[groups.length - 1]
    // Joined onto the group before it — unless the token that opened that group
    // was refused and there is none, which is a query that answers nothing
    // whatever this does with it.
    if (joined && last !== undefined) last.push(alternative)
    else groups.push([alternative])
  }
  // A joiner still waiting at the end of the tokens — UNLESS the scan stopped
  // early, in which case the reader did type something after it and the quote
  // ran away with it. `hinges OR "pick the` is one mistake, and telling them
  // the `OR` has nothing after it is the grammar reporting a second one that
  // was never made, beside the one that was.
  if (joining && unclosed === null) refusals.push({ token: JOINER, reason: JOINING })
  // LAST, because that is where it is in the text: the tokens before it were
  // read, and a query that got two things wrong is told about both.
  if (unclosed !== null) refusals.push({ token: unclosed, reason: UNCLOSED })

  // One refusal decides the whole query. The alternative — answering with the
  // half that parsed — is a list that looks like an answer to a question
  // nobody asked, which is the silent error the refusals exist to prevent.
  if (refusals.length > 0) return { kind: "refused", refusals }
  if (groups.length === 0) return { kind: "nothing" }
  return { kind: "asking", groups: inCostOrder(groups), namedProps, speaksOfTrash }
}

/**
 * One token, as the thing it can satisfy — or the sentence that says why it is
 * none of them.
 *
 * A QUOTED TOKEN IS A TERM AND IS NOT ASKED ANYTHING ELSE, which is the whole
 * of how quoting meets the operators: `"is:done"` is the text `is:done`, found
 * wherever somebody wrote it in a note, and there is otherwise NO way to look
 * for the spelling of an operator. The check is before the colon rather than
 * inside {@link isOperator} because the fact is about the token — the quotes
 * are gone from `text` by now, and a table that had to know about them would be
 * a second place quoting is decided.
 */
const alternativeOf = (
  token: Token,
  now: string,
  declarations: PropDeclarations | undefined,
): Alternative | Refused => {
  // Only quotes can leave a token with no word in it — a bare `-` is the
  // character itself — and TRIMMED, because a needle of one space is in every
  // node ever written exactly as an empty one is.
  if (token.text.trim() === "") return { reason: NOTHING_QUOTED }
  const asTerm = { kind: "term", word: token.text, negated: token.negated } as const
  if (token.quoted) return asTerm
  const colon = token.text.indexOf(":")
  const name = colon === -1 ? "" : token.text.slice(0, colon)
  if (!isOperator(name)) return asTerm
  const value = token.text.slice(colon + 1)
  const clause = clauseOf(name, value, now, declarations)
  if (clause === null) return { reason: teaching(name, value) }
  // An operator that wrote its own sentence, which is `prop:` alone
  // ({@link Refused}) — passed through rather than replaced by the table's,
  // because the table's would be true and useless: "prop: takes a key and a
  // value" is not what a reader who typed a range on an untyped key needs.
  if ("reason" in clause) return clause
  return { kind: "clause", clause, negated: token.negated }
}

/**
 * The groups, cheapest first: the ones that hold no word at all, then the rest.
 *
 * A REORDERING OF A CONJUNCTION, so it cannot change an answer — every group
 * has to hold, the score is a sum and the field a maximum, and none of the
 * three cares in which order they were asked. What it buys is the gate order
 * this file has always had and nearly lost to `OR`: `kitchen is:done` used to
 * be two lists and so tested the mark, which is a field read, before scanning
 * four haystacks it had to fold a whole note into. Typed order would have put
 * the scan first on every node of the set, on every keystroke of a filter.
 *
 * The lazier half is {@link matchOf}'s: a group that holds no word never asks
 * for a haystack, so a query of operators alone still folds nothing.
 */
const inCostOrder = (groups: ReadonlyArray<Group>): ReadonlyArray<Group> => {
  // The second list is the COMPLEMENT of the first rather than its own test, so
  // every group lands in exactly one of them by construction — which is what
  // makes this a reordering rather than a filter that could quietly drop one.
  const wordless = (group: Group) => group.every((one) => one.kind === "clause")
  return [...groups.filter(wordless), ...groups.filter((group) => !wordless(group))]
}

/**
 * The value an operator takes, read — or `null` for one it does not.
 *
 * A SWITCH over the operator's own type rather than a chain of `if`s ending in
 * a fallthrough, and the difference is what happens the day a fourth operator
 * is added to {@link OPERATORS}: the fallthrough parsed it as a `date:` and
 * refused every value it was given, silently and in the wrong words. Now it is
 * a compile error here and in {@link teaching}, which are the two places an
 * operator has to say something.
 */
const clauseOf = (
  name: Operator,
  value: string,
  now: string,
  declarations: PropDeclarations | undefined,
): Clause | Refused | null => {
  switch (name) {
    case "is":
      return isIsValue(value) ? { kind: "is", value } : null
    case "has":
      return hasClause(value)
    // The three that take a span of days, told apart by nothing but which
    // days they read — so the value is parsed once here and the operator's own
    // name is what the clause carries away.
    case "date":
    case "created":
    case "changed":
      return daysClause(name, value, now)
    case "prop":
      return propClause(value, now, declarations)
  }
}

/**
 * A refusal an operator wrote ITSELF, rather than falling through to
 * {@link teaching}'s table.
 *
 * One operator does ({@link propClause}), and it is the only one that could:
 * every other operator's values are a list this file holds, so "what you may
 * write" is the same sentence whatever was typed. A `prop:` value depends on
 * what the VAULT declares about that key, so the refusal has to say what the
 * key is — and a table of sentences indexed by operator name has nowhere to put
 * that.
 */
interface Refused {
  readonly reason: string
}

/**
 * `has:` — a field the record carries, or one of the three day readings asked
 * with NO BOUNDS.
 *
 * THE SPLIT IS HERE, ONCE PER QUERY, and that is the whole of what this
 * function is for. "`has:created` means `created:` with the bounds left off"
 * is a fact about the GRAMMAR — about which word the reader typed — and it was
 * being re-decided at the gate, per node, per clause, over the whole
 * directory. It is the argument {@link Filter}'s `namedProps` and
 * {@link inCostOrder} each make one shape over: a fact about the query is
 * answered where the query is read.
 *
 * What it buys downstream is that the two are no longer one thing to tell
 * apart. A `has` clause names a {@link CarriedField} and nothing else, so
 * {@link holds} has one branch where it had a branch and a test, and a `days`
 * clause is the only thing that ever reads a record as days — whether the
 * reader wrote `created:last-week` or `has:created`.
 */
const hasClause = (value: string): Clause | null => {
  if (!isHasField(value)) return null
  return isDayReading(value)
    ? { kind: "days", of: value, from: null, to: null }
    : { kind: "has", field: value }
}

/**
 * `prop:key` or `prop:key=value`, read — or `null` for a token with no key.
 *
 * The FIRST `=` splits it, so a value may hold one of its own:
 * `prop:source=https://x/?id=6560560` is a key, an equals, and a URL that has
 * its own. A key is whatever is left of it, whatever that is — `custom` takes
 * any key, and a grammar that fenced the spelling here would refuse tokens the
 * format accepts.
 *
 * An EMPTY value is not "matches nothing", it is a token that names a key and
 * then trails off: `prop:stage=` is refused, in the same voice `date:` with a
 * space after it is, because the alternative is a query that silently selects
 * the nodes whose `stage` holds the empty string — which is no node at all,
 * since a key holding nothing is a key the file does not carry.
 */
const propClause = (
  value: string,
  now: string,
  declarations: PropDeclarations | undefined,
): Clause | Refused | null => {
  if (value === "") return null
  const at = value.indexOf("=")
  if (at === -1) return { kind: "prop", key: value, value: null }
  const key = value.slice(0, at)
  const held = value.slice(at + 1)
  if (key === "" || held === "") return null
  // NOT CONSULTED IS NOT UNTYPED, and the two are told apart by the map being
  // absent rather than empty. A door that has not read the vault has no
  // standing to say a key is undeclared: a tab parsing its own filter box holds
  // no vocabulary (see {@link parseFilter}), and refusing `prop:records=190..200`
  // there would draw a refusal under a query the server is busy ANSWERING —
  // the app disagreeing with itself in front of the reader. So an unconsulted
  // parse reads what it always read: an equality on the text.
  if (declarations === undefined) return { kind: "prop", key, value: held }
  // FOLDED, because everything about `prop:` is: the token arrived folded, the
  // key scan folds, and a reader who typed `prop:PR` is asking about the key
  // written `pr` ({@link propKeyOf}). A declarations map is keyed by the title
  // somebody wrote, so the fold happens here rather than in the map.
  const kind = declaredKind(declarations, key)
  if (kind === "date") {
    const span = spanOf(held, now)
    return span === null
      ? { reason: `prop:${key} is a date — ${DAY_VALUES}` }
      : { kind: "prop", key, value: null, span: { of: "date", ...span } }
  }
  if (kind === "int") {
    const span = intSpan(held)
    return span === null
      ? {
        reason: `prop:${key} is a whole number — write one (${key}=193), or a range ` +
          `of them (${key}=190..200, ${key}=190.., ${key}=..200)`,
      }
      : { kind: "prop", key, value: null, span: { of: "int", ...span } }
  }
  // EVERY OTHER KEY IS AN EQUALITY, exactly as it always was — and a value that
  // READS AS A RANGE is refused instead of answered, which is the one thing
  // typing adds at this door for a key nobody typed.
  return readsAsRange(held, now)
    ? { reason: untypedRange(key, kind) }
    : { kind: "prop", key, value: held }
}

/**
 * What a key DECLARES — `undefined` for one nobody declared, which is every key
 * in a vault with no `_olai/Properties.olai` and most keys in one that has.
 *
 * A PLAIN LOOKUP, and that is the reconciliation rather than a shortcut: the
 * map's own keys are folded ({@link ../typing.ts}'s `keyOf`) and this token
 * arrived folded from the tokenizer, so the two spellings meet without either
 * side scanning. It used to fold the map per clause, which worked here and left
 * the WRITE side reading the map exactly — so `prop:PR` was a span while
 * `set_prop {"key":"PR"}` was untyped, the grammar and the gate disagreeing
 * about one word. The fold now happens once, where the map is built.
 */
const declaredKind = (
  declarations: PropDeclarations,
  key: string,
): PropType["kind"] | undefined => declarations.get(key)?.type.kind

/**
 * Does this value read as a RANGE of days or of whole numbers?
 *
 * The test that decides whether an untyped key's value is refused or is the
 * equality it has always been, and it is deliberately the WHOLE reading rather
 * than "does it contain `..`". A property value may hold those two characters
 * for reasons that are nobody's range — `prop:worktree=../sibling`,
 * `prop:version=1.0..2.0` — and refusing those would be this grammar breaking
 * queries that work today in order to teach a lesson about a query nobody
 * wrote. What IS refused is a value that would have been a span if the key had
 * been declared: `190..200`, `2026-08-01..2026-08-14`, `last-week..`. Those are
 * the ones where answering an equality is the silent nothing.
 */
const readsAsRange = (value: string, now: string): boolean =>
  value.includes(RANGE) && (spanOf(value, now) !== null || intSpan(value) !== null)

/** The sentence a range on a key that cannot compare gets — naming what the key
 *  IS, since the fix differs: an undeclared key wants a declaration, and a
 *  declared `ref` or `path` wants a different question. */
const untypedRange = (key: string, kind: PropType["kind"] | undefined): string =>
  `prop:${key} takes a value, not a range — ${
    kind === undefined
      ? `nothing declares \`${key}\`, so its values are text`
      : `\`${key}\` is declared \`${kind}\``
  }, and comparing text as if it were a date or a number is what a range would ` +
  `be doing. Declare the key \`date\` or \`int\` in \`${mintedInto(PROPERTIES)}\` to ask for a span.`

/**
 * A RANGE OF WHOLE NUMBERS, or one number as the span of itself — or `null` for
 * a value an `int` key cannot be asked about.
 *
 * `intSpan("193")` is `193..193` rather than an equality, and that is the
 * point of the key being declared: `0193` and `193` are one number and two
 * strings, so a reader who typed either is asking the same question. What the
 * declaration refuses on the WRITE side is the second spelling ever reaching a
 * file ({@link ../typing.ts}'s `isDigitRun`); what it buys on the read side is
 * that the query does not have to know that.
 *
 * The bounds themselves are digit runs, and a sign or a decimal point is
 * refused rather than coerced: `Number("1e3")` is a thousand and `1e3` is not a
 * number anybody typed into a range.
 */
const intSpan = (
  value: string,
): { readonly from: number | null; readonly to: number | null } | null => {
  const at = value.indexOf(RANGE)
  if (at === -1) return isDigitRun(value) ? { from: Number(value), to: Number(value) } : null
  const left = value.slice(0, at)
  const right = value.slice(at + RANGE.length)
  if (left === "" && right === "") return null
  if (left !== "" && !isDigitRun(left)) return null
  if (right !== "" && !isDigitRun(right)) return null
  return {
    from: left === "" ? null : Number(left),
    to: right === "" ? null : Number(right),
  }
}

/**
 * What each operator takes, said the way the refusal vocabulary says things:
 * the values, in full, so the next thing typed can be right — read off the
 * same tables the parser reads, so a value added to one of them teaches itself.
 *
 * NO VALUE AT ALL gets its own sentence, because it is almost never the
 * mistake it looks like: `date: 2026` is a space after the colon, which the
 * tokenizer splits into an empty `date:` and a stray word. Answering that with
 * "date: takes a day, month or year" teaches the wrong lesson — the reader
 * wrote a day; they wrote a space.
 */
const teaching = (name: Operator, value: string): string => {
  if (value === "") {
    return `${name}: was given no value — a space after the colon splits it into two words`
  }
  switch (name) {
    case "is":
      return `is: takes one of ${IS_VALUES.join(", ")}`
    case "has":
      return `has: takes one of ${HAS_FIELDS.join(", ")}`
    // ONE SENTENCE FOR THE THREE, named by whichever was typed. They share a
    // value grammar exactly ({@link DAY_READINGS}), so a reader refused at
    // `created:soon` is taught the same values a reader refused at `date:soon`
    // is — and a value added to that grammar teaches itself at all three doors
    // rather than at whichever copy somebody remembered. Which is what the
    // durations spent: `1mo` and `1y` refuse in one sentence at three
    // operators, and the sentence says which four units there are and that
    // months and years are deliberately not among them.
    case "date":
    case "created":
    case "changed":
      return `${name}: takes ${DAY_VALUES}`
    case "prop":
      // The one operator whose values are not a list this file holds — any key
      // is a key — so what it teaches is the SHAPE, and the two shapes are the
      // whole grammar of it.
      return "prop: takes a property key (prop:pr) or a key and a value (prop:agent=claude-opus)"
  }
}


/** A year, a month or a day — the three lengths an ISO prefix comes in. The
 *  SHAPE only; {@link datePart} is what says the numbers are possible. */
const PARTIAL_DAY = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/
const RANGE = ".."

// ── the relative words ─────────────────────────────────────────────────

/**
 * The three words for a DAY near today, and how many days each is away.
 *
 * Three words rather than `this-day` and its family, because that is the shape
 * English already has: a person who means the day they are standing on says
 * `today`. The units below have no such words, so they take the prefixes.
 *
 * A MAP AND NOT AN OBJECT, here and for {@link RELATIVE_STEPS}, because the key
 * is a WORD SOMEBODY TYPED. An object lookup answers for the prototype as well
 * as for the table, with a value of the wrong kind: `date:constructor` came
 * back with a function where a number of days was expected and minted a bound
 * with that function's source text glued to the day, and `date:__proto__-week`
 * came back with an object and minted `2026-08-NaN`. Both are a query that
 * finds nothing and says nothing — the exact silence the refusal arm exists to
 * prevent, since neither is a word this operator takes. `Map.get` answers for
 * what was put in it and nothing else. The tables the grammar keys by its OWN
 * values (the field weights, the operator names) are objects still; this is the
 * distinction, not a new house style.
 */
const RELATIVE_DAYS: ReadonlyMap<string, number> = new Map([
  ["today", 0],
  ["yesterday", -1],
  ["tomorrow", 1],
])

/** The units a `this-` / `last-` / `next-` word can name — the three the
 *  absolute grammar can already spell a WHOLE of (`2026-08` is a month,
 *  `2026` a year), plus the week, which it cannot spell at all and which is the
 *  reason this vocabulary was asked for. */
const RELATIVE_UNITS = ["week", "month", "year"] as const
type RelativeUnit = (typeof RELATIVE_UNITS)[number]

/** Is the word after the prefix one of them? A type guard, {@link isOperator}'s
 *  shape, so the branches below are ones the compiler checks — a fourth unit
 *  added to the list above is an error there rather than a word that parses and
 *  resolves to a year. */
const isUnit = (name: string): name is RelativeUnit =>
  (RELATIVE_UNITS as ReadonlyArray<string>).includes(name)

/** How far each prefix steps, in whole units of whatever it is prefixing. A
 *  MAP for {@link RELATIVE_DAYS}' reason: `date:__proto__-week` is a token
 *  somebody can type, and an object would have answered it. */
const RELATIVE_STEPS: ReadonlyMap<string, number> = new Map([
  ["this", 0],
  ["last", -1],
  ["next", 1],
])

/**
 * The vocabulary as a refusal says it: the day words listed, and the other
 * nine as the two lists they are the product of.
 *
 * IN FULL, which is this file's rule for what a refusal teaches — nothing is
 * elided, and a reader can write any of the twelve off this sentence. It is
 * generative rather than enumerated because that is what the words ARE: three
 * prefixes over three units, and spelling out nine of them makes a line
 * nobody reads to the end out of one somebody can. `prop:` teaches its shape
 * for the same reason.
 *
 * Built from the tables above rather than written beside them, so a prefix or
 * a unit added to one teaches itself exactly as an `is:` value does.
 */
const RELATIVE_TEACHING = `${[...RELATIVE_DAYS.keys()].join(", ")}, or ${
  [...RELATIVE_STEPS.keys()].map((step) => `${step}-`).join(" / ")
} with ${RELATIVE_UNITS.join(", ")}`

// ── the durations ──────────────────────────────────────────────────────

/**
 * THE FOUR UNITS A DURATION COUNTS IN, and how many minutes each is worth.
 *
 * `<n><unit>` is a MOMENT rather than a day — the moment that many units before
 * the question was asked — and it is the value kind the day words could not
 * spell: the stamps carry seconds and `today` bottoms out at midnight, so
 * "what did I touch in the last hour" had no spelling until this one
 * (roadmap `duration-values`, ruled 2026-08-21).
 *
 * FOUR AND NOT SIX. There is no month unit and no year unit, and that is a
 * RULING rather than an omission: `m` is the letter both `minutes` and
 * `months` want, every system that took both had to give one of them away, and
 * minutes win here because month and year recency is already sayable in words
 * (`last-month..`, `2026`) while minutes were sayable in nothing at all. So
 * `1mo` and `1y` are refused, and the refusal says so in as many words
 * ({@link DURATION_TEACHING}).
 *
 * A MAP for {@link RELATIVE_DAYS}' reason, which is the same reason one letter
 * later: `1constructor` is a token somebody can type, and an object would have
 * answered it with a function where a number of minutes was expected.
 *
 * The NAMES ride along beside the numbers because the refusal has to spell
 * them: a reader refused at `1mo` is being told `m` means minutes, and a list
 * of four bare letters would leave them to guess the very thing the ruling
 * decided.
 */
const DURATION_UNITS: ReadonlyMap<string, { readonly minutes: number; readonly named: string }> =
  new Map([
    ["m", { minutes: 1, named: "minute" }],
    ["h", { minutes: 60, named: "hour" }],
    ["d", { minutes: 60 * 24, named: "day" }],
    ["w", { minutes: 60 * 24 * 7, named: "week" }],
  ])

/**
 * The SHAPE of a duration — digits then letters, with the letters looked up
 * rather than listed here, so {@link DURATION_UNITS} stays the one place a
 * unit is named and `1mo` reaches the refusal by the same road `1q` does.
 *
 * THE DIGITS ARE CAPPED because a NUMBER has a shape too, and this is the same
 * pair {@link datePart} is: a shape check here, and the value check one call
 * down. Six digits is past every duration a person means — a hundred thousand
 * hours is eleven years — and a count wider than that is a reader who slipped
 * on the keyboard rather than one who meant something the calendar could hold.
 *
 * WHAT IS IMPOSSIBLE rather than merely long is {@link shiftMinutes}' answer:
 * `999999w` is nineteen thousand years, lands on no day four digits can spell,
 * and is refused there. THE COST of an absurd count is that function's own
 * problem too and is not smuggled up here as a reason for this cap — it takes
 * any number and bounds its own work, so this line is about what a duration
 * IS and not about what it would cost to answer.
 */
const DURATION_SHAPE = /^(\d{1,6})([a-z]+)$/

/**
 * The vocabulary as a refusal says it — the four letters, what each one MEANS,
 * and the two units that are deliberately not here.
 *
 * IN FULL and GENERATIVE, which is {@link RELATIVE_TEACHING}'s rule inherited:
 * built from the table above, so a unit added there teaches itself. The
 * parenthetical about months and years is the one part written by hand, and it
 * is written because a reader who typed `1mo` has met a ruling rather than a
 * gap and is owed the difference — "no month or year units" is what stops them
 * trying `1M`, `1mon` and `1month` in turn.
 *
 * EXPORTED, alone among the vocabulary here, and the asymmetry is the point:
 * `./searching.ts` describes this grammar to an AGENT, and it was spelling the
 * four units out again in prose. Two lists of what `m` means is exactly what
 * {@link DURATION_UNITS} claims not to have — so the door interpolates this
 * sentence and a fifth unit teaches itself at the refusal AND at the tool
 * description, rather than at whichever of the two somebody remembered. The
 * relative words have no such export because their door never re-listed them.
 */
export const DURATION_TEACHING = `a duration back from now (${
  [...DURATION_UNITS].map(([unit, { named }]) => `1${unit} = 1 ${named}`).join(", ")
}; no month or year units)`

/**
 * THE DAY GRAMMAR'S VALUES, in full — the clause of a refusal, without the
 * operator's name in front of it.
 *
 * Split out for the second door that teaches this vocabulary, which is a
 * `date`-TYPED PROPERTY ({@link propClause}): the same values in the same
 * grammar read of a different place, so a reader refused at
 * `prop:dispatched=soon` is taught what a reader refused at `created:soon` is.
 * Which is the argument {@link teaching} already makes about its three day
 * operators, one operator further out.
 *
 * HERE rather than beside {@link teaching}, which is where it reads: it is
 * built from the two tables below it, so a constant declared up there would be
 * evaluated before either of them existed.
 */
const DAY_VALUES = "a day, month or year (2026-08-10, 2026-08, 2026), " +
  `a relative word (${RELATIVE_TEACHING}), ` +
  `${DURATION_TEACHING}, ` +
  "or a range of any of them (2026-08-01..2026-08-14, ..2026-08-10, " +
  "last-week.., 2h..30m). A bare duration is the range it opens: 1h is 1h.., " +
  "within the last hour"

/**
 * A duration, as the moment it names — or `null` for a value that is not one.
 *
 * THE ONE PLACE A DURATION IS READ, and it has exactly one caller —
 * {@link meaningOf}, which is the one reading of a day operator's value. What
 * comes out of that reading says WHICH FORM it was, so the rule about what a
 * bare one means ({@link daysClause}) reads the form rather than testing for it
 * a second time. `created:1h` and `created:..1h` cannot come to disagree about
 * what an hour is, because neither of them asks.
 *
 * ANCHORED AT ASK TIME, off the same `now` the relative words count from and
 * with no re-ask timer behind it: a page showing `created:1h` drifts within the
 * hour exactly as one showing `created:today` drifts across midnight — the
 * query is asked again on every revision, and answered against the clock as it
 * is then. That is the contract `today` already had, extended rather than
 * restated (docs/search.md).
 *
 * WHAT COMES BACK IS A MOMENT AND NOT A DAY, which is the whole of what this
 * value kind adds and the reason {@link within} compares at the width of the
 * bound rather than at the width of a day.
 */
const durationBefore = (value: string, now: string): string | null => {
  const shape = DURATION_SHAPE.exec(value)
  if (shape === null) return null
  const [, count, unit] = shape as unknown as [string, string, string]
  const size = DURATION_UNITS.get(unit)
  if (size === undefined) return null
  return shiftMinutes(now, -Number(count) * size.minutes)
}

/** An inclusive span, both ends spelled out — a STRETCH of time, which is what
 *  a day, a month, a year and a relative word each name. What a value means is
 *  this or a single moment ({@link Meaning}); a duration is the second, and
 *  {@link edgesOf} is where one is offered as the other. */
interface Span {
  readonly from: string
  readonly to: string
}

/**
 * A relative word, resolved against the day the query is being asked on — or
 * `null` for a word that is not one.
 *
 * A PURE FUNCTION OF (word, now), which is the whole of why the clock is a
 * parameter of {@link parseFilter} rather than something read in here: a
 * boundary that moves with the machine is a boundary no test can pin, and every
 * one of these is right for most of the year and off by a day in some
 * particular week. `now` arrives from the ONE clock each door has — the tab's
 * (`@olai/web`'s `clock.ts`) for the filter the browser parses itself, the
 * server's (`@olai/ops`' `Context.now`, the clock a `done` is stamped with) for
 * the three doors that ask it. EITHER SHAPE: a day, or an instant on one, cut
 * down by ./dates.ts's own `dayOf` rather than by each door before it calls —
 * which is the ruling `isOverdue` made about this same parameter, after an
 * untrimmed instant reached it.
 *
 * NOTHING IS COUNTED HERE. The three questions this needs — the day before or
 * after one, the month or the year `n` away, which weekday today is — are all
 * ./calendar.ts's, and a week is those composed rather than a fourth: back to
 * the Monday, then whole weeks from there. So the claim that file makes about
 * being the only place a date is counted survives its first caller.
 *
 * A WEEK RUNS MONDAY TO SUNDAY, and it is not this file's opinion either: it
 * is `weekdayOf`'s count, which is the one the calendar grid lays its columns
 * out by. A query that started its week on Sunday would be selecting days the
 * grid draws in another row.
 *
 * A MONTH AND A YEAR are handed to the same {@link lowOf} / {@link highOf} the
 * absolute forms use, so `date:this-month` and `date:2026-08` are one answer
 * rather than two — including the upper bound being `-31` whether or not the
 * month has one, which is that pair's own argued rule.
 *
 * `null` for a `now` that names no day, which no door can hand over: a clock
 * that says nothing is not a day to count from, and inventing one would be
 * this grammar answering a date question out of thin air.
 *
 * EXPORTED for {@link meaningOf} next door and for the test that pins these
 * boundaries against a fixed day — which is the half of this feature a test can
 * hold still, and the reason the clock is an argument at all.
 */
export const relativeSpan = (word: string, now: string): Span | null => {
  const today = dayOf(now)
  // Which weekday the reader is standing on — and, since it is `null` for text
  // that names no day, whether there is a day to count from at all. One
  // question, because a second validity check here would be a second answer to
  // what a day is. It costs one reading per `date:` token, which is once per
  // query rather than once per node.
  const standing = weekdayOf(today)
  if (standing === null) return null

  const near = RELATIVE_DAYS.get(word)
  if (near !== undefined) {
    const day = shiftDay(today, near)
    return { from: day, to: day }
  }

  const at = word.indexOf("-")
  if (at === -1) return null
  const step = RELATIVE_STEPS.get(word.slice(0, at))
  const unit = word.slice(at + 1)
  if (step === undefined || !isUnit(unit)) return null

  if (unit === "week") {
    // Back to this week's Monday, then a whole number of weeks from there.
    const monday = shiftDay(today, step * 7 - standing)
    return { from: monday, to: shiftDay(monday, 6) }
  }
  // A year is twelve months through the same counter, rather than four digits
  // added to by hand: one arithmetic, and no second rule about how a year is
  // spelled.
  const months = unit === "month" ? step : step * 12
  const stepped = shiftMonth(monthOf(today), months)
  // …and then read at the width the unit names: `2026-09` or the `2026` in
  // front of it, which is exactly what a reader would have typed.
  const whole = unit === "month" ? stepped : stepped.slice(0, 4)
  return { from: lowOf(whole), to: highOf(whole) }
}

/**
 * One end of a `date:`, read — or `null` for a value no day could ever match.
 *
 * The shape is a regex and the NUMBERS are a bound check, and both are needed:
 * `2026-13` is shape-clean and impossible, and a query that answered it with an
 * empty tree and no reason would be the silent error this grammar's whole
 * refusal arm exists to prevent. Month 13 is the reader's mistake exactly as
 * much as `date:soon` is — and it is the worse of the two to swallow, because
 * `2026-13` SORTS between December and January, so it reads as a window rather
 * than as nonsense.
 *
 * The bound is 1–12 and 1–31, which is what is impossible in ANY month rather
 * than in the month named. `2026-02-30` is accepted and matches nothing, and
 * that boundary is deliberate: telling those apart needs a calendar, and this
 * module's whole date stance — the same one that makes a month's upper bound
 * `-31` — is that a comparison over text answers the question without inventing
 * one. Named in docs/brainstorming/filter-in-place.md as the line.
 */
const datePart = (value: string): string | null => {
  const shape = PARTIAL_DAY.exec(value)
  if (shape === null) return null
  const [, , month, day] = shape
  if (month !== undefined && !twoDigitsIn(month, 1, 12)) return null
  if (day !== undefined && !twoDigitsIn(day, 1, 31)) return null
  return value
}

const twoDigitsIn = (digits: string, low: number, high: number): boolean => {
  const value = Number(digits)
  return value >= low && value <= high
}

/**
 * WHAT A DAY OPERATOR'S VALUE MEANS — a span of days, or the single MOMENT a
 * duration counts back to.
 *
 * A UNION rather than a span with a flag, and it is the distinction the whole
 * value kind turns on: every other form names a stretch of time with two ends,
 * and a duration names one instant. Both are usable as a range END (a moment
 * is its own low and its own high, {@link edgesOf}), and they part company at
 * exactly one place — what a BARE value means, which is {@link daysClause}'s to
 * say.
 *
 * THE FLAG WAS THE OTHER SHAPE and it is the worse one, for the reason a
 * `Clause` is a union rather than a record of optional fields: `{ from, to,
 * moment: true }` can be built with two DIFFERENT ends — a value insisting it
 * is one instant while carrying a stretch — and nothing would catch it. This
 * cannot be spelled. The flag would also be a second answer to a question the
 * edges already answer, which is the thing every table in this file is
 * arranged to avoid.
 *
 * SO THE FORM IS CARRIED rather than re-derived. The bare-form rule was, for
 * one commit, `daysClause` asking "is this a duration?" for itself before
 * falling through to a reading that asked the same question again — which is
 * two places knowing how a duration is recognised, and the shape that would
 * have been copied for the next value form with a bare reading of its own. The
 * reading answers WHICH FORM it read, once, and the rule reads it.
 */
type Meaning =
  | { readonly kind: "span"; readonly span: Span }
  | { readonly kind: "moment"; readonly at: string }

/**
 * One end of a `date:`, read — or `null` for a value this operator does not
 * take.
 *
 * The ONE reading of a `date:` value, whichever form it is written in: a
 * relative word first ({@link relativeSpan}), then a duration
 * ({@link durationBefore}), then the absolute prefix. Which is what makes each
 * of them compose with a range for free rather than by a rule per form —
 * `date:last-week..` is the low end of last week's span with nothing above it,
 * exactly as `date:2026-08..` is the low end of August's, and `changed:..30m`
 * is the moment half an hour ago with nothing below it.
 *
 * THE THREE ARMS CANNOT COLLIDE — a day word is letters, a duration is digits
 * then letters, an absolute value is digits and dashes — so the order here is
 * the order the forms are cheapest to rule out rather than a precedence
 * anybody has to know.
 */
const meaningOf = (value: string, now: string): Meaning | null => {
  const relative = relativeSpan(value, now)
  if (relative !== null) return { kind: "span", span: relative }
  const moment = durationBefore(value, now)
  if (moment !== null) return { kind: "moment", at: moment }
  return datePart(value) === null
    ? null
    : { kind: "span", span: { from: lowOf(value), to: highOf(value) } }
}

/** The low and the high edge of what a value means. A span offers its two
 *  ends; a MOMENT offers itself as both, which is the whole of why a duration
 *  sits at either end of a range without a rule of its own. */
const edgesOf = (meaning: Meaning): Span =>
  meaning.kind === "moment"
    ? { from: meaning.at, to: meaning.at }
    : meaning.span

/**
 * A DAY OPERATOR's value — a day, a month, a year, a relative word, a duration
 * back from now, or a span of any of them — with the operator's own name
 * carried through as WHICH of a record's days it will be asked of.
 *
 * ONE PARSE FOR THE THREE ({@link DAY_READINGS}), and `of` is the only thing
 * that distinguishes what comes out. That is the decomplecting the pair of
 * stamp operators is worth: `created:last-week..` did not need a line of
 * parsing written for it, because a span of days and the days a record offers
 * are two questions and this one had already been answered.
 *
 * Bounds are ISO TEXT and comparison is text, as everywhere else in this
 * package: dates are validated ISO and stored verbatim, so a range is two
 * string comparisons. Nothing is parsed into an instant — a date-only value put
 * through one comes back a datetime, and ./dates.ts already says why this is
 * not the place to risk it. The arithmetic a relative word or a duration needs
 * is ./calendar.ts's, over integers, and it happens ONCE per query rather than
 * per node: what a clause holds afterwards is two strings, whatever form
 * minted them.
 *
 * WHAT A BOUND CAN NOW BE is a day or a MOMENT, and the difference is only how
 * wide it is — ten characters for `2026-08-10`, a whole clock face and an
 * offset for the moment a duration names. Each bound is compared at its own
 * width ({@link within}), so a clause may hold one of each and
 * `created:yesterday..3h` is one question rather than two.
 *
 * A month's upper bound is `-31` whether or not that month has one: as an
 * upper bound in a string comparison no real day of the month exceeds it, and
 * inventing a calendar here would be arithmetic to answer a question the
 * comparison already answers.
 *
 * A range takes each end's own edges and keeps the OUTER one — the low of the
 * left, the high of the right — so `date:last-week..today` runs from last
 * Monday to tonight, and an end left empty is unbounded that way. It never
 * asks which FORM an end was written in ({@link edgesOf}), which is why the
 * durations cost this arm nothing.
 */
const daysClause = (of: DayReading, value: string, now: string): Clause | null => {
  const span = spanOf(value, now)
  return span === null ? null : { kind: "days", of, from: span.from, to: span.to }
}

/**
 * THE DAY GRAMMAR'S VALUE, as two bounds — {@link daysClause} with the
 * operator's own name taken off.
 *
 * Split out for the second reader, which is a `date`-TYPED PROPERTY
 * ({@link propClause}): `prop:dispatched=2026-08-20..` is the same value in the
 * same grammar read of a different place, and a second parse of it would be a
 * second answer to "what does `last-week..` mean" — refused at one operator and
 * accepted at another, or worse, agreeing today. Which is exactly the argument
 * the three day operators already share this function for.
 */
const spanOf = (
  value: string,
  now: string,
): { readonly from: string | null; readonly to: string | null } | null => {
  const at = value.indexOf(RANGE)
  if (at === -1) {
    const meaning = meaningOf(value, now)
    if (meaning === null) return null
    // THE ONE FORM WHOSE BARE READING IS NOT ITS EDGES, and the only place the
    // two arms of {@link Meaning} are told apart. A duration read on its own is
    // sugar for the range it opens — `created:1h` IS `created:1h..`, "within
    // the last hour" — because that is what somebody's fingers mean by it, and
    // what every system with this value kind means by it (Workflowy's
    // `last-changed:1h`, Gmail's `newer_than:`). The point reading is still
    // there and still spellable, one character away: `created:..1h` is the
    // other side of the same moment, older than an hour.
    const edges = edgesOf(meaning)
    return {
      from: edges.from,
      // ...and the high end is the only thing the sugar changes: a duration
      // opens upward, every other form closes at its own end.
      to: meaning.kind === "moment" ? null : edges.to,
    }
  }
  const left = value.slice(0, at)
  const right = value.slice(at + RANGE.length)
  if (left === "" && right === "") return null
  const low = left === "" ? null : meaningOf(left, now)
  if (left !== "" && low === null) return null
  const high = right === "" ? null : meaningOf(right, now)
  if (right !== "" && high === null) return null
  // A range takes the OUTER edge of each end and never asks which form wrote
  // it — which is what {@link edgesOf} buys, and why a duration needed no line
  // of range parsing written for it.
  return {
    from: low === null ? null : edgesOf(low).from,
    to: high === null ? null : edgesOf(high).to,
  }
}

const lowOf = (value: string): string =>
  value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value

const highOf = (value: string): string =>
  value.length === 4 ? `${value}-12-31` : value.length === 7 ? `${value}-31` : value

// ── what a query selects ───────────────────────────────────────────────

/** Why a node matched: the highest-weighted field that carried one of the
 *  words, and what the words added up to. `field` is `null` for a query that
 *  named no words at all (`is:done` on its own) — nothing carried it, and
 *  saying "title" would be inventing an answer. */
export interface Match {
  readonly field: SearchField | null
  readonly score: number
  /**
   * The custom keys a POSITIVE `prop:` clause selected this node on, in the
   * node's OWN spelling — empty for every query that named none.
   *
   * A SECOND field beside {@link field} rather than a fifth value of it, and
   * the reason is that they answer different questions which can both be true
   * at once: `cabinets prop:agent=claude-opus` matched on the title AND on the
   * agent property, and one slot could only report whichever a precedence rule
   * nobody asked for happened to prefer. {@link field} is also the CLOSED list
   * of four places a WORD is looked for, weighted for tie-breaking; a property
   * key is an open namespace somebody invented, and putting the two in one
   * union is the same collapse `custom` itself exists to refuse
   * (docs/brainstorming/properties.md). The absence of `field` still means
   * exactly what it meant — the query named no words.
   *
   * The NODE'S spelling, not the query's, because the query's is folded
   * (`prop:PR` finds a key written `pr`) and a reader of this wants to look the
   * key up in the map the hit carries. Which is also why NEGATED clauses are
   * left out: a node selected by `-prop:agent` was not selected ON `agent` —
   * it is here because it carries no such key at all.
   */
  readonly props: ReadonlyArray<string>
}

/** One node the query selected, with why. */
export interface Matched {
  readonly at: LocatedRegular
  readonly match: Match
}

/** Which corner of the set to ask. Both are optional and both narrow: `file`
 *  is one outline, `under` is a node and everything beneath it (the node
 *  itself included). They are the two scopes a tree page can BE, which is why
 *  they exist — see docs/brainstorming/filter-in-place.md's MCP face. */
export interface Scope {
  readonly file?: string | undefined
  readonly under?: string | undefined
  /**
   * Whether what was put AWAY is in this corner of the set at all.
   *
   * The default is the grammar's own rule — archived nodes are out of every
   * reading unless the query says `is:trashed` (docs/search.md) — because the
   * doors that leave it alone are asking about the DIRECTORY, where an archive
   * is a place a reader has to name before they are shown it.
   *
   * `true` is for a caller whose scope ALREADY HOLDS what was put away, and it
   * says nothing about which page that is — the flag is the caller answering
   * for its own corner of the set, never a permission to widen a search of the
   * directory. The filter over a page is the caller there, and it passes `true`
   * where the rows in front of somebody are archived ones: the trash, which IS
   * the archive, and a zoom onto an archived node, which is where an
   * `is:trashed` hit lands. A matcher applying the default to either would
   * take every row off the screen and leave nothing to read the absence by.
   *
   * That was three pages until 2026-08-17, when the human ruled that what is
   * put away is drawn on the trash and nowhere else; a day and the agenda drew
   * archived rows until ./dates.ts stopped them, and the caller narrowed with
   * them (`@olai/web`'s `filter/narrowing.ts`).
   */
  readonly trashed?: boolean | undefined
}

/**
 * Does this node match, and why — or `null`.
 *
 * The order of the gates is the order of their cost: a query that is not
 * ASKING decides before anything is read, the clauses are a field test or an
 * index lookup, and the words are the only thing that scans text. (The archive
 * is cheaper than all of them and is asked one level up, in {@link matching},
 * because whether it is in the reading at all is a fact about the QUESTION —
 * the query's own `is:trashed`, or a caller whose scope already holds it.)
 * That order survived `OR` in two halves — the groups
 * arrive with the wordless ones in front ({@link inCostOrder}), and the
 * haystacks are minted at the first word rather than at the top.
 *
 * THE DERIVATION IS A PARAMETER because one clause is not about the record:
 * `is:blocked` is a question about the SET (what this node waits on, and
 * whether that is still unfinished work), and the answer is an index every
 * caller of {@link matching} already holds. Named as the cost of this operator
 * in docs/brainstorming/filter-in-place.md when it was deferred, and it is the
 * whole of it — a lookup at the gate, no walk.
 */
const matchOf = (
  derived: Derived,
  at: LocatedRegular,
  filter: Filter,
): Match | null => {
  // Neither an empty box nor a query the grammar could not read selects
  // anything — and neither of them HAS groups to be tempted by, which is what
  // the union above is for.
  if (filter.kind !== "asking") return null

  // The four fields as text, folded — four allocations and up to three folds of
  // a whole note, so they are minted at the first WORD this node is asked about
  // and never for a query that names none. `is:done` on its own is exactly that
  // query, and the groups that hold no word are tested first ({@link
  // inCostOrder}), so a node it rejects is rejected before this is reached.
  const found = matchedBy(
    filter.groups,
    (clause) => holds(derived, at, clause),
    // The four fields as text, folded — four allocations and up to three folds
    // of a whole note, so they are minted at the first WORD this node is asked
    // about and never for a query that names none.
    () => haystacksOf(at.node),
    SEARCH_FIELDS,
    FIELD_WEIGHT,
  )
  if (found === null) return null

  // Collected only for a node that has already matched, so the map is walked
  // for the few nodes a query selects rather than for every node it considers.
  return { ...found, props: propsOf(customOf(at.node), filter) }
}

/**
 * WHETHER A THING MATCHES, AND HOW WELL — the algorithm, over whatever
 * vocabulary that kind of thing has.
 *
 * ONE function for the two kinds a query selects, and the split is the point:
 * what is SHARED is the shape of a query (every group must hold, a group holds
 * when any alternative in it does, a group is worth its best word, the
 * highest-weighted field names the hit); what DIFFERS is what a clause means
 * and where a word is looked for. Those two arrive as arguments, and the rest
 * of it cannot come to differ between a record and a document — which it would
 * have, written twice, the first time somebody fixed the scoring on one of
 * them.
 *
 * A CLAUSE IS ASKED AS A PLAIN QUESTION and the negation is applied here, which
 * is what lets a document answer the whole family in one line
 * ({@link documentHolds}): its frontmatter answers `prop:`, everything else is
 * no — so those select no document and their negations are satisfied.
 *
 * THE HAY IS A THUNK, not a value, and that is the same laziness this had when
 * it was inline: folding a whole note (or a whole body) is the expensive part,
 * so it happens at the first WORD the thing is asked about and never for a
 * query that names none. `is:done` on its own is exactly that query, and the
 * groups that hold no word are tested first ({@link inCostOrder}).
 */
const matchedBy = <F extends string>(
  groups: ReadonlyArray<Group>,
  holdsClause: (clause: Clause) => boolean,
  hayOf: () => Record<F, ReadonlyArray<string>>,
  fields: ReadonlyArray<F>,
  weights: Record<F, number>,
): { readonly field: F | null; readonly score: number } | null => {
  let hay: Record<F, ReadonlyArray<string>> | null = null
  let score = 0
  let field: F | null = null
  let weight = -1

  for (const group of groups) {
    // Every alternative is asked, rather than stopping at the first that holds,
    // and the reason is the SCORE: a group is worth its best word, so which
    // alternative the reader happened to type first must not decide how high
    // the hit ranks. The cost is the same scan the conjunction did when these
    // were separate tokens.
    let holding = false
    let best: { readonly field: F; readonly score: number } | null = null
    for (const one of group) {
      if (one.kind === "clause") {
        if (holdsClause(one.clause) !== one.negated) holding = true
        continue
      }
      hay ??= hayOf()
      const hit = wordHit(hay, one.word, fields, weights)
      if (one.negated) {
        if (hit === null) holding = true
        continue
      }
      if (hit === null) continue
      holding = true
      if (best === null || hit.score > best.score) best = hit
    }
    // Every group, in the same thing. One that nothing satisfied and it is not
    // a hit.
    if (!holding) return null
    if (best === null) continue
    score += best.score
    if (weights[best.field] > weight) {
      weight = weights[best.field]
      field = best.field
    }
  }
  return { field, score }
}

/**
 * The map's own spelling of every key a positive `prop:` clause selected it
 * on — {@link Match.props}, which argues the shape.
 *
 * OVER THE MAP for {@link propKeyOf}'s reason next door, and it is what makes
 * a document's hit say why it is on screen the same way a node's does: the
 * open field of a record and the frontmatter of a `.md` are one type, so this
 * is one function rather than two that would eventually order their keys
 * differently.
 *
 * EMPTY for the queries that are nearly all of them, and cheaply: this is
 * CALLED for everything the clauses let through, but a query with no `prop:` in
 * it only walks its own clause list and never reaches the scan below.
 *
 * The scan is {@link propKeyOf}'s, for the reason that one gives — keys are
 * FOLDED, so `props["pr"]` would find one spelling and miss the other — and
 * asking it again here rather than threading the answer out of the gate above
 * keeps `holds` a predicate. The cost is a second walk of a handful of entries,
 * on the things a query actually selected.
 */
const propsOf = (
  props: Custom,
  filter: Extract<Filter, { kind: "asking" }>,
): ReadonlyArray<string> => {
  // "No work at all" said in the code as well as in the sentence below: this
  // is called for everything the clauses let through, so the array it used to
  // mint before looking was an allocation per hit of every query in the app —
  // and nearly every query names no property.
  if (filter.namedProps.length === 0) return NO_KEYS
  const keys: Array<string> = []
  // The clauses the query NAMED, in the reader's own order and without walking
  // the groups it is tested through — {@link Filter}'s `namedProps` argues both
  // halves of that, and the second one is why a query that names no property
  // does no work here at all.
  for (const clause of filter.namedProps) {
    // ASKED AGAIN rather than remembered from the gate, which is what makes an
    // alternative honest: a node in a group like `prop:pr OR cabinets` may be
    // here on the word alone, and naming a key it does not carry would be the
    // row drawing a lie. `null` says so.
    const key = propKeyOf(props, clause)
    // Reported once however many clauses name it: `prop:pr prop:pr=x` is one
    // key the reader would see twice.
    if (key !== null && !keys.includes(key)) keys.push(key)
  }
  return keys
}

/** One empty list for every hit of every query that named no property, which
 *  is nearly all of them — `./documents.ts`'s `NO_LINKS` next door, for its
 *  reason. */
const NO_KEYS: ReadonlyArray<string> = []

/** The best a single word does across the four fields: the score it earns, and
 *  the highest-weighted field that held it. */
const wordHit = <F extends string>(
  hay: Record<F, ReadonlyArray<string>>,
  word: string,
  /** Which places to look, and what each is worth. A PARAMETER since PR 2,
   *  because there are two vocabularies now and one walk: a record's four
   *  fields, and the three a document has. What the two share is the rule —
   *  best score wins, highest-weighted field names the hit — and that rule is
   *  what a second copy of this loop would have been free to drift on. */
  fields: ReadonlyArray<F>,
  weights: Record<F, number>,
): { readonly field: F; readonly score: number } | null => {
  let score = -1
  let field: F | null = null
  let weight = -1
  for (const name of fields) {
    for (const haystack of hay[name]) {
      const bonus = positionBonus(haystack, word)
      if (bonus === -1) continue
      const value = weights[name] + bonus
      if (value > score) score = value
      if (weights[name] > weight) {
        weight = weights[name]
        field = name
      }
    }
  }
  return field === null ? null : { field, score }
}

// ── where the words landed ─────────────────────────────────────────────

/**
 * The WORDS a query looks for, folded — what a page lights up.
 *
 * The matcher answers whether a node holds them and {@link Match} answers
 * which field carried it; neither says WHERE, because neither has ever needed
 * to. A row does: a filtered page that draws a title without saying which part
 * of it the query landed on leaves the reader to guess why it is in front of
 * them, and guessing is what the highlight exists to end.
 *
 * ALREADY FOLDED, because {@link tokensOf} folds a token as it reads it — so
 * these are the same strings {@link wordHit} looks for, never a second
 * spelling of the reader's text. That is the whole reason this is here rather
 * than in the browser: an offset found under some other case rule would light
 * up a stretch of title the matcher never looked at.
 *
 * NEGATED WORDS ARE LEFT OUT, for {@link Match.props}' reason one field along:
 * a node kept by `-walnut` is not here BECAUSE of walnut, and lighting the one
 * place the query said it did not want would be the row drawing a lie. So are
 * the clauses — `is:done` selects on a mark, and a mark is not text in a title.
 *
 * DEDUPED: `pick pick` is one needle, and two would walk the same text twice
 * for the same answer. The ORDER is the groups' — {@link inCostOrder}'s
 * evaluation order rather than the reader's — and deliberately not fixed:
 * {@link litBy} merges what it finds and a highlight is the same picture
 * whichever word landed first, so a second list carried on {@link Filter} (the
 * shape `namedProps` takes, for a question asked once per selected NODE) would
 * be state to keep in step for an order nothing can see. This is asked once per
 * QUERY.
 */
export const needlesOf = (filter: Filter): ReadonlyArray<string> => {
  if (filter.kind !== "asking") return []
  const words: Array<string> = []
  for (const group of filter.groups) {
    for (const one of group) {
      if (one.kind !== "term" || one.negated || one.word === "") continue
      if (!words.includes(one.word)) words.push(one.word)
    }
  }
  return words
}

/** The words a raw query string lights — {@link parseFilter} then
 *  {@link needlesOf}, so two doors that hold a box cannot disagree about
 *  which needles a title receives. */
export const needlesFrom = (text: string, now: string): ReadonlyArray<string> =>
  needlesOf(parseFilter(text, now))

/**
 * WHAT AN INDEX MAY NARROW BY — the query read as a conjunction of
 * alternatives, WORDS ONLY, or `null` when nothing in it can narrow anything.
 *
 * {@link needlesOf} next door is the other reading of the same groups and they
 * must not be confused: that one flattens every word a query lights, because a
 * highlight is a picture and the shape it came from does not matter. This one
 * KEEPS THE SHAPE, because an index that intersected the flattened list would
 * answer `chen OR remo` with the records holding both — which is the one way a
 * narrowing can be WRONG rather than merely wide.
 *
 * A GROUP IS DROPPED WHOLE unless every alternative in it is a positive word
 * the caller can look up, and the rule follows from the same asymmetry
 * {@link hayOf} states. A group that survives is a promise: every record the
 * query can select holds one of these words, so intersecting them can only
 * throw away records that were never going to match. A group holding a CLAUSE
 * (`is:todo OR kitchen`) promises nothing about text; a NEGATED word promises
 * the opposite; a word the caller cannot look up is a word it would find
 * nothing for. Any of the three and the group narrows nothing — so it is left
 * out, the surviving groups still narrow, and a query with no survivor at all
 * is `null`: ask the corpus, which is what every query cost before this.
 *
 * WHICH WORDS THOSE ARE IS THE CALLER'S QUESTION, and it is a predicate rather
 * than a length because every reason a word cannot be looked up is a fact about
 * an ENGINE and none of them is a fact about this grammar: a trigram table
 * cannot answer a needle of two characters, and the one olai uses cannot be
 * asked about a needle carrying a `NUL` or half a surrogate pair at all
 * (`@olai/index` spells its own list and says why). A grammar that knew any of
 * that would be a grammar with a storage engine in it, and the next engine
 * would have to be argued with this file rather than with its own.
 */
export const narrowableBy = (
  filter: Filter,
  lookupable: (word: string) => boolean,
): ReadonlyArray<ReadonlyArray<string>> | null => {
  if (filter.kind !== "asking") return null
  const groups: Array<ReadonlyArray<string>> = []
  for (const group of filter.groups) {
    const words: Array<string> = []
    for (const one of group) {
      if (one.kind !== "term" || one.negated || !lookupable(one.word)) {
        words.length = 0
        break
      }
      words.push(one.word)
    }
    if (words.length > 0) groups.push(words)
  }
  return groups.length === 0 ? null : groups
}

/** One run of a text a needle landed on — half-open, in the text's OWN
 *  offsets, so a caller slices the string it handed in. */
export interface Lit {
  readonly at: number
  readonly end: number
}

/**
 * Every place one of those needles lands in a piece of text — the fold's
 * answer, mapped back onto what was written.
 *
 * ONE FOLD, {@link foldOf}'s: `toLowerCase`, whole-string, exactly as the four
 * haystacks are folded. A case-insensitive regex or a locale compare here
 * would be a second opinion about what "matches" means, and where it would
 * show is a title lit up in a place the query never looked — worse than no
 * highlight at all, because it is the row explaining itself wrongly.
 *
 * OVERLAPS ARE MERGED, because two needles landing on the same word are one
 * stretch of ink and not two — `pick "pick the"` would otherwise light `pick`
 * twice, nested, and every caller would have to undo it.
 *
 * FOLDING CAN CHANGE A LENGTH (`İ` lowercases to two units), so an offset in
 * the fold is not always an offset in the source. Every ASCII title there is —
 * which is nearly every title there is — has the two agreeing, and that case
 * is the whole of the fast arm; the other is {@link sourceOffsets}.
 */
export const litBy = (
  text: string,
  needles: ReadonlyArray<string>,
): ReadonlyArray<Lit> => {
  if (needles.length === 0 || text === "") return []
  const fold = text.toLowerCase()
  const found: Array<Lit> = []
  for (const needle of needles) {
    let at = fold.indexOf(needle)
    while (at !== -1) {
      found.push({ at, end: at + needle.length })
      at = fold.indexOf(needle, at + 1)
    }
  }
  if (found.length === 0) return []
  // Earliest first, and the longest of two that start together — which is what
  // makes the merge below one pass rather than a search.
  found.sort((one, other) => one.at - other.at || other.end - one.end)
  const merged: Array<Lit> = []
  for (const one of found) {
    const last = merged[merged.length - 1]
    if (last === undefined || one.at > last.end) {
      merged.push(one)
      continue
    }
    if (one.end > last.end) merged[merged.length - 1] = { at: last.at, end: one.end }
  }
  return fold.length === text.length ? merged : sourceOffsets(merged, text, fold)
}

/**
 * The same runs in the SOURCE's offsets, for a string whose fold is a
 * different length from it.
 *
 * Walked rather than computed, because there is no arithmetic to do: each
 * character of the source contributes however many units its own fold has, and
 * the running total of those IS the map. The guard is the last line — a total
 * that does not agree with the whole-string fold means the two are not the
 * same operation on this string, and the honest answer to that is no highlight
 * rather than one placed by a map nothing stands behind.
 *
 * A RUN IS ROUNDED OUT TO WHOLE SOURCE CHARACTERS, and that is the half a
 * naive map gets wrong. `İ` folds to `i` plus a combining dot, so `i` is a
 * real matcher hit covering the FIRST of that character's two fold units — and
 * a map that sent both ends to the character's start would answer with an
 * empty span, which the view draws as a highlight of nothing where the reader
 * can plainly see the letter they typed (grok, #240). There is no half a
 * character to light: a run that reaches into a character lights the whole of
 * it. So the two ends are read off two different tables — `opens` for where a
 * unit's character STARTS, `closes` for where it ENDS — and an empty run
 * becomes unrepresentable rather than filtered downstream, since every needle
 * has at least one unit and every character is at least one unit wide.
 */
const sourceOffsets = (
  runs: ReadonlyArray<Lit>,
  text: string,
  fold: string,
): ReadonlyArray<Lit> => {
  // One entry per FOLDED unit: where the character that produced it starts in
  // the text, and where it ends. Two tables rather than one plus arithmetic,
  // because the widths are the source's and the index is the fold's.
  const opens: Array<number> = []
  const closes: Array<number> = []
  let at = 0
  for (const character of text) {
    const width = character.toLowerCase().length
    for (let unit = 0; unit < width; unit++) {
      opens.push(at)
      closes.push(at + character.length)
    }
    at += character.length
  }
  if (opens.length !== fold.length) return []
  return runs.map((run) => ({
    at: opens[run.at] as number,
    // The character the LAST covered unit belongs to, ended — never the next
    // run's start, which is what would clip a partly-covered character to
    // nothing.
    end: closes[run.end - 1] as number,
  }))
}

/**
 * What `is:` asks of one node — a SWITCH over the value's own type, for the
 * reason {@link clauseOf} is one: four of these seven are answered by four
 * different things, and the chain of `if`s this replaced ended in a comparison
 * against the stored mark. So a value added to {@link IS_VALUES} that is not a
 * mark fell through to `mark === "whatever"` and quietly selected nothing —
 * the silent empty answer this file's whole refusal arm exists to prevent,
 * arriving by a path no refusal can see. Now it is a compile error here, which
 * is the second place (with {@link teaching}) a new value has to say something.
 */
const being = (derived: Derived, at: LocatedRegular, value: IsValue): boolean => {
  switch (value) {
    case "trashed":
      return isTrashed(at.file)
    // THE ONE DERIVED VALUE, and it is the index the views draw from rather
    // than a second reading of `after`: the same answer that puts the `blocked
    // by` line on a node's page and the dim on a row, so a query cannot find a
    // node the app does not draw as waiting, or miss one it does. What
    // blockedness IS — which targets stand in the way, and which sources can
    // be said to be waiting at all — is `./derive.ts`'s `blockage` and is not
    // restated here. Including the part nobody has to pay for: the derivation
    // is of the whole SET, so this reaches across files exactly as the screen
    // does.
    case "blocked":
      return isBlocked(derived, at.node.id)
    // THE SECOND DERIVED VALUE, and the one place this grammar can ask about a
    // MIRROR at all. A placement is never a hit ({@link matching}) — it is a
    // second view of a node, so answering with one would be the same node
    // twice, once at a place no write lands — which left the format's one
    // remaining record field unreadable from here in both directions. This is
    // the direction that has a subject: not "is this record a placement" but
    // "is this NODE drawn somewhere else", which is what a curated list puts on
    // a node and what `read_node` already answers as `mirrors`. The index is
    // the same one, so a query cannot find a placement that read does not
    // report, or miss one it does.
    case "mirrored":
      return isMirrored(derived, at.node.id)
    case "marked":
      return storedMarker(at.node) !== undefined
    // The STORED mark, never a derived one: a parent whose children are all
    // ticked is not `is:done` unless somebody ticked it (docs/format.md's
    // Status, and the `not-every-node-a-task` ruling behind it). `cancelled`
    // is read exactly here and nowhere special — it is a mark like the other
    // three at this door, and what makes it different (it SETTLES) is a
    // question `is:blocked` above asks, not one `is:` asks about the record.
    case "done":
    case "cancelled":
    case "doing":
    case "todo":
      return storedMarker(at.node) === value
  }
}

const holds = (derived: Derived, at: LocatedRegular, clause: Clause): boolean => {
  if (clause.kind === "is") return being(derived, at, clause.value)
  if (clause.kind === "has") return carries(at.node, clause.field)
  if (clause.kind === "prop") return propKeyOf(customOf(at.node), clause) !== null
  // Every day question of every spelling arrives here, `has:date` included —
  // {@link hasClause} made it an unbounded span at the parse — which is what
  // keeps a reader from meeting two answers to one word. The per-RECORD rule,
  // and pointedly not the walk above it, which is where the archive comes out:
  // a day clause answers about a node wherever it was filed, and that is what
  // makes `is:trashed date:2026-08-11` a question with an answer
  // (docs/search.md).
  return dayWithin(at.node, clause)
}

/**
 * DOES ANY DATE THIS RECORD OFFERS UNDER `clause.of` FALL INSIDE THE SPAN —
 * the one place a record is read as dates, and the only question anything asks
 * of it.
 *
 * DATES rather than days since durations arrived, and the widening is the
 * whole of what this function gave up: it used to cut every value to the ten
 * characters of a day before comparing, which is a decision about PRECISION
 * taken by the reader of a value rather than by the bound it is being tested
 * against. The values are handed over whole now and {@link within} reads as
 * much of each as its bound is wide, so a `date:` holding a bare day and one
 * holding a done-instant are the same comparison at two natural precisions
 * rather than one comparison with the seconds thrown away.
 *
 * A PREDICATE RATHER THAN A LIST OF DAYS, which is what it was for one commit
 * and never needed to be. Nothing wants the days: the clause wants a yes or a
 * no, and a list is a pair of allocations per node per clause on the way to
 * one — over every node of the directory, on every keystroke of the filter
 * box. There is no intermediate here because nothing was ever going to read it.
 *
 * AN UNBOUNDED SPAN IS WHAT `has:` ASKS, and it is the same clause shape rather
 * than a second reading written beside it: `null` on both ends cannot exclude a
 * day, so `has:created` reaches here as `created:` with the bounds left off
 * ({@link hasClause}). A grammar cannot spell that span — `created:..` is
 * refused, for the reason an empty needle is — but the shape it would mean is
 * exactly this, and it is the shape the two rows are.
 *
 * ...AND IT IS ANSWERED WITHOUT READING A DAY, which is the one specialisation
 * inside here. If neither end can exclude anything then the whole question is
 * whether the record offers a day at all, and that is a length and a presence —
 * where the general path is a closure, a ten-character slice and two
 * comparisons, per node, per clause, over a directory, on every keystroke.
 * INSIDE this function rather than beside it, and that is the point: it is the
 * same call on the same clause, so the identity above survives. A second
 * function for the unbounded reading is the pair that could come to disagree,
 * which is the thing `has:date` was made an unbounded `date:` to prevent.
 *
 * A SWITCH, and the arms name their fields OUTRIGHT rather than reaching
 * `node[of]`. Both halves of that are the guarantee {@link DAY_READINGS}
 * claims. The switch is what makes a fourth reading a compile error HERE, at
 * the one place that decides what a name MEANS — it was an `if (of === "date")
 * … else node[of]`, so a fourth name compiled, sailed past the other readers
 * and was read as a stamp off whatever record field happened to share its
 * spelling, which is exactly the fallthrough {@link being}'s docstring says a
 * switch exists to prevent. And naming the field is what makes the compiler
 * check the access at the site that performs it, which is what a `satisfies`
 * on the list was standing in for: that one constrained `date` to be a key of
 * the record, a coincidence of spelling this reading does not depend on since
 * it goes through `datesOf`, and left `doc` and `desc` free to be read as
 * stamps.
 *
 * `date` is ./dates.ts's `datesOf`, which is the same two the JOURNAL reads:
 * what the node is scheduled for, and when it was finished. A filter that
 * disagreed with the day page about what a date means would be a third answer
 * to a question that already has one.
 *
 * The two STAMPS are the record's own fields, handed over WHOLE — one moment
 * or none, never two, since a record carries at most one of each. They are
 * compared as TEXT like every other date in this package, and how much of the
 * text is read is the BOUND's to say ({@link within}): a day bound reads the
 * ten characters in front of the `T`, which are the day the person writing it
 * was having, and a duration's bound reads the clock face as well. Cutting to
 * the day here — which is what this did while a bound could only be a day —
 * would have thrown away the precision the stamps were always carrying, which
 * is the precision durations were added to reach.
 *
 * ABSENCE OFFERS NO DAY, and that is the whole of the honesty rule the two
 * stamp operators are held to. A node written before the stamps existed
 * carries no `created`, and nothing here invents one: there is no day for a
 * bound to hold of, so `created:2026` does not find it, and neither does the
 * widest span anybody can type. What FINDS it is the negation —
 * `-created:2026` — for the reason that finds a node with no date at all
 * under `-has:date`: the dash negates the CLAUSE, and a clause that cannot
 * hold of a record it has nothing to read is false. Which is the honest
 * reading and is worth saying out loud, because "not created in 2026" and "not
 * known to have been created in 2026" are the same rows and are not the same
 * sentence. docs/search.md says it in those words.
 */
const dayWithin = (node: RegularNode, clause: DaysClause): boolean => {
  switch (clause.of) {
    case "date": {
      const dates = datesOf(node)
      return unbounded(clause)
        ? dates.length > 0
        : dates.some(({ date }) => within(date, clause))
    }
    case "created":
      return stampWithin(node.created, clause)
    case "changed":
      return stampWithin(node.changed, clause)
  }
}

/**
 * One stamp against the span — the two arms above, which differ only in which
 * field they hand over.
 *
 * ABSENT is the WRITER's rule and not a narrower one of this file's
 * ({@link nothing}, ./write.ts), exactly as {@link carries} asks it for every
 * other `has:` row. The four ways a field can hold nothing all say the same
 * thing about the node, so a `created` holding the empty string is a stamp the
 * file does not carry — here as there. Answering on `undefined` alone would
 * have made `has:created` true for a record `has:desc` calls empty, which is
 * the two-answers-to-one-word this grammar keeps refusing.
 */
const stampWithin = (stamp: string | undefined, clause: DaysClause): boolean =>
  stamp !== undefined && !nothing(stamp) &&
  (unbounded(clause) || within(stamp, clause))

/** Neither end can exclude a day — the `has:` form, and what makes the cheap
 *  arms above correct rather than a shortcut. */
const unbounded = (clause: DaysClause): boolean =>
  clause.from === null && clause.to === null

/**
 * Does this MAP carry the property the clause names — and under WHICH of its
 * own spellings? `null` for one that does not.
 *
 * A KEY RATHER THAN A BOOLEAN because two callers want two different halves of
 * one scan: {@link holds} asks only whether, and {@link propsOf} needs the key
 * the thing actually wrote so a reader can look it up in the map the hit
 * carries. Answering the second from a second scan would be this file holding
 * two definitions of "does `prop:PR` match a key written `pr`", which is the
 * one thing the folding rule below must not have.
 *
 * THE MAP AND NOT WHAT CARRIES IT, which is what let a DOCUMENT answer this
 * operator without a second copy of any of it: a record's open field is its
 * `custom` and a `.md`'s is its frontmatter (`./frontmatter.ts`), and once
 * both are a `Custom` there is one definition of what `prop:` means for the
 * whole set. Taking a `RegularNode` was the shape that made "documents select
 * nothing" a fact about this function rather than a ruling.
 *
 * FOLDED on both halves, key and value, which is this grammar's rule rather
 * than a new one: the tokenizer folds every token, `#Home` finds `#home`, and a
 * reader who typed `prop:PR` is asking about the same fact as one who typed
 * `prop:pr`. A property is something somebody typed into a map that gives no
 * key a spelling, so case is exactly the kind of difference a search must not
 * be sensitive to.
 *
 * THE KEYS ARE SCANNED rather than looked up, which is what folding costs and
 * what it buys: `custom["pr"]` would find one spelling of the key and miss the
 * other, and the map is a handful of entries on the nodes that have any.
 *
 * A LIST value matches on any member — a fact can be several, and the whole
 * list as one string has no spelling a person would type.
 */
const propKeyOf = (
  props: Custom,
  clause: Extract<Clause, { kind: "prop" }>,
): string | null => {
  for (const [key, value] of Object.entries(props)) {
    if (key.toLowerCase() !== clause.key) continue
    // A key holding NOTHING is a key the file does not carry (./write.ts), so
    // `prop:x` is false for it — the same rule `has:` reads, one map in.
    if (nothing(value)) continue
    const held = typeof value === "string" ? [value] : value
    // A SPAN reads the value UNFOLDED, which is the one place this function's
    // folding rule stops and has to. A stored date carries a `T` and may carry
    // a `Z` (`./stamp.ts`), and its bounds do not — so folding the value would
    // compare `2026-08-25t10:06:00z` against `2026-08-25`, which is a different
    // string ordering and answers a different question. Case is a difference a
    // search must not be sensitive to in something somebody TYPED; a canonical
    // date is not that.
    if (clause.span !== undefined) {
      if (held.some((one) => inSpan(clause.span as PropSpan, one))) return key
      continue
    }
    if (clause.value === null) return key
    if (held.some((one) => one.toLowerCase() === clause.value)) return key
  }
  return null
}

/**
 * Is one stored value inside the span the clause asks for?
 *
 * TWO COMPARISONS FOR TWO KINDS, which is the whole of what the declaration
 * bought. A date is compared as TEXT with {@link within}'s own reading, so the
 * bounds a `created:` mints and the bounds a `prop:dispatched=` mints are read
 * by one function; a whole number is compared as a NUMBER, because `9..10`
 * answering `100` is exactly the lie a string comparison tells about digits.
 *
 * A VALUE THAT IS NOT OF THE KIND IS SIMPLY NOT IN THE SPAN — never an error
 * here. The write gate and the validator are what keep a declared key's values
 * canonical ({@link ../typing.ts}); by the time a query is asked, a value that
 * is not a number under an `int` key is a value in a file somebody is already
 * being told to fix, and a search is not the second place to tell them.
 */
const inSpan = (span: PropSpan, value: string): boolean => {
  if (span.of === "int") {
    if (!isDigitRun(value)) return false
    const held = Number(value)
    return (span.from === null || held >= span.from) && (span.to === null || held <= span.to)
  }
  return spanned(value, span.from, span.to)
}

/** Whether a record carries a field — the WRITER's own rule for absence
 *  (./write.ts's `nothing`), asked as a question rather than restated. The four
 *  ways a field can hold nothing (`undefined`, `null`, `[]`, `""`) all say the
 *  same thing about the node, and a second list of them here is how `desc: ""`
 *  becomes a note to search for and no note to write. */
const carries = (node: RegularNode, field: CarriedField): boolean =>
  !nothing(node[field])

/**
 * Is this date inside the span? `null` on an end is no bound that way. Over the
 * CLAUSE, which is {@link propKeyOf}'s shape next door: it took the two bounds
 * loose for one commit, while `has:` was answered at the gate with no clause
 * behind it to pass — and {@link hasClause} mints one now.
 *
 * EACH BOUND COMPARES AT ITS OWN WIDTH, and that one rule is the whole of what
 * durations cost the matcher. A bound minted from a day, a month, a year or a
 * relative word is ten characters, so what it decides is the day the value
 * falls on — which is the `dayOf` this function was handed for its first year,
 * generalised rather than special-cased. A bound minted from a duration is a
 * MOMENT, so the same comparison reaches the clock face.
 *
 * AND IT CUTS NOTHING, which is what makes that generalisation free. ISO text
 * is a PREFIX ORDERING — every field is fixed-width and ordered most
 * significant first — so for a bound `n` characters wide and the value's own
 * first `n` characters `P`:
 *
 *   - `P >= bound` is exactly `date >= bound`. If `P` differs from `bound` the
 *     two strings already differ inside those `n` characters and the rest
 *     cannot speak; if `P` equals `bound` then `date` is `bound` with more
 *     after it, which is greater or equal either way.
 *   - `P <= bound` is `date <= bound` OR `date` STARTS WITH `bound` — the one
 *     case the shorter string loses, where the value is on the bound's own
 *     moment and carries seconds past it.
 *
 * So the slice this took for one commit — per bound, per node, per clause,
 * over a directory, on every keystroke of a filter box — was buying a
 * comparison the comparison already made. `startsWith` allocates nothing
 * either, so this is cheaper than the single `dayOf` cut that stood here
 * before durations existed. ./filter.bench.ts's `dated` arm is the number and
 * exists because this line had none: it was added with the durations, and it
 * is what a reader should re-run rather than believe.
 *
 * WHICH IS WHY DAY-GRANULAR VALUES COMPARE AT THEIR OWN PRECISION rather than
 * being special-cased into one: a `date:` field holding the bare day
 * `2026-08-13` sorts BEFORE every moment on the 13th, because a shorter string
 * is the lesser one and that is exactly what "the start of the day" means. So
 * `date:1h` selects done-instants inside the hour and no bare-day plans on the
 * day it is — the fact the ruling asked to be stated rather than engineered
 * away (docs/search.md).
 *
 * COMPARED AS TEXT, which for two moments is a WALL-CLOCK comparison and not an
 * absolute one: a stamp carries the offset the machine writing it was standing
 * at, and so does the bound, and this reads the faces rather than the instants
 * behind them. Where the two offsets agree — one person, one machine, which is
 * the directory this format serves — the readings are the same. Where they do
 * not, a duration is off by the difference: the hour after a zone puts its
 * clocks back, and a stamp written under another offset entirely. The price of
 * the alternative is a zone database in the floor of this package
 * (./calendar.ts's header), and the day-width comparison this generalises has
 * always been the same trade.
 *
 * The SEPARATOR is the other edge of that: a datetime somebody hand-wrote with
 * a space where this format's own writer puts a `T` is legal on disk
 * (./parse.ts) and sorts before every `T` on its day, so it reads as the start
 * of that day. Which is the same answer a bare day gets, and the honest one for
 * a value that named no instant this package minted.
 *
 * AND THE SALVAGE ABOVE HAS A LIMIT, which the algebra does not state because
 * the algebra is about STRINGS and this is about what the strings mean. "Extra
 * precision is a suffix" holds for text APPENDED past the bound's own last
 * character — a stamp's seconds under a day bound, an offset under a bound
 * without one. Two shapes `isIsoInstant` allows put it somewhere else, and a
 * value of either sitting EXACTLY on a bound falls outside it:
 *
 *   - a FRACTION, which lands before the offset rather than after everything
 *     (`…T10:00:00.000-04:00` does not start with `…T10:00:00-04:00`, so it is
 *     outside an upper bound at its own instant);
 *   - SECONDS OMITTED, which makes the value SHORTER than the bound at the
 *     same instant (`…T10:00-04:00` sorts before `…T10:00:00-04:00`, so it is
 *     outside a lower bound at its own instant).
 *
 * NEITHER IS WRITTEN BY THIS PACKAGE. `./stamp.ts` mints `T`, seconds and a
 * numeric offset and no fraction, so every stamp, every `done`, and every bound
 * ./calendar.ts hands back is the shape the salvage covers; both cases need a
 * value typed into a file by hand AND landing on the bound's exact instant.
 * Named rather than fixed, because fixing it means normalising every value
 * before comparing it — a parse per node per clause, to answer a question about
 * values this format does not produce. Found by grok reviewing #328, where the
 * paragraph above claimed more than it delivered.
 */
const within = (date: string, clause: DaysClause): boolean =>
  spanned(date, clause.from, clause.to)

/** The same reading over two loose bounds, for the second caller that has no
 *  `DaysClause` to hand: a `date`-typed PROPERTY ({@link inSpan}). One
 *  function, because "is this stored date text inside these two bounds" must
 *  not have two answers — the salvage below in particular, which is the kind of
 *  clause a second copy would be written without. */
const spanned = (date: string, from: string | null, to: string | null): boolean =>
  (from === null || date >= from) &&
  (to === null ||
    date <= to ||
    // The value is ON the bound's own moment and carries more after it — the
    // one case where being the longer string must not put it outside.
    date.startsWith(to))

/**
 * Every node in the SET that the query selects, in the set's own
 * file-then-line order — the door for a caller searching the DIRECTORY.
 *
 * TWO LINES over {@link selecting}, and they are the two this door adds: the
 * candidates are the corner of the set a {@link Scope} names, and what was put
 * away is decided from the question — the query named the archive ({@link
 * Filter} `speaksOfTrash`), or the caller said its scope already holds it
 * ({@link Scope.trashed}). One boolean per call, read before the walk.
 *
 * A NARROWED QUERY WALKS THE NARROWING, which is what a scope always meant and
 * what it now costs: `file:` reads one file's records and `under:` descends one
 * subtree, rather than reading the corpus and throwing the rest away
 * ({@link inScopeOf}).
 *
 * MIRRORS ARE NOT HERE, for the reason nothing in the query layer answers with
 * one: a mirror is a second PLACEMENT of a node, so a hit for it would be the
 * same node twice, once at a place no write lands. What a filtered TREE does
 * with a placement is a different question, and {@link keeping} answers it.
 *
 * A PAGE narrowing itself is the other caller and does not come through here:
 * it holds the records it draws and hands them to {@link selecting} directly
 * (`./narrowing.ts`).
 *
 * `named` IS AN INDEX'S ANSWER, and it is the whole of what one is allowed to
 * say: ids that MIGHT match, in any order and with anything extra in them, from
 * whatever narrowed the search (`@olai/index`). What comes back is the same
 * list this door has always answered with — the ids are resolved through the
 * set's own `byId`, put in the set's own order and run through the same
 * {@link selecting} the corpus walk is — so an index can make this door FASTER
 * and cannot make it say anything different. An id nothing declares, a mirror,
 * a record outside the scope and a record the query does not actually select
 * all fall out here, which is why over-inclusion is the only failure an index
 * is permitted (see {@link hayOf}). Omitted is the corpus, which is what every
 * caller meant before there was an index and what one still means when the
 * grammar gives it nothing to narrow by ({@link narrowableBy}).
 */
export const matching = (
  derived: Derived,
  filter: Filter,
  scope: Scope = {},
  named?: Iterable<string>,
): ReadonlyArray<Matched> => [
  ...selecting(
    derived,
    filter,
    named === undefined ? inScopeOf(derived, scope) : namedInScope(derived, scope, named),
    scope.trashed === true || (filter.kind === "asking" && filter.speaksOfTrash),
  ),
]

/**
 * The set's own regular records, in file-then-line order, narrowed to a scope
 * — {@link matching}'s candidates, and the whole of what it holds over
 * {@link selecting}.
 *
 * WHAT A SCOPE NARROWS IS THE WALK, which is the whole of this function and was
 * not true until `perf-filter-scope`. A scope used to be a PREDICATE run over
 * `derived.nodes`: a query scoped to one outline read every record in the
 * directory to throw all but one file's away, and an `under:` read every record
 * AND walked the ancestry of each ({@link scoping}), so narrowing a search cost
 * strictly more than not narrowing it. Both scopes name a corner the derivation
 * already holds an index of, so both are a reading of one:
 *
 *   - `file:` is {@link Derived.byFile}, which is that map's whole purpose —
 *     one file's records, in the order they are on disk, which inside one file
 *     IS corpus order;
 *   - `under:` is {@link Derived.children} DESCENDED from the named node
 *     ({@link descendedFrom}), which is the same set the ancestor walk decided
 *     one node at a time, read the one way that costs the subtree rather than
 *     the vault.
 *
 * The answer is the same SET in the same ORDER either way, and that is a claim
 * a harness makes rather than this paragraph: `./scope.testlib.ts` keeps the
 * walk this replaced as a reference implementation, and `./scope.test.ts` runs
 * the two against each other over generated corpora and over this repository's
 * own vault.
 *
 * MIRRORS ARE SKIPPED for the reason nothing in the query layer answers with
 * one: a mirror is a second PLACEMENT of a node, so a hit for it would be the
 * same node twice, once at a place no write lands.
 *
 * IT IS THE OTHER HALF THAT COMPOSES WITH AN INDEX. When something has already
 * narrowed the search to a list of ids (`@olai/index`), this walk is not run at
 * all and {@link namedInScope} tests those candidates instead — see the note
 * there for why the scope stays a predicate on that side.
 */
const inScopeOf = (derived: Derived, scope: Scope): Iterable<LocatedRegular> => {
  const { file, under } = scope
  if (under !== undefined) return descendedFrom(derived, under, file)
  if (file !== undefined) return regularsIn(derived.byFile.get(file) ?? [])
  return regularsIn(derived.nodes)
}

/** The records of a corpus reading that are not placements — the one line both
 *  candidate walks here share, spelled once so the two cannot come to disagree
 *  about what a candidate IS. A GENERATOR: nothing is copied, and the caller
 *  that was handed the whole corpus allocates nothing at all. */
function* regularsIn(records: ReadonlyArray<Located>): Generator<LocatedRegular> {
  for (const located of records) {
    if (isMirror(located.node)) continue
    yield located as LocatedRegular
  }
}

/**
 * EVERYTHING AT OR UNDER A NODE, in corpus order — `under:`, answered by
 * descending {@link Derived.children} rather than by asking every record in the
 * directory who its ancestors are.
 *
 * IT IS {@link ancestorsOf} READ BACKWARDS, and it has to be exactly that: a
 * record is in an `under:` scope when its canonical parent chain reaches the
 * named node, so that walk's own stopping rules are what this one inherits
 * rather than re-decides.
 *
 *   - A MIRROR IS NOT DESCENDED THROUGH, which is the trap this function exists
 *     not to fall into. `ancestorsOf` STOPS at a parent that is a placement — a
 *     set the validator has already condemned, where walking on would put a
 *     node in a scope the `path` on its own hit says it is not in — so a record
 *     written beneath a mirror is under NOTHING above that mirror, and a
 *     descent that recursed into a placement's children would admit records the
 *     walk it replaces never did. The placement itself is not yielded either,
 *     for {@link inScopeOf}'s reason.
 *   - A ROOT THAT IS A PLACEMENT, or that nothing claims, names an EMPTY corner
 *     rather than the subtree it points at. That is those same two rules read
 *     at the top: the ancestor walk stops at it, so nothing beneath it is in
 *     scope, and the record itself is a mirror the query layer never answers
 *     with — or is not there at all.
 *   - CYCLE-SAFE by the same guard from the other end. A parent loop is a set
 *     the validator rejects, and both walks are drawn over sets its own error
 *     messages describe: `ancestorsOf` stops when the chain repeats an id it
 *     has already seen, and this stops when the descent reaches one — which
 *     admits exactly the same records, because a chain that closes puts every
 *     member of the loop above every other one.
 *
 * A RECORD NAMES AN ID and an id names one record, which is {@link
 * Derived.byId}'s rule and the one thing here that is not a walk of an index: a
 * set where two records claim one id is a set the validator REFUSES, so nothing
 * is ever published at one. It is the same rule {@link namedInScope} already
 * stands on, and it is asserted of every corpus the harness generates, so a
 * divergence found there is a divergence in this walk rather than in a fixture.
 *
 * SORTED, because a descent arrives in tree order and the answer this door
 * promises is the SET'S own — {@link byCorpus}, the comparator every reverse
 * index in `./derive.ts` promises its members in, and what the walk over
 * `derived.nodes` used to give for free. The cost is the corner's size and not
 * the corpus's, which is the entire point of having descended.
 *
 * A `file:` BESIDE IT is applied here rather than composed outside, because the
 * two are a CONJUNCTION and the subtree is the cheaper half to start from:
 * `parent` is same-file placement by the format, so a subtree is nearly always
 * one file's records already, and the rest is a string comparison per record of
 * it rather than a second index reading.
 */
const descendedFrom = (
  derived: Derived,
  under: string,
  file: string | undefined,
): ReadonlyArray<LocatedRegular> => {
  const root = derived.byId.get(under)
  if (root === undefined || isMirror(root.node)) return []
  // At OR under: "everything beneath `install`" includes `install`, which is
  // what a reader filtering a zoomed page is looking at.
  const found: Array<LocatedRegular> = [root as LocatedRegular]
  const seen = new Set<string>([under])
  const descending: Array<string> = [under]
  while (descending.length > 0) {
    for (const child of derived.children.get(descending.pop() as string) ?? []) {
      if (isMirror(child.node)) continue
      if (seen.has(child.node.id)) continue
      seen.add(child.node.id)
      found.push(child as LocatedRegular)
      descending.push(child.node.id)
    }
  }
  const own = file === undefined ? found : found.filter((at) => at.file === file)
  return own.sort(byCorpus)
}

/**
 * The same candidates, off a list of IDS instead of off the corpus — the other
 * half of what {@link matching} adds to {@link selecting} once something has
 * narrowed the search.
 *
 * SORTED, and that is the line that matters rather than the lookup. What ties
 * are broken by, one layer up, is the set's own order: {@link ranked} sorts by
 * score with a STABLE sort, so two equally-scored hits come back in the order
 * they were handed over, and a door that showed them in whatever order an index
 * happened to return would move rows under the cursor between two keystrokes
 * that scored the same. `byCorpus` is the format's own answer to what that
 * order is — the same comparator every reverse index in `./derive.ts` promises
 * its members in — so the answer is the corpus walk's answer and not merely one
 * with the same members in it.
 *
 * It is a LIST and not a generator, which is what a sort makes it; the walk it
 * replaces stays lazy. The cost is the answer's size rather than the corpus's,
 * which is the entire point of having been handed candidates.
 *
 * AN ID NAMES ONE RECORD, and that is `byId`'s rule rather than an assumption
 * made here: the first claim wins, which is the same reading every reference in
 * the format resolves through. A set where two records claim one id is a set
 * the validator REFUSES, so nothing is ever published at one and no door
 * reaches this with one — which is worth saying out loud, because that is the
 * single corpus where a candidate list and the corpus walk could differ: the
 * walk would yield both records and a list of ids can only name one.
 */
const namedInScope = (
  derived: Derived,
  scope: Scope,
  named: Iterable<string>,
): ReadonlyArray<LocatedRegular> => {
  const inScope = scoping(derived, scope)
  const found: Array<LocatedRegular> = []
  for (const id of named) {
    const located = derived.byId.get(id)
    if (located === undefined || isMirror(located.node)) continue
    const at = located as LocatedRegular
    if (!inScope(at)) continue
    found.push(at)
  }
  return found.sort(byCorpus)
}

/**
 * THE SELECTION ITSELF, over candidates the CALLER holds — the half of
 * {@link matching} that is about what a query means rather than about where to
 * look for it.
 *
 * It exists because there are two kinds of caller and only one of them is
 * searching the DIRECTORY. {@link matching} is that one: it is handed the whole
 * set and a corner of it to ask about. The other is a PAGE narrowing itself,
 * which already holds the records it draws — mirrors resolved, ancestry walked,
 * every arm of the reading decided — and for which a walk of the corpus is a
 * walk of everything the answer will be thrown away for
 * (docs/brainstorming/filter-rides-the-page.md). That caller hands its own rows
 * in (`./narrowing.ts`), and what it gets is this same `matchOf` behind this
 * same grammar, so the two cannot mean different things by `is:done`.
 *
 * WHAT WAS PUT AWAY is the caller's answer rather than a rule here, for the
 * reason {@link Scope.trashed} gives: whether the archive is in this corner of
 * the set at all is a fact about the QUESTION — the query named it, or the
 * caller's own scope already holds it. One boolean per call, read before the
 * walk.
 *
 * A LEFTOVER `Archive.olai` is orphaned from every query, including
 * `is:trashed`: it is not trash, and it is not live work either. The file's own
 * page still draws unfiltered; a query does not re-enter it.
 *
 * DUPLICATES ARE THE CALLER'S, not this walk's: `derived.nodes` names each
 * record once, and a page that draws one node twice is a caller with an answer
 * about that (`./narrowing.ts` dedupes because a placement is not a node).
 *
 * A GENERATOR, so a caller that wants a shape of its own builds ONE list rather
 * than materialising this one and mapping it. {@link matching} spreads it,
 * which is the array it always returned; `./narrowing.ts` pushes as it goes.
 *
 * WHAT THE LAYER COSTS was measured rather than assumed, because this walk is
 * the one that is genuinely whole-vault: `filter.bench.ts` over 20,000 nodes
 * reads 7.3–8.3ms a keystroke here, against 7.6–15.3ms for the same bench on
 * the commit before this file grew its two generators. The spread is the
 * machine's and not the change's — which is the honest finding, and the same
 * one `patch.bench.ts` states about its own numbers: the layer is not
 * measurable against run-to-run variance, so it is not a cost this pays.
 */
export function* selecting(
  derived: Derived,
  filter: Filter,
  candidates: Iterable<LocatedRegular>,
  putAway: boolean,
): Generator<Matched> {
  for (const at of candidates) {
    if (isLeftoverArchive(at.file)) continue
    if (!putAway && isTrashed(at.file)) continue
    const match = matchOf(derived, at, filter)
    if (match !== null) yield { at, match }
  }
}

/** A SETTLED node is demoted by about a field's worth: enough to lose a tie,
 *  not enough to disappear. The reason to look for a node you finished is
 *  usually that you finished it, and the reason to look for one you called off
 *  is usually that you called it off — but neither is the thing on your plate,
 *  so both lose to a task that still is. Read off `settles` rather than
 *  compared against `done`, which is the trap the fourth mark walked into
 *  everywhere else in this package. */
const SETTLED_PENALTY = 300

/** Is this node's mark one that ends the wait? The penalty's own question,
 *  asked once per node in the two rankings below rather than once per
 *  comparison — a sort is n log n comparisons and this is n lookups. */
const isSettled = (derived: Pick<Derived, "status">, id: string): boolean => {
  const mark = derived.status.get(id)
  return mark !== undefined && settles(mark)
}

/**
 * The same matches, BEST FIRST — the rest of the score {@link matchOf} started.
 *
 * It reads as presentation and it is not: the penalty below is denominated in
 * {@link FIELD_WEIGHT}'s own units — a finished node loses about a field — so
 * it is a term of one score that happened to be spelled a package away from the
 * table it is measured against. Nothing here is about showing anybody anything;
 * it sorts, and a caller that wants a shortlist takes the first few. Which is
 * why the CAP is not a parameter: a row count is a fact about a door (twelve
 * for `search_nodes`, eight for a completion), and a floor that took one would
 * be inviting the next presentational rule in beside it.
 *
 * It was the ops layer's, and it came down for the reason the matcher itself
 * came down in the filter-in-place change. A browser cannot call a procedure on
 * every keystroke, and a browser that respelled this would be a second opinion
 * about whether a finished node outranks an open one — the ⌘K palette and the
 * chat composer ranking the same words in the same directory differently, which
 * is the exact drift docs/search.md exists to forbid.
 *
 * OVER {@link Matched}, before anything is situated, which is the other half of
 * why this is a function rather than three lines in each caller: the ops layer
 * used to build a whole hit — ancestors and all — for every node a query
 * selected and then keep twelve of them, so a one-word query on a large vault
 * walked the ancestry of thousands of nodes to throw it away. Ranking is a
 * question about a score and a mark; both are in hand before a hit is made.
 *
 * TIES KEEP THE SET'S OWN ORDER, because {@link matching} walks it in
 * file-then-line order and `sort` is stable — so an answer does not move under
 * the cursor between two keystrokes that scored the same. Sorted in a copy:
 * the array a caller passes is the caller's.
 */
export const ranked = (
  derived: Pick<Derived, "status">,
  matched: ReadonlyArray<Matched>,
): ReadonlyArray<Matched> => {
  // The penalty is read ONCE PER NODE rather than once per comparison, which is
  // what a comparator asking the status map would be: a sort is n log n
  // comparisons and this is n lookups.
  const scored = matched.map((one) => ({
    one,
    score: isSettled(derived, one.at.node.id)
      ? one.match.score - SETTLED_PENALTY
      : one.match.score,
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.map((entry) => entry.one)
}

/**
 * The scope, as one predicate — {@link namedInScope}'s answer, and only its.
 *
 * A PREDICATE IS THE RIGHT SHAPE FOR CANDIDATES and the wrong one for a corpus,
 * which is the whole of why there are two spellings of one rule in this file
 * rather than one. Handed a list of ids something else already narrowed
 * (`@olai/index`), what a scope has to do is TEST each of them, and the cost is
 * the list's — a few rows, or at worst the share of the directory the index is
 * willing to hand back. Handed nothing, testing is the wrong verb entirely, and
 * {@link inScopeOf} descends an index instead of asking every record in the
 * vault whether it is in a corner of it.
 *
 * So the two compose rather than fight: the index restricts the search to what
 * might match, this restricts THAT to the corner asked about, and neither ever
 * pays for the whole set. The one thing they must not do is disagree about
 * membership, and that is a suite rather than a sentence: `@olai/index`'s
 * `scope.index.test.ts` runs the same differential this file's other walk is
 * held to (`./scope.testlib.ts`) with the table plugged into it, so every case
 * is asked off a candidate list and off the corpus and compared.
 *
 * `under` is answered by walking UP from each node — `ancestorsOf`, which is
 * this package's one answer to "what is above this node", cycle guard and all.
 * A second walk written here would be a second answer: that one stops at a
 * parent that is missing or is a mirror (a set the validator has already
 * condemned), and one that walked straight through would put a node in a scope
 * the `path` on its own hit says it is not in. {@link descendedFrom} is that
 * same walk read backwards, and its header is where the two are held together.
 */
const scoping = (
  derived: Derived,
  scope: Scope,
): ((at: LocatedRegular) => boolean) => {
  const { file, under } = scope
  if (file === undefined && under === undefined) return () => true
  return (at) => {
    if (file !== undefined && at.file !== file) return false
    if (under === undefined) return true
    // At OR under: "everything beneath `install`" includes `install`, which is
    // what a reader filtering a zoomed page is looking at.
    return at.node.id === under ||
      ancestorsOf(derived, at.node.id).some((crumb) => crumb.node.id === under)
  }
}

// ── what a filtered page looks like ────────────────────────────────────

/**
 * WHAT A QUERY SELECTED, as the one question a prune asks of it.
 *
 * A membership test and nothing else, which is what lets the same walk serve
 * two callers that hold two different values: the tests and the flat pages
 * hand in a `Set` of ids, and the browser's filter hands in the MAP it needs
 * anyway — id to {@link Match}, because a row that draws WHY it is in front of
 * somebody has to know which field carried the hit (`@olai/web`'s
 * `filter/narrowing.ts`). Asking for a `ReadonlySet` forced that caller to
 * keep both and kept them free to disagree; asking for the question makes the
 * map the one answer.
 *
 * Deliberately NOT a union of the two: a prune has no business reading a
 * value out of either, and a signature that could would be an invitation to.
 */
export interface Selected {
  readonly has: (id: string) => boolean
}

/**
 * The RECORD a row draws: what it shows, or — for a row that shows nothing (a
 * mirror whose chain died, one that closed a loop) — the row's own.
 *
 * One spelling, because three readings ask it and a fourth `kind` must not be
 * able to split them: what a fold is of (the 2026-08-13 ruling — a fold is of
 * the NODE a row shows, which is what makes every mirror of a node fold with
 * it), what a filter matches by, and what a filtered count counts.
 */
export const shownRecord = (row: Row): Located =>
  row.kind === "node" || row.kind === "mirror" ? row.shows : row.at

/**
 * The same rows narrowed to what matched, WITH THE ANCESTORS THAT LEAD THERE.
 *
 * The sibling of {@link withoutDone} and the same kind of thing: a property of
 * a reading, not of the file. Nothing is touched on disk, nothing is marked,
 * and a row that is not drawn is a row not drawn.
 *
 * Two rules, and between them they are the whole of "filter in place":
 *
 *   - a row that MATCHED keeps its whole subtree. You asked for the thing; you
 *     get to read what is under it;
 *   - a row that did not is kept only when something beneath it did, and then
 *     it is CONTEXT — the ancestry that makes a bare title like "order" mean
 *     something, which is the same reason a search hit carries its `path`.
 *
 * A row matches by the node it SHOWS ({@link shownRecord}), so a mirror of a
 * matching node survives wherever it is drawn — the rule a fold already
 * follows, applied to the other view-time reading of a tree.
 */
export const keeping = (
  rows: ReadonlyArray<Row>,
  matched: Selected,
): ReadonlyArray<Row> =>
  rows.flatMap((row) => {
    if (matched.has(shownRecord(row).node.id)) return [row]
    const children = keeping(row.children, matched)
    return children.length === 0 ? [] : [{ ...row, children }]
  })

/**
 * How many PLACES in these rows are a match — what a filter bar reports.
 *
 * Places rather than nodes, because that is what a reader counts on the screen:
 * a node drawn twice (itself and a mirror of it) is two rows, and a count that
 * said one would be a count of something the page is not showing.
 */
export const matchedIn = (
  rows: ReadonlyArray<Row>,
  matched: Selected,
): number =>
  rows.reduce(
    (total, row) =>
      total + (matched.has(shownRecord(row).node.id) ? 1 : 0) +
      matchedIn(row.children, matched),
    0,
  )

/**
 * How many places these rows ARE — the other half of "3 of 41".
 *
 * Here rather than beside the bar that prints it, and that is the whole reason
 * it moved: the numerator is {@link matchedIn} and the denominator was a second
 * recursion in the browser, so the day a `Row` kind arrives that is drawn and
 * is not a place (or the reverse) the two were free to disagree about the same
 * tree. It is the argument {@link datedIn} was moved down for one shape over,
 * and the flat pages have had it since: one walk defines what a row is, and
 * both numbers are asked of it.
 *
 * SUBTREES INCLUDED, because a filtered tree draws them: a match keeps what
 * hangs under it, and a reader counting what is in front of them is counting
 * every line of it.
 */
export const rowsIn = (rows: ReadonlyArray<Row>): number =>
  rows.reduce((total, row) => total + 1 + rowsIn(row.children), 0)

/**
 * The same day groups narrowed to what matched — {@link keeping} for the pages
 * that are a DATE QUESTION rather than a tree (a day, and each section of the
 * agenda).
 *
 * A plain filter where a tree's is a walk, and that is a fact about those pages
 * rather than a shortcut: their rows are flat, and every one of them already
 * arrives carrying the ancestry that says what it is about (a `DayEntry` is
 * `Situated`, ./dates.ts) — so "matches keep their ancestors", which is the
 * whole promise of filtering in place, is true of every row before a query
 * touches it. There is nothing here to keep as context, because none of it was
 * context.
 *
 * A GROUP THAT HAS NOTHING LEFT GOES, and that is the same rule read one level
 * up: the file heading is drawn because that outline had something on the day,
 * and a heading over no rows would say it still does.
 */
export const keepingDated = (
  groups: ReadonlyArray<DayGroup>,
  matched: Selected,
): ReadonlyArray<DayGroup> =>
  groups.flatMap((group) => {
    const nodes = group.nodes.filter((entry) => matched.has(entry.shows.node.id))
    return nodes.length === 0 ? [] : [{ ...group, nodes }]
  })

// ── the other kind of thing a query selects ────────────────────────────

/**
 * WHERE A WORD IS LOOKED FOR IN A DOCUMENT.
 *
 * FOUR, and they line up with a record's one for one rather than being
 * {@link SEARCH_FIELDS} with entries crossed out: what a thing is CALLED
 * (`title`), what it is NAMED (an id there, a path here — the identity
 * somebody types when they know exactly which one they mean), the tags its
 * prose writes, and the prose (a `desc` there, the `body` here).
 *
 * `body` is the one that closes the roadmap's `search-document-bodies`: a
 * document's prose is text the way a node's note is, and it was invisible to
 * every search this app had because nothing walked it.
 *
 * `path` is what the ⌘K palette used to answer with a matcher of its own over
 * the served file names — one door, one index, and a reader typing
 * `2026-08-12` still finds the day's note whose prose never says the date.
 */
export const DOCUMENT_FIELDS = ["title", "path", "tag", "body"] as const
export type DocumentField = (typeof DOCUMENT_FIELDS)[number]

/** What each is worth, on {@link FIELD_WEIGHT}'s own scale and for its reason:
 *  the closer a hit is to what a document CALLS itself, the higher it goes. The
 *  numbers are shared with the records' table on purpose — one query answers
 *  with both kinds in one ranked list, and two scales would sort them into two
 *  blocks that only looked interleaved. */
const DOCUMENT_WEIGHT: Record<DocumentField, number> = {
  title: FIELD_WEIGHT.title,
  path: FIELD_WEIGHT.id,
  tag: FIELD_WEIGHT.tag,
  body: FIELD_WEIGHT.desc,
}

/** One document the query selected, with why — {@link Matched}'s twin over the
 *  other arm of the set. */
export interface DocumentMatch {
  readonly field: DocumentField | null
  readonly score: number
  /** The document's own spelling of every key a positive `prop:` clause
   *  selected it on — {@link Match.props} over the other arm, and the same
   *  {@link propsOf} builds both, so a row cannot say a different thing about
   *  a document than it says about a node. */
  readonly props: ReadonlyArray<string>
}

/** One document the query selected, with why — {@link Matched}'s twin over the
 *  other arm of the set. */
export interface MatchedDocument {
  readonly at: Bodied
  readonly match: DocumentMatch
}

/**
 * WHAT A QUERY LOOKS THROUGH on the other arm: every file the directory keeps
 * a body SLOT for, which is a `.md` and a `.html` alike.
 *
 * BOTH, and the `.html` is the one worth arguing. The set keeps a saved page's
 * path and not its bytes (`./kinds.ts`'s `kept`), so its `body` is empty here
 * and a word in its prose finds nothing — but it has a NAME and a path, and a
 * door that left it out would be the one place in this app where a saved page
 * in somebody's vault is not a thing you can find. That was the ⌘K palette's
 * own ruling while it matched paths for itself, and it is kept now that this
 * index answers instead.
 */
export type Bodied = Markdown | Unkept

/**
 * ONE THING A QUERY SELECTED, whichever kind it is — what a ranked answer is a
 * list of.
 *
 * A sum, and it carries a `kind` where {@link ./searching.ts}'s hit carries an
 * address, because the two are about different moments: this is the matcher's
 * own value, a record or a document IN HAND, and a caller of {@link
 * rankedTogether} is about to read fields off it. The hit is what a caller
 * BUILDS out of one, for somebody who was not here.
 */
export type Ranked =
  | { readonly kind: "node"; readonly at: LocatedRegular; readonly match: Match }
  | { readonly kind: "document"; readonly at: Bodied; readonly match: DocumentMatch }

/**
 * BOTH KINDS, in one order — what a search answers with.
 *
 * ONE LIST rather than a block of records followed by a block of documents,
 * which is the whole reason the two weights tables share a scale
 * ({@link DOCUMENT_WEIGHT}): a document whose TITLE holds the word outranks a
 * node that only mentions it in a note, and a reader typing three letters
 * should see whichever thing is most likely to be what they meant. Two lists
 * stapled together would have made the kind of a thing matter more than how
 * well it matched, which is the parity hole one layer up.
 *
 * The done penalty is {@link ranked}'s and is spent here on the records alone.
 * A document is not marked at all — the mark fields are a record's, and what a
 * document lacks it is not penalised for.
 *
 * A TIE goes to the record, since the records are laid out first and the sort
 * is stable. That is a coin toss given a name rather than a ruling: nothing
 * here can say which of two equally-matching things a reader meant, and the
 * only property worth promising is that the same query answers in the same
 * order twice.
 */
export const rankedTogether = (
  derived: Pick<Derived, "status">,
  nodes: ReadonlyArray<Matched>,
  documents: ReadonlyArray<MatchedDocument>,
): ReadonlyArray<Ranked> => {
  const scored: Array<{ readonly entry: Ranked; readonly score: number }> = [
    // Read ONCE PER NODE rather than once per comparison, for {@link ranked}'s
    // reason: a sort is n log n comparisons and this is n lookups.
    ...nodes.map((one) => ({
      entry: { kind: "node", at: one.at, match: one.match } as const,
      score: isSettled(derived, one.at.node.id)
        ? one.match.score - SETTLED_PENALTY
        : one.match.score,
    })),
    ...documents.map((one) => ({
      entry: { kind: "document", at: one.at, match: one.match } as const,
      score: one.match.score,
    })),
  ]
  scored.sort((a, b) => b.score - a.score)
  return scored.map((one) => one.entry)
}

/**
 * The folded text of a DOCUMENT, kept for as long as the document is —
 * {@link folded} next door, on the other kind of value, and correct for the
 * identical reason: a document is a value here, a file that changes is decoded
 * into a NEW one, so a fold that is still reachable is a fold of text that has
 * not changed.
 *
 * It matters more here than there, if anything: a body is the largest string in
 * the process after a saved page, and folding every one of them per keystroke
 * is what a search box over a vault would otherwise cost.
 */
const foldedDocuments = new WeakMap<Bodied, Record<DocumentField, ReadonlyArray<string>>>()

const documentHay = (
  document: Bodied,
): Record<DocumentField, ReadonlyArray<string>> => {
  const before = foldedDocuments.get(document)
  if (before !== undefined) return before
  const now: Record<DocumentField, ReadonlyArray<string>> = {
    title: [document.title.toLowerCase()],
    // The PATH twice, whole and by its name alone, for the reason a tag is
    // folded twice: `cabinets` should find `notes/cabinets.md` with the full
    // start-of-field bonus rather than be demoted by the folder in front of it,
    // and `notes/` should still find everything under it.
    // Through `./paths.ts`'s own spelling of "the last segment of a path"
    // rather than a slice written again here, for `foldOf`'s reason one door
    // over: a name is a name wherever this app takes one off a path.
    path: [document.path.toLowerCase(), basenameOf(document.path).toLowerCase()],
    // Bare AND as written, exactly as a record's tags are folded, so `alice`
    // finds `@alice` with the start-of-field bonus and `@alice` finds only the
    // one that carries that sigil.
    tag: document.tags.flatMap((tag) => {
      const written = tag.toLowerCase()
      return [written.slice(1), written]
    }),
    // A file whose body the set does not keep has no prose to look through,
    // which is a different sentence from "it holds none" — nothing here has
    // read it (`./document.ts`'s `Unkept`).
    //
    // THE PROSE and not the whole body: a `---` block at the top is the
    // document's RECORD, and its keys are answered by `prop:` above, out of
    // the map the same block was read into (`./frontmatter.ts`). Folding it in
    // here too would make every frontmatter'd file in a vault a hit for
    // `title`, and would say a word was found in a document's prose when what
    // held it was a property — two answers to "why is this here", from one
    // block, in one row.
    body: document.kind === "document" ? [proseIn(document.body).toLowerCase()] : [],
  }
  foldedDocuments.set(document, now)
  return now
}

/** {@link hayOf} over the other kind of thing a query selects, and it holds the
 *  identical argument one field-table along: the four places a word is looked
 *  for in a document, run together with a newline, so an index outside this
 *  file can look once and over-include rather than twice and disagree. Off
 *  {@link documentHay}, which is the fold the matcher itself reads — and here
 *  that is not only tidiness: a body is the largest string in the process, and
 *  a second lowercasing of every one of them is what an index would otherwise
 *  cost to build. */
export const documentHayOf = (document: Bodied): string => {
  const hay = documentHay(document)
  return DOCUMENT_FIELDS.map((field) => hay[field].join("\n")).join("\n")
}

/**
 * Which documents a query selects, and why — {@link matching}'s twin.
 *
 * ## What a document can answer, and what it cannot
 *
 * ONE OPERATOR, and it is the one a `.md` can write an answer to: `prop:`, over
 * the YAML frontmatter at the top of the file (`./frontmatter.ts`). A
 * document's keys are a `Custom` map like a record's, so `prop:agent` and
 * `prop:agent=claude-opus` are asked of both kinds through one
 * {@link propKeyOf} and answer in one ranked list.
 *
 * `is:done`, `has:desc`, `date:today` and the two stamps still select NO
 * document, and that is the honest answer rather than a hole: those name a
 * MARK, a FIELD of a record and a DAY, and a `.md` carries none of the three.
 * A frontmatter `done:` is a property named `done` — findable as `prop:done` —
 * and reading it as a mark would put a document in a search that the day page,
 * the agenda and the calendar do not draw it in.
 *
 * A NEGATED clause is satisfied, and by the same sentence read the other way:
 * `-is:done` asks for what is not finished, and a document is not. Dropping
 * documents there too would be answering a question nobody asked — it would
 * make `#kitchen -is:done` narrower than `#kitchen`, which no reader expects of
 * a negation.
 *
 * ## What a SCOPE means
 *
 * `file` is one outline and `under` is one node's subtree, and a document is in
 * neither: both are questions about where a RECORD sits in a tree. A scoped
 * query therefore selects no documents at all, which is what the browser's
 * filter over an open outline page wants and what a `search` with `file` means.
 *
 * The archive rule does not reach here either. What is put away is an
 * `_olai/Trash.olai`, which is an outline; a `.md` beside one is a document like
 * any other.
 *
 * ## What an index may say here
 *
 * `named` is {@link matching}'s own argument one arm over — paths that MIGHT
 * match, from whatever narrowed the search — and it is spent DIFFERENTLY, which
 * is a fact about the two arms rather than an inconsistency. There the ids are
 * resolved and sorted, because the corpus is the thing being avoided and there
 * are tens of thousands of records. Here the list is walked and each document
 * asked whether it was named, because a directory holds documents in the
 * hundreds and the expensive part of this loop was never reaching the next
 * document — it was FOLDING one, which is a body, and which the membership test
 * now skips. Walking the list also keeps the order for free: it arrives in the
 * set's own path order and leaves in it.
 */
export const matchingDocuments = (
  documents: ReadonlyArray<Bodied>,
  filter: Filter,
  scope: Scope = {},
  named?: Iterable<string>,
): ReadonlyArray<MatchedDocument> => {
  if (filter.kind !== "asking") return []
  if (scope.file !== undefined || scope.under !== undefined) return []
  const only = named === undefined ? null : new Set(named)
  const out: Array<MatchedDocument> = []
  for (const document of documents) {
    if (only !== null && !only.has(document.path)) continue
    const match = documentMatchOf(document, filter)
    if (match !== null) out.push({ at: document, match })
  }
  return out
}

/**
 * Does this document match, and why — or `null`.
 *
 * {@link matchedBy}, over this kind's own two answers: which clauses a document
 * can hold ({@link documentHolds}), and where its words are looked for
 * ({@link DOCUMENT_FIELDS}). Every other sentence about what a query means —
 * the conjunction, the alternatives, the scoring — is the shared one, which is
 * the whole reason that function has arguments rather than a second copy of
 * itself.
 */
const documentMatchOf = (
  document: Bodied,
  filter: Extract<Filter, { kind: "asking" }>,
): DocumentMatch | null => {
  const found = matchedBy(
    filter.groups,
    (clause) => documentHolds(document.props, clause),
    () => documentHay(document),
    DOCUMENT_FIELDS,
    DOCUMENT_WEIGHT,
  )
  if (found === null) return null
  // Collected only for a document that has already matched, exactly as
  // {@link matchOf} does it one arm over.
  return { ...found, props: propsOf(document.props, filter) }
}

/**
 * A DOCUMENT'S ANSWER TO ONE CLAUSE, and it is one row wide.
 *
 * `prop:` is the whole of what a `.md` can hold, and it holds it for real: its
 * frontmatter is a `Custom` map (`./frontmatter.ts`), so the question goes to
 * the same {@link propKeyOf} a record's does and `prop:agent=claude-opus`
 * answers with both kinds in one list.
 *
 * EVERYTHING ELSE IS STILL NO, and that is a ruling rather than a gap left
 * over. `is:done` asks about a MARK, `date:today` and the two stamps about a
 * DAY, `has:desc` about a field of a record — and a document has none of those
 * to carry. Reading a frontmatter `done:` as a mark or a `date:` as a day would
 * put a document in a search the day page, the agenda and the calendar do not
 * draw it in, which is the two-answers-to-one-word this grammar refuses
 * everywhere. So they are properties named `done` and `date`, findable as
 * `prop:done` and `prop:date`, and the honest answer to "which documents are
 * finished" is still none of them.
 *
 * A NEGATED clause is satisfied by whatever this answers no to, and by the same
 * sentence read the other way ({@link matchedBy} applies the negation, so this
 * stays a plain question).
 *
 * IT TAKES THE MAP and not the document, which is the same move
 * {@link propKeyOf} and {@link propsOf} make beside it: the map is the whole of
 * what it reads, and a signature saying so is a signature a reader can believe.
 */
const documentHolds = (props: Custom, clause: Clause): boolean =>
  clause.kind === "prop" && propKeyOf(props, clause) !== null
