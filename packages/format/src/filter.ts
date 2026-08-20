/**
 * What a query MEANS — the one matcher, five callers.
 *
 * A query is words and operators; this file says which nodes they select, and
 * which rows survive when a tree is narrowed to them. It is here, at the bottom
 * of the layering, for the same reason `derive`, `rowsOf` and `withoutDone` are:
 * the validator and the view read the format through one implementation, and a
 * second one written to the same paragraph is the thing this package exists to
 * make impossible.
 *
 * FIVE CALLERS, and naming them is the argument:
 *
 *   - `@olai/ops`' `Query.search`, which is what an agent's `search_nodes` and
 *     the wire's `search.nodes` answer with. It calls {@link matching} as its
 *     gate and {@link ranked} to order them, and what is left of its own is
 *     the situating, the cap it applies and the total;
 *   - the ⌘K palette and the header's search box, which are callers of that
 *     procedure and so get every operator here for free;
 *   - the browser's FILTER over the tree on screen, which cannot be a caller of
 *     that procedure — it runs on every keystroke over rows the browser already
 *     holds, it wants every match rather than twelve, and it wants them as a set
 *     of ids to test rows against rather than as a ranked list of situated hits;
 *   - the chat composer's `@` list (`@olai/web`'s `chat/nodes.ts`), which is
 *     the filter's shape with a shortlist on the end: one token, matched here,
 *     ordered by {@link ranked}, eight rows taken off the top.
 *
 * The last two are why the matcher is down here rather than in the ops layer.
 * The alternative was a client-side predicate written to the same description,
 * which is exactly the drift docs/search.md was written to forbid — `is:done`
 * meaning one thing to an agent and another to the box a person types in. The
 * ranking followed it down for the same reason, one door later: see
 * {@link ranked}.
 *
 * The design, with the alternatives that lost, is
 * docs/brainstorming/filter-in-place.md.
 */

import { Schema } from "effect"

import {
  ancestorsOf,
  type Derived,
  isBlocked,
  isMirrored,
  mayHoldTag,
  type Row,
  storedMarker,
  tagText,
  titleParts,
} from "./derive.ts"
import type { Hypertext, Markdown } from "./document.ts"
import { customOf } from "./custom.ts"
import { shiftDay, shiftMonth, weekdayOf } from "./calendar.ts"
import { type DayGroup, datesOf, dayOf, monthOf } from "./dates.ts"
import { basenameOf } from "./paths.ts"
import { nothing } from "./write.ts"
import {
  isLeftoverArchive,
  isTrashed,
  isMirror,
  type Located,
  type LocatedRegular,
  type RegularNode,
} from "./node.ts"

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
 * The two completions in the browser each keep a fold of their own for the same
 * reason (`web/src/client/file/matching.ts` over the served paths, `complete/tags.ts` over the
 * set's tags). This one is HERE rather than beside them because the text it
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
 *  `marked` (any of the three — what makes `is:marked -is:done` sayable),
 *  `blocked` and `mirrored` (the two DERIVED values here — what is standing
 *  in a node's way, and where else the node is drawn) and `archived` (below).
 *  Which of them is answered by what is {@link being}, and that is a switch, so
 *  a value added to this list is a compile error there rather than a query that
 *  finds nothing. */
const IS_VALUES = [
  "done",
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
 * ONE grammar over them: a day, a month, a year, the twelve relative words and
 * a range of any of those mean under `created:` exactly what they mean under
 * `date:`, because {@link spanOf} reads the value before anything knows which
 * operator asked.
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
   * An inclusive span of DAYS, as text, and WHICH of a node's days it is asked
   * of ({@link DAY_READINGS}). `null` on either side is "unbounded that way",
   * which is what `date:..2026-08-10` and `created:2026-08-10..` are.
   *
   * ONE ARM FOR THE THREE, and the `of` is the whole difference between them:
   * the value was read by one {@link spanOf} before anything knew which
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
  | { readonly kind: "prop"; readonly key: string; readonly value: string | null }

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
export const parseFilter = (text: string, now: string): Filter => {
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
    const alternative = alternativeOf(token, now)
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
): Alternative | { readonly reason: string } => {
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
  const clause = clauseOf(name, value, now)
  return clause === null
    ? { reason: teaching(name, value) }
    : { kind: "clause", clause, negated: token.negated }
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
const clauseOf = (name: Operator, value: string, now: string): Clause | null => {
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
      return propClause(value)
  }
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
const propClause = (value: string): Clause | null => {
  if (value === "") return null
  const at = value.indexOf("=")
  if (at === -1) return { kind: "prop", key: value, value: null }
  const key = value.slice(0, at)
  const held = value.slice(at + 1)
  if (key === "" || held === "") return null
  return { kind: "prop", key, value: held }
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
    // `created:soon` is taught the same twelve words a reader refused at
    // `date:soon` is — and a value added to that grammar teaches itself at all
    // three doors rather than at whichever copy somebody remembered.
    case "date":
    case "created":
    case "changed":
      return `${name}: takes a day, month or year (2026-08-10, 2026-08, 2026), ` +
        `a relative word (${RELATIVE_TEACHING}), ` +
        "or a range of either (2026-08-01..2026-08-14, ..2026-08-10, last-week..)"
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

/** An inclusive span of days, both ends spelled out. What every `date:` value
 *  — absolute or relative — is read into before it becomes a clause. */
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
 * EXPORTED for {@link spanOf} next door and for the test that pins these
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
 * One end of a `date:`, as the span of days it stands for — or `null` for a
 * value this operator does not take.
 *
 * The ONE reading of a `date:` value, whichever form it is written in: a
 * relative word first ({@link relativeSpan}), then the absolute prefix. Which
 * is what makes a relative word compose with a range for free rather than by a
 * second rule — `date:last-week..` is the low end of last week's span with
 * nothing above it, exactly as `date:2026-08..` is the low end of August's.
 */
const spanOf = (value: string, now: string): Span | null => {
  const relative = relativeSpan(value, now)
  if (relative !== null) return relative
  return datePart(value) === null
    ? null
    : { from: lowOf(value), to: highOf(value) }
}

/**
 * A DAY OPERATOR's value — a day, a month, a year, a relative word, or a span
 * of them — with the operator's own name carried through as WHICH days it will
 * be asked of.
 *
 * ONE PARSE FOR THE THREE ({@link DAY_READINGS}), and `of` is the only thing
 * that distinguishes what comes out. That is the decomplecting the pair of
 * stamp operators is worth: `created:last-week..` did not need a line of
 * parsing written for it, because a span of days and the days a record offers
 * are two questions and this one had already been answered.
 *
 * Bounds are DAY STRINGS and comparison is text, as everywhere else in this
 * package: dates are validated ISO and stored verbatim, so a day is a
 * ten-character prefix and a range is two string comparisons. Nothing is parsed
 * into an instant — a date-only value put through one comes back a datetime,
 * and ./dates.ts already says why this is not the place to risk it. The
 * arithmetic a relative word needs is ./calendar.ts's, over integers, and it
 * happens ONCE per query rather than per node: what a clause holds afterwards
 * is the same two strings an absolute value produced.
 *
 * A month's upper bound is `-31` whether or not that month has one: as an
 * upper bound in a string comparison no real day of the month exceeds it, and
 * inventing a calendar here would be arithmetic to answer a question the
 * comparison already answers.
 *
 * A range takes each end's own span and keeps the OUTER edge of it — the low
 * of the left, the high of the right — so `date:last-week..today` runs from
 * last Monday to tonight, and an end left empty is unbounded that way.
 */
const daysClause = (of: DayReading, value: string, now: string): Clause | null => {
  const at = value.indexOf(RANGE)
  if (at === -1) {
    const span = spanOf(value, now)
    return span === null ? null : { kind: "days", of, from: span.from, to: span.to }
  }
  const left = value.slice(0, at)
  const right = value.slice(at + RANGE.length)
  if (left === "" && right === "") return null
  const low = left === "" ? null : spanOf(left, now)
  if (left !== "" && low === null) return null
  const high = right === "" ? null : spanOf(right, now)
  if (right !== "" && high === null) return null
  return { kind: "days", of, from: low?.from ?? null, to: high?.to ?? null }
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
  return { ...found, props: propsOf(at.node, filter) }
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
 * is what lets a document answer the whole family in one line: it holds no
 * clause at all, so a positive one selects none of them and a negated one is
 * satisfied. There is nowhere on a `.md` to write a mark, a date or a
 * property — the hole [frontmatter] is the named next step for.
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
 * The node's own spelling of every key a positive `prop:` clause selected it
 * on — {@link Match.props}, which argues the shape.
 *
 * EMPTY for the queries that are nearly all of them, and cheaply: this is
 * CALLED for every node the clauses let through, but a query with no `prop:` in
 * it only walks its own clause list and never reaches the scan below.
 *
 * The scan is {@link propKeyOf}'s, for the reason that one gives — keys are
 * FOLDED, so `custom["pr"]` would find one spelling and miss the other — and
 * asking it again here rather than threading the answer out of the gate above
 * keeps `holds` a predicate. The cost is a second walk of a handful of entries,
 * on the nodes a query actually selected.
 */
const propsOf = (node: RegularNode, filter: Extract<Filter, { kind: "asking" }>) => {
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
    const key = propKeyOf(node, clause)
    // Reported once however many clauses name it: `prop:pr prop:pr=x` is one
    // key the reader would see twice.
    if (key !== null && !keys.includes(key)) keys.push(key)
  }
  return keys
}

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
    // Status, and the `not-every-node-a-task` ruling behind it).
    case "done":
    case "doing":
    case "todo":
      return storedMarker(at.node) === value
  }
}

const holds = (derived: Derived, at: LocatedRegular, clause: Clause): boolean => {
  if (clause.kind === "is") return being(derived, at, clause.value)
  if (clause.kind === "has") return carries(at.node, clause.field)
  if (clause.kind === "prop") return propKeyOf(at.node, clause) !== null
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
 * DOES ANY DAY THIS RECORD OFFERS UNDER `clause.of` FALL INSIDE THE SPAN — the
 * one place a record is read as days, and the only question anything asks of it.
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
 * The two STAMPS are the record's own fields, cut to the day they fall on by
 * the same `dayOf` — one day or none, never two, since a record carries at
 * most one of each. They are compared as TEXT like every other date in this
 * package: a stamp is an instant with an offset on it, and the ten characters
 * in front of the `T` are the day the person writing it was having.
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
        : dates.some(({ date }) => within(dayOf(date), clause))
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
  (unbounded(clause) || within(dayOf(stamp), clause))

/** Neither end can exclude a day — the `has:` form, and what makes the cheap
 *  arms above correct rather than a shortcut. */
const unbounded = (clause: DaysClause): boolean =>
  clause.from === null && clause.to === null

/**
 * Does this node carry the custom property the clause names — and under WHICH
 * of its own spellings? `null` for one that does not.
 *
 * A KEY RATHER THAN A BOOLEAN because two callers want two different halves of
 * one scan: {@link holds} asks only whether, and {@link propsOf} needs the key
 * the node actually wrote so a reader can look it up in the map the hit
 * carries. Answering the second from a second scan would be this file holding
 * two definitions of "does `prop:PR` match a key written `pr`", which is the
 * one thing the folding rule below must not have.
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
  node: RegularNode,
  clause: Extract<Clause, { kind: "prop" }>,
): string | null => {
  for (const [key, value] of Object.entries(customOf(node))) {
    if (key.toLowerCase() !== clause.key) continue
    // A key holding NOTHING is a key the file does not carry (./write.ts), so
    // `prop:x` is false for it — the same rule `has:` reads, one map in.
    if (nothing(value)) continue
    if (clause.value === null) return key
    const held = typeof value === "string" ? [value] : value
    if (held.some((one) => one.toLowerCase() === clause.value)) return key
  }
  return null
}

/** Whether a record carries a field — the WRITER's own rule for absence
 *  (./write.ts's `nothing`), asked as a question rather than restated. The four
 *  ways a field can hold nothing (`undefined`, `null`, `[]`, `""`) all say the
 *  same thing about the node, and a second list of them here is how `desc: ""`
 *  becomes a note to search for and no note to write. */
const carries = (node: RegularNode, field: CarriedField): boolean =>
  !nothing(node[field])

/** Is this day inside the span? `null` on an end is no bound that way. Over
 *  the CLAUSE, which is {@link propKeyOf}'s shape next door: it took the two
 *  bounds loose for one commit, while `has:` was answered at the gate with no
 *  clause behind it to pass — and {@link hasClause} mints one now. */
const within = (day: string, clause: DaysClause): boolean =>
  (clause.from === null || day >= clause.from) &&
  (clause.to === null || day <= clause.to)

/**
 * Every node the query selects, in the set's own file-then-line order.
 *
 * MIRRORS ARE NOT HERE, for the reason nothing in the query layer answers with
 * one: a mirror is a second PLACEMENT of a node, so a hit for it would be the
 * same node twice, once at a place no write lands. What a filtered TREE does
 * with a placement is a different question, and {@link keeping} answers it.
 *
 * WHAT WAS PUT AWAY is decided here rather than per record, because it is a
 * fact about the QUESTION and not about any node: the query named the archive
 * ({@link Filter} `speaksOfTrash`), or the caller said its scope already
 * holds it ({@link Scope.trashed}). One boolean per call, read before the
 * walk.
 */
export const matching = (
  derived: Derived,
  filter: Filter,
  scope: Scope = {},
): ReadonlyArray<Matched> => {
  const inScope = scoping(derived, scope)
  const putAway = scope.trashed === true ||
    (filter.kind === "asking" && filter.speaksOfTrash)
  const out: Array<Matched> = []
  for (const located of derived.nodes) {
    if (isMirror(located.node)) continue
    const at = located as LocatedRegular
    // Leftover Archive.olai is orphaned from every query, including
    // `is:trashed`: it is not trash, and it is not live work either. The
    // file's own page still draws unfiltered (the filter box is inactive
    // then); a query over the directory does not re-enter it.
    if (isLeftoverArchive(at.file)) continue
    if (!putAway && isTrashed(at.file)) continue
    if (!inScope(at)) continue
    const match = matchOf(derived, at, filter)
    if (match !== null) out.push({ at, match })
  }
  return out
}

/** A done node is demoted by about a field's worth: enough to lose a tie, not
 *  enough to disappear. The reason to look for a node you finished is usually
 *  that you finished it. */
const DONE_PENALTY = 300

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
    score: derived.status.get(one.at.node.id) === "done"
      ? one.match.score - DONE_PENALTY
      : one.match.score,
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.map((entry) => entry.one)
}

/**
 * The scope, as one predicate.
 *
 * `under` is answered by walking UP from each node — `ancestorsOf`, which is
 * this package's one answer to "what is above this node", cycle guard and all.
 * A second walk written here would be a second answer: that one stops at a
 * parent that is missing or is a mirror (a set the validator has already
 * condemned), and one that walked straight through would put a node in a scope
 * the `path` on its own hit says it is not in.
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
export type Bodied = Markdown | Hypertext

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
      score: derived.status.get(one.at.node.id) === "done"
        ? one.match.score - DONE_PENALTY
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
    // read it (`./document.ts`'s `Hypertext`).
    body: document.kind === "document" ? [document.body.toLowerCase()] : [],
  }
  foldedDocuments.set(document, now)
  return now
}

/**
 * Which documents a query selects, and why — {@link matching}'s twin.
 *
 * ## What a document cannot answer, and what that means
 *
 * A clause (`is:done`, `has:date`, `date:today`, `prop:pr`) asks about a FIELD,
 * and a document has none: there is nothing on a `.md` for a mark, a date or a
 * property to be written on. So a positive clause selects NO document — not
 * because documents are second-class here, but because the honest answer to
 * "which documents are done" is none of them. That is the hole frontmatter
 * fills, and it is named in the design as the next step rather than patched
 * here.
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
 */
export const matchingDocuments = (
  documents: ReadonlyArray<Bodied>,
  filter: Filter,
  scope: Scope = {},
): ReadonlyArray<MatchedDocument> => {
  if (filter.kind !== "asking") return []
  if (scope.file !== undefined || scope.under !== undefined) return []
  const out: Array<MatchedDocument> = []
  for (const document of documents) {
    const match = documentMatchOf(document, filter)
    if (match !== null) out.push({ at: document, match })
  }
  return out
}

/**
 * Does this document match, and why — or `null`.
 *
 * {@link matchedBy}, over this kind's own two answers: a document HOLDS NO
 * CLAUSE, and its words are looked for in {@link DOCUMENT_FIELDS}. Every other
 * sentence about what a query means — the conjunction, the alternatives, the
 * scoring — is the shared one, which is the whole reason that function has
 * arguments rather than a second copy of itself.
 */
const documentMatchOf = (
  document: Bodied,
  filter: Extract<Filter, { kind: "asking" }>,
): DocumentMatch | null =>
  matchedBy(
    filter.groups,
    NO_CLAUSE_HOLDS,
    () => documentHay(document),
    DOCUMENT_FIELDS,
    DOCUMENT_WEIGHT,
  )

/** A document's answer to every clause in the grammar: no. One function, since
 *  it closes over nothing and is handed to every document of every query. */
const NO_CLAUSE_HOLDS = (): boolean => false
