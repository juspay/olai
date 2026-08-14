/**
 * What a query MEANS — the one matcher, four callers.
 *
 * A query is words and operators; this file says which nodes they select, and
 * which rows survive when a tree is narrowed to them. It is here, at the bottom
 * of the layering, for the same reason `derive`, `rowsOf` and `withoutDone` are:
 * the validator and the view read the format through one implementation, and a
 * second one written to the same paragraph is the thing this package exists to
 * make impossible.
 *
 * FOUR CALLERS, and naming them is the argument:
 *
 *   - `@olai/ops`' `Query.search`, which is what an agent's `search_nodes` and
 *     the wire's `search.nodes` answer with. It calls {@link matching} as its
 *     gate and keeps what was always its own — the field weights, the position
 *     bonus, the done penalty, the cap, the total;
 *   - the ⌘K palette and the header's search box, which are callers of that
 *     procedure and so get every operator here for free;
 *   - the browser's FILTER over the tree on screen, which cannot be a caller of
 *     that procedure — it runs on every keystroke over rows the browser already
 *     holds, it wants every match rather than twelve, and it wants them as a set
 *     of ids to test rows against rather than as a ranked list of situated hits.
 *
 * That last one is why the matcher is down here rather than in the ops layer.
 * The alternative was a client-side predicate written to the same description,
 * which is exactly the drift docs/search.md was written to forbid — `is:done`
 * meaning one thing to an agent and another to the box a person types in.
 *
 * The design, with the alternatives that lost, is
 * docs/brainstorming/filter-in-place.md.
 */

import {
  type Derived,
  mayHoldTag,
  type Row,
  storedMarker,
  tagText,
  titleParts,
} from "./derive.ts"
import { datesOf, dayOf } from "./dates.ts"
import {
  isArchived,
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
 *  Here rather than in the ops layer's ranking because {@link matchOf} has to
 *  answer WHICH field carried a match, and "which" and "how much" are one
 *  table. What the ops layer keeps is everything about presenting a shortlist:
 *  the penalty a finished node takes, the cap, the total. */
const FIELD_WEIGHT = { title: 1000, id: 750, tag: 500, desc: 250 } as const

/** The case-folded text of one node, per field — what a word is looked for in.
 *
 *  A tag is indexed TWICE, bare and as written, so `alice` finds `@alice` with
 *  the full start-of-field bonus and `@alice` finds only the one with that
 *  sigil. A single written form would have demoted every bare-word tag search
 *  by a character. One fold, and the bare name is a slice of it. */
const haystacksOf = (
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

/** Where in the field the word landed. A field that STARTS with it beats one
 *  where it starts a word inside it, which beats one where it is buried.
 *  `-1` is "not in this field at all". */
const positionBonus = (haystack: string, needle: string): number => {
  const at = haystack.indexOf(needle)
  if (at === -1) return -1
  if (at === 0) return 100
  return /[\s/_-]/.test(haystack[at - 1] as string) ? 50 : 0
}

// ── the grammar ────────────────────────────────────────────────────────

/** The marks `is:` selects on, plus the two questions that are not a mark:
 *  `marked` (any of the three — what makes `is:marked -is:done` sayable) and
 *  `archived` (below). */
const IS_VALUES = ["done", "doing", "todo", "marked", "archived"] as const
type IsValue = (typeof IS_VALUES)[number]

/** The optional fields of a record `has:` asks about. One row per field a
 *  reader might select on; `has:children` and `has:mirror` are deliberately
 *  absent, being questions about the SET rather than about the record.
 *
 *  `date` is the one row that is not a plain field test — see {@link holds}. */
const HAS_FIELDS = ["desc", "date", "see", "after", "doc"] as const
type HasField = (typeof HAS_FIELDS)[number]

/** The three operator names. A colon after anything else is a colon in a word
 *  — see {@link parseFilter}. */
const OPERATORS = ["is", "has", "date"] as const

type Clause =
  | { readonly kind: "is"; readonly value: IsValue }
  | { readonly kind: "has"; readonly field: HasField }
  /** An inclusive span of DAYS, as text. `null` on either side is "unbounded
   *  that way", which is what `date:..2026-08-10` and `date:2026-08-10..` are. */
  | { readonly kind: "date"; readonly from: string | null; readonly to: string | null }

/** One word to find, and whether the query wants it ABSENT. */
interface Term {
  readonly word: string
  readonly negated: boolean
}

/** One clause, and the same question about it. */
interface Held {
  readonly clause: Clause
  readonly negated: boolean
}

/**
 * A token the grammar knows the name of and not the value — `is:blocked`,
 * `date:soon`, `has:tags`.
 *
 * Reported rather than quietly downgraded to a substring term, because a query
 * that silently finds nothing is precisely the ignored error HACKING.md
 * forbids: the reader typed an operator, and the honest answer is which values
 * it takes.
 */
export interface Refusal {
  readonly token: string
  readonly reason: string
}

/**
 * A query, in one of the three states it can be in — and a UNION rather than a
 * product of terms, clauses and refusals, because the third makes the other two
 * ungroundable.
 *
 * The product version read honestly field by field and lied in the joint: a
 * refused query still carried whatever half of it parsed, and "check
 * `refusals` before you read `terms`" was an arm-order convention every reader
 * had to know. Here there is nothing to know — a `refused` filter HAS no terms
 * to be tempted by, and `speaksOfArchive` exists only on the arm where an
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
    readonly terms: ReadonlyArray<Term>
    readonly clauses: ReadonlyArray<Held>
    /** True when the query names the archive at all, in either polarity. The
     *  archive is out of every reading unless it is ASKED for
     *  (docs/search.md), and this is the flag that says it was — so
     *  `is:archived` reaches what was put away and `-is:archived` says out
     *  loud what is otherwise the default. */
    readonly speaksOfArchive: boolean
  }

/**
 * Text into a query.
 *
 * Whitespace-separated tokens; a leading `-` negates whichever kind the token
 * turns out to be; a token whose left-of-colon is one of {@link OPERATORS} is a
 * clause and everything else is a substring term. That last rule is the one
 * worth stating: `TODO:`, `note:x` and `http://example.com` are words people
 * write, and a grammar that refused every colon would be a grammar that could
 * not search prose.
 *
 * Pure, and with no clock in it — which is why `date:today` is not in the
 * grammar (docs/brainstorming/filter-in-place.md names it as deferred). Case is
 * folded once, here, so nothing below has to remember to.
 */
export const parseFilter = (text: string): Filter => {
  const terms: Array<Term> = []
  const clauses: Array<Held> = []
  const refusals: Array<Refusal> = []
  let speaksOfArchive = false

  for (const raw of text.toLowerCase().split(/\s+/)) {
    if (raw === "") continue
    // A bare `-` is a character somebody typed, not a negation of nothing.
    const negated = raw.length > 1 && raw.startsWith("-")
    const token = negated ? raw.slice(1) : raw
    const colon = token.indexOf(":")
    const name = colon === -1 ? "" : token.slice(0, colon)
    if (!(OPERATORS as ReadonlyArray<string>).includes(name)) {
      terms.push({ word: token, negated })
      continue
    }
    const clause = clauseOf(name, token.slice(colon + 1))
    if (clause === null) {
      refusals.push({ token: raw, reason: teaching(name) })
      continue
    }
    if (clause.kind === "is" && clause.value === "archived") speaksOfArchive = true
    clauses.push({ clause, negated })
  }

  // One refusal decides the whole query. The alternative — answering with the
  // half that parsed — is a list that looks like an answer to a question
  // nobody asked, which is the silent error the refusals exist to prevent.
  if (refusals.length > 0) return { kind: "refused", refusals }
  if (terms.length === 0 && clauses.length === 0) return { kind: "nothing" }
  return { kind: "asking", terms, clauses, speaksOfArchive }
}

const clauseOf = (name: string, value: string): Clause | null => {
  if (name === "is") {
    return (IS_VALUES as ReadonlyArray<string>).includes(value)
      ? { kind: "is", value: value as IsValue }
      : null
  }
  if (name === "has") {
    return (HAS_FIELDS as ReadonlyArray<string>).includes(value)
      ? { kind: "has", field: value as HasField }
      : null
  }
  return dateClause(value)
}

/** What each operator takes, said the way the refusal vocabulary says things:
 *  the values, in full, so the next thing typed can be right. */
const teaching = (name: string): string =>
  name === "is"
    ? `is: takes one of ${IS_VALUES.join(", ")}`
    : name === "has"
    ? `has: takes one of ${HAS_FIELDS.join(", ")}`
    : "date: takes a day, month or year (2026-08-10, 2026-08, 2026) or a range (2026-08-01..2026-08-14, ..2026-08-10, 2026-08-10..)"

/** A year, a month or a day — the three lengths an ISO prefix comes in. */
const PARTIAL_DAY = /^\d{4}(-\d{2}(-\d{2})?)?$/
const RANGE = ".."

/**
 * `date:` — a day, a month, a year, or a span of them.
 *
 * Bounds are DAY STRINGS and comparison is text, as everywhere else in this
 * package: dates are validated ISO and stored verbatim, so a day is a
 * ten-character prefix and a range is two string comparisons. Nothing is parsed
 * into an instant — a date-only value put through one comes back a datetime,
 * and ./dates.ts already says why this is not the place to risk it.
 *
 * A month's upper bound is `-31` whether or not that month has one: as an
 * upper bound in a string comparison no real day of the month exceeds it, and
 * inventing a calendar here would be arithmetic to answer a question the
 * comparison already answers.
 */
const dateClause = (value: string): Clause | null => {
  const at = value.indexOf(RANGE)
  if (at === -1) {
    if (!PARTIAL_DAY.test(value)) return null
    return { kind: "date", from: lowOf(value), to: highOf(value) }
  }
  const left = value.slice(0, at)
  const right = value.slice(at + RANGE.length)
  if (left === "" && right === "") return null
  if (left !== "" && !PARTIAL_DAY.test(left)) return null
  if (right !== "" && !PARTIAL_DAY.test(right)) return null
  return {
    kind: "date",
    from: left === "" ? null : lowOf(left),
    to: right === "" ? null : highOf(right),
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
}

/**
 * Does this node match, and why — or `null`.
 *
 * The order of the gates is the order of their cost: a query that is not
 * ASKING decides before anything is read, the archive is a filename, the
 * clauses are field tests, and the words are the only thing that scans text.
 */
const matchOf = (at: LocatedRegular, filter: Filter): Match | null => {
  // Neither an empty box nor a query the grammar could not read selects
  // anything — and neither of them HAS terms to be tempted by, which is what
  // the union above is for.
  if (filter.kind !== "asking") return null
  if (!filter.speaksOfArchive && isArchived(at.file)) return null

  for (const held of filter.clauses) {
    if (holds(at, held.clause) === held.negated) return null
  }

  const hay = haystacksOf(at.node)
  let score = 0
  let field: SearchField | null = null
  let weight = -1
  for (const term of filter.terms) {
    const hit = wordHit(hay, term.word)
    if (term.negated) {
      if (hit !== null) return null
      continue
    }
    // Every word, in the same node. One miss and the node is not a hit.
    if (hit === null) return null
    score += hit.score
    if (hit.weight > weight) {
      weight = hit.weight
      field = hit.field
    }
  }
  return { field, score }
}

/** The best a single word does across the four fields: the score it earns, and
 *  the highest-weighted field that held it. */
const wordHit = (
  hay: Record<SearchField, ReadonlyArray<string>>,
  word: string,
): { readonly field: SearchField; readonly weight: number; readonly score: number } | null => {
  let score = -1
  let field: SearchField | null = null
  let weight = -1
  for (const name of SEARCH_FIELDS) {
    for (const haystack of hay[name]) {
      const bonus = positionBonus(haystack, word)
      if (bonus === -1) continue
      const value = FIELD_WEIGHT[name] + bonus
      if (value > score) score = value
      if (FIELD_WEIGHT[name] > weight) {
        weight = FIELD_WEIGHT[name]
        field = name
      }
    }
  }
  return field === null ? null : { field, weight, score }
}

const holds = (at: LocatedRegular, clause: Clause): boolean => {
  if (clause.kind === "is") {
    if (clause.value === "archived") return isArchived(at.file)
    // The STORED mark, never a derived one: a parent whose children are all
    // ticked is not `is:done` unless somebody ticked it (docs/format.md's
    // Status, and the `not-every-node-a-task` ruling behind it).
    const mark = storedMarker(at.node)
    if (clause.value === "marked") return mark !== undefined
    return mark === clause.value
  }
  // `has:date` is `date:` WITH NO BOUNDS rather than a test of the `date`
  // field, and the one exception in the table is deliberate: a reader who can
  // find a node with `date:2026-08-03` and then not find it with `has:date`
  // has met two answers to one word. So both read ./dates.ts's walk.
  if (clause.kind === "has") {
    return clause.field === "date"
      ? datesOf(at.node).length > 0
      : carries(at.node, clause.field)
  }
  // The same two fields the journal reads (./dates.ts): what the node is
  // scheduled for, and when it was finished. A filter that disagreed with the
  // day page about what a date means would be a third answer to a question
  // that already has one.
  return datesOf(at.node).some(({ date }) => within(dayOf(date), clause))
}

/** Whether a record carries a field, by the format's own rule for absence: an
 *  empty edge list is not an edge (`Found`'s `see` / `after` are omitted for
 *  one, and this is the same sentence asked as a question). */
const carries = (node: RegularNode, field: HasField): boolean => {
  const value = node[field]
  if (value === undefined) return false
  return Array.isArray(value) ? value.length > 0 : true
}

const within = (day: string, clause: Extract<Clause, { kind: "date" }>): boolean =>
  (clause.from === null || day >= clause.from) &&
  (clause.to === null || day <= clause.to)

/**
 * Every node the query selects, in the set's own file-then-line order.
 *
 * MIRRORS ARE NOT HERE, for the reason nothing in the query layer answers with
 * one: a mirror is a second PLACEMENT of a node, so a hit for it would be the
 * same node twice, once at a place no write lands. What a filtered TREE does
 * with a placement is a different question, and {@link keeping} answers it.
 */
export const matching = (
  derived: Derived,
  filter: Filter,
  scope: Scope = {},
): ReadonlyArray<Matched> => {
  const inScope = scoping(derived, scope)
  const out: Array<Matched> = []
  for (const located of derived.nodes) {
    if (isMirror(located.node)) continue
    const at = located as LocatedRegular
    if (!inScope(at)) continue
    const match = matchOf(at, filter)
    if (match !== null) out.push({ at, match })
  }
  return out
}

/** The scope, as one predicate. `under` walks the parent chain rather than
 *  collecting a subtree, so the whole thing stays a single pass and a node is
 *  never visited twice. */
const scoping = (
  derived: Derived,
  scope: Scope,
): ((at: LocatedRegular) => boolean) => {
  const { file, under } = scope
  if (file === undefined && under === undefined) return () => true
  return (at) => {
    if (file !== undefined && at.file !== file) return false
    if (under === undefined) return true
    let id: string | undefined = at.node.id
    const seen = new Set<string>()
    while (id !== undefined && !seen.has(id)) {
      if (id === under) return true
      seen.add(id)
      id = derived.byId.get(id)?.node.parent
    }
    return false
  }
}

// ── what a filtered tree looks like ────────────────────────────────────

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
  matched: ReadonlySet<string>,
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
  matched: ReadonlySet<string>,
): number =>
  rows.reduce(
    (total, row) =>
      total + (matched.has(shownRecord(row).node.id) ? 1 : 0) +
      matchedIn(row.children, matched),
    0,
  )
