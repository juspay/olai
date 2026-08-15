/**
 * The one map a node's facts live in.
 *
 * A record used to carry a field per fact — `todo`, `doing`, `done`, `date`,
 * `see`, `after`, `blocks` — and each of them was a place in a struct that only
 * this format could ever add to. `props` is the same facts in a map any writer
 * can put a key in, which is what docs/brainstorming/properties.md is for: the
 * day somebody wants `isbn` on a book note, the key exists because keys exist,
 * and nothing here has to learn the word.
 *
 * SYSTEM KEYS ARE NOT A SECOND MAP. `status` and `date` and the edges live in
 * the same map a user key would, and the only difference is that olai READS
 * them — the journal reads `date`, blockedness reads `status` and `after` — and
 * that their writes stay policed through the verbs that already own them
 * (`set_done` records the instant, `set_date` validates, `set_after` refuses a
 * cycle). Two maps would have made "which map does this key go in" a question
 * every writer had to answer, and the answer would have been the one thing this
 * design says is not a property of the key: whether olai happens to read it.
 *
 * VALUES ARE STRINGS OR LISTS OF STRINGS, and that is the whole type. The edges
 * are lists because an edge field always was one; everything else is a string.
 * Typed values are a door this deliberately does not open — a URL is a string
 * that looks like a URL, and a value that wants a number can have one the day a
 * reading needs it rather than the day a writer guesses.
 *
 * ## The mark, and where its instant went
 *
 * The three MARK fields were three answers to one question, which is why the
 * validator had a rule refusing a record that carried two of them. One key
 * cannot carry two, so that rule is not enforced here — it is UNREPRESENTABLE,
 * and `several-marks` retired with it the way `derived` retired when derivation
 * did (docs/format.md's Errors).
 *
 * But a mark was two facts in one field: WHICH state, and WHEN it was reached
 * (`{"done":"2026-08-11T15:40:03-04:00"}`, or a bare `true` that declines to
 * say). Two facts need two keys, so they get two — {@link STATUS} and
 * {@link SINCE}:
 *
 *     {"doing":true}                  ->  {"status":"doing"}
 *     {"done":"2026-08-11T15:40:03Z"} ->  {"status":"done","since":"2026-08-11T15:40:03Z"}
 *     {"todo":"2026-08-11"}           ->  {"status":"todo","since":"2026-08-11"}
 *
 * `since` present is exactly the old string-valued mark; `since` absent is
 * exactly the old `true`. That equivalence is total in both directions, which
 * is what lets ./migrate.ts prove itself by round trip.
 *
 * The two encodings that lost, both because they complect the two facts back
 * into one value: `status: ["done", "<instant>"]`, a positional pair in a map
 * whose other lists are unordered sets of ids, which a drawer would render as
 * two ids; and `status: "done <instant>"`, a packed string that every reader
 * would have to re-split. The alternative that lost for the opposite reason was
 * a key per mark (`{"done":"<instant>"}`), which puts "at most one of three"
 * back into a map that cannot express it and leaves a bare `true` with nothing
 * to be — the empty string is not a value this format writes.
 *
 * `since` reads as English on all three, which is the accident that makes it
 * the right word rather than `at` or `status-at`: done since the 11th, doing
 * since Tuesday, todo since it was filed.
 */

import { Schema } from "effect"

/**
 * The three MARKS a node's {@link STATUS} may hold, in the order a reader
 * resolves them.
 *
 * HERE rather than in `./node.ts`, which is where they lived while they were
 * three FIELDS of a record. They are three values of one key now, so this is
 * the file that says what that key may hold — and the move is what keeps this
 * module free of any import from the record it describes.
 *
 * The order is precedence, and it now decides nothing at all: one key cannot
 * hold two values, so the set the validator used to have to condemn (a record
 * carrying two marks) does not exist. {@link markOf} reads the list as a
 * membership test rather than as a search through fields.
 */
export const MARKS = ["done", "doing", "todo"] as const

/**
 * What a node's checkbox shows: one of the {@link MARKS}. STORED, on the node
 * that carries it, whether or not it has children — and OPTIONAL everywhere,
 * because a node with no status is a bullet and not a task at all.
 *
 * Read off that list rather than spelled again, because a status IS a mark:
 * there is nothing else it could be now that nothing computes one. One name for
 * it, so nobody has to learn that two are the same — and one SCHEMA, so the
 * places that were each writing `Schema.Literals(MARKS)` for themselves (a
 * request's `op`, a keystroke's `mark`, a read's `status`) are one derivation
 * read many times rather than many copies of it.
 *
 * What there is deliberately no member for is UNMARKED. `open` used to be one,
 * and it was what a node got for carrying nothing, which made every node a task
 * and left one value answering two questions — "a task nobody has started" and
 * "not a task at all". Absence answers the second; `todo` is how a node says
 * the first, and someone has to put it there.
 */
export const Status = Schema.Literals(MARKS)
export type Status = typeof Status.Type

/**
 * What one key holds: text, or a list of it.
 *
 * A UNION and not a widening — a value is one or the other, and which one a
 * system key takes is fixed ({@link SYSTEM_KEYS}) and checked per line
 * (./parse.ts). A user key may hold either, and nothing judges it.
 */
export const PropValue = Schema.Union([Schema.String, Schema.Array(Schema.String)])
export type PropValue = typeof PropValue.Type

/** The map itself. Freeform: any key, and olai gives no key a meaning it is not
 *  written down here as having. */
export const Props = Schema.Record(Schema.String, PropValue)
export type Props = typeof Props.Type

// ── the keys olai reads ────────────────────────────────────────────────

/** The mark a node stores — one of {@link MARKS}, or absent for a node that is
 *  not a task at all. */
export const STATUS = "status"

/** The instant {@link STATUS} was reached, for a mark that says. ABSENT is a
 *  real answer and the common one: it is the old `true`, a state somebody
 *  reached and declined to date. */
export const SINCE = "since"

/** What the node is SCHEDULED for — unchanged in meaning from the field of the
 *  same name, and still the first of the two dates a journal reads. */
export const DATE = "date"

/**
 * Every key olai itself reads, in the canonical order a record writes them.
 *
 * ONE list, and it is the order because it is the list: {@link canonicalKeys}
 * walks it, ./parse.ts checks the shape of whatever it finds under each, and
 * docs/format.md's table is written from it. A key added to the format in one
 * place rather than three is the whole reason it is here.
 *
 * The order is the OLD FIELD ORDER read forward — the mark, then the date, then
 * the edges — because a migrated file should diff against its history as a
 * change of shape rather than also as a shuffle.
 *
 * `shape` is what a per-line check enforces: a `status` holding a list is a
 * legal `props` map and an illegal record, exactly as two marks used to be.
 */
export const SYSTEM_KEYS = [
  { key: STATUS, shape: "text" },
  { key: SINCE, shape: "text" },
  { key: DATE, shape: "text" },
  { key: "after", shape: "list" },
  { key: "blocks", shape: "list" },
  { key: "see", shape: "list" },
] as const satisfies ReadonlyArray<{
  readonly key: string
  readonly shape: "text" | "list"
}>

export type SystemKey = (typeof SYSTEM_KEYS)[number]["key"]

/**
 * The keys that name other nodes, and the order the validator reports them in.
 * `blocks` is sugar — `a blocks b` means `b after a` — so it is normalised into
 * `after` before the acyclicity check, and only there.
 *
 * A SECOND list over the three `list`-shaped entries above, and the `satisfies`
 * is what stops it being a second answer: an edge that is not a system key is a
 * compile error here, at the one place the two lists could disagree. They are
 * kept apart because they say different things — {@link SYSTEM_KEYS} says what
 * a key HOLDS, this says which keys point at a node — and only this one is what
 * `targetsOf` walks.
 */
export const EDGE_FIELDS = ["after", "blocks", "see"] as const satisfies
  ReadonlyArray<SystemKey>
export type EdgeField = (typeof EDGE_FIELDS)[number]

const SYSTEM_ORDER: ReadonlyMap<string, number> = new Map(
  SYSTEM_KEYS.map(({ key }, at) => [key, at]),
)

/** Whether olai reads this key — asked as a question rather than by testing
 *  membership of the list at each site, because the answer is what decides
 *  whether a write goes through a verb (props-parity's `set_prop`) and a second
 *  spelling of it would be a key policed in one face and free in another. */
export const isSystemKey = (key: string): key is SystemKey => SYSTEM_ORDER.has(key)

/**
 * The keys of a map, in the order a file writes them: the system keys first, in
 * {@link SYSTEM_KEYS} order, then everything else alphabetically.
 *
 * CANONICAL, for the reason the record's field order is (./write.ts): two files
 * that mean the same thing must not differ byte for byte, because the format's
 * bet is that a line-based git merge is safe. A map's insertion order is
 * whatever the writer that built it happened to do — which for a record read
 * off disk and edited is the order the last writer used, and for one built
 * fresh is the order of the code. Neither is a contract, so neither decides.
 *
 * Alphabetical for user keys rather than insertion order, which is the open
 * question docs/brainstorming/properties.md leaves for the DRAWER: what a
 * reader sees is a view's decision and can still be either, and what a FILE
 * holds has to be a function of the map alone.
 */
export const canonicalKeys = (props: Props): ReadonlyArray<string> =>
  Object.keys(props).sort((a, b) => {
    const left = SYSTEM_ORDER.get(a)
    const right = SYSTEM_ORDER.get(b)
    if (left !== undefined && right !== undefined) return left - right
    if (left !== undefined) return -1
    if (right !== undefined) return 1
    return a < b ? -1 : a > b ? 1 : 0
  })

// ── reading one ────────────────────────────────────────────────────────

/** A record that may carry a map — the shape every reader below asks for, so
 *  none of them needs the whole {@link ./node.ts}'s `RegularNode` and none of
 *  them can reach a field that is not this map. */
export interface HasProps {
  readonly props?: Props | undefined
}

/** One key's value, as TEXT — `undefined` when it is absent, and `undefined`
 *  when it holds a list, which is a record the validator has already condemned
 *  and not a question this has an answer to. */
export const textOf = (node: HasProps, key: string): string | undefined => {
  const value = node.props?.[key]
  return typeof value === "string" ? value : undefined
}

/** One key's value, as a LIST — empty for absent, and empty for a value that is
 *  text, on the same terms {@link textOf} refuses a list. Empty rather than
 *  `undefined` because every caller of an edge field wants to iterate it, and
 *  `?? []` written at each of them is the absence rule spelled once per reader. */
export const listOf = (node: HasProps, key: string): ReadonlyArray<string> => {
  const value = node.props?.[key]
  return Array.isArray(value) ? value : []
}

/**
 * The mark a record claims about itself, which IS its status — and `undefined`
 * for a record claiming none, the one spelling of absence this has.
 *
 * A value that is not one of {@link MARKS} answers `undefined` rather than
 * being handed on: `{"status":"nope"}` is a record ./parse.ts refuses, and
 * these walks deliberately run over sets the validator has condemned (a browser
 * draws the outline beside the errors). A checkbox showing `nope` would be a
 * view inventing a fourth mark out of a typo.
 */
export const markOf = (node: HasProps): Status | undefined => {
  const value = textOf(node, STATUS)
  return MARKS.find((mark) => mark === value)
}

/** The instant the mark was reached, for a mark that says — and `undefined` for
 *  the bare state that does not. Never read without {@link markOf}: a `since`
 *  on a record with no `status` is a record ./parse.ts refuses. */
export const sinceOf = (node: HasProps): string | undefined => textOf(node, SINCE)

/** What the node is scheduled for. */
export const dateOf = (node: HasProps): string | undefined => textOf(node, DATE)

// ── writing one ────────────────────────────────────────────────────────

/**
 * The map with one key set, or — for a value that is NOTHING — taken out.
 *
 * Every write of a property goes through here, so "absent has one spelling"
 * (./write.ts's `nothing`) is enforced at the moment a key is set rather than
 * at the moment a file is written. The difference matters for the map that a
 * record then compares against for a diff (./changes.ts): a key holding `[]` and
 * a key that is gone would be one file on disk and two different maps in hand,
 * and the commit message reads the maps.
 *
 * The map comes back FRESH rather than mutated, because a record read off a
 * snapshot is shared with everything else holding that revision.
 */
export const withProp = (
  props: Props | undefined,
  key: string,
  value: PropValue | undefined,
): Props => {
  const next: Record<string, PropValue> = { ...props }
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    delete next[key]
  } else {
    next[key] = value
  }
  return next
}

/** The same, for several keys at once — the shape a mark write wants, since
 *  setting one is always setting `status` and `since` together and leaving one
 *  of them behind is exactly the drift the pair exists to prevent. */
export const withProps = (
  props: Props | undefined,
  entries: ReadonlyArray<readonly [key: string, value: PropValue | undefined]>,
): Props =>
  entries.reduce((carry, [key, value]) => withProp(carry, key, value), { ...props })

/** Whether a map says anything at all. An EMPTY map is not written
 *  (./write.ts's `nothing` reads this), so a node whose last property was
 *  removed is a node with no `props` field rather than one carrying `{}` —
 *  which would be the `{"after":[]}` conflict-about-nothing one level in. */
export const isEmptyProps = (props: Props | undefined): boolean =>
  props === undefined || Object.keys(props).length === 0
