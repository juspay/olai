/**
 * One line of an outline: one node, as a record.
 *
 * docs/format.md describes two record shapes, and so does this file. A regular
 * node carries the fields that describe it; a mirror carries only a placement
 * — `{id, parent?, ord, mirror}` — because it is a second *view* of a node
 * that already exists, and any field describing the node itself has an
 * authoritative copy at the target that a second one could only disagree with.
 *
 * Modelling that as one struct with an optional `mirror` field would make the
 * illegal combinations representable and push "which fields may co-occur" into
 * a hand-written key scan; two structs make them unrepresentable. The arm is
 * chosen before decoding rather than by a `Schema.Union` — `mirror` is present
 * or it is not, and picking the arm ourselves is what lets a broken record
 * hear "`title` is required and missing" instead of a union's report that
 * neither shape matched.
 *
 * Field order below is the canonical order writes re-serialise in, so the one
 * place a reader looks for "what fields exist" is the one place a writer looks
 * for "in what order".
 */

import { Schema } from "effect"

import { Custom } from "./custom.ts"
import { OUTLINE_EXT } from "./kinds.ts"
import { basenameOf, byPath } from "./paths.ts"

/** `true`, or the ISO date/datetime the state was reached at. */
const Marker = Schema.Union([Schema.Literal(true), Schema.String])

/**
 * The four MARKS a record may carry, at most one of them, in the order a
 * reader resolves them.
 *
 * One list, because three questions read it: the per-line rule that refuses a
 * record carrying two, the ISO check over their values, and the walk that asks
 * what a leaf claims about itself. A second list would be a fourth mark
 * somewhere and three marks everywhere else.
 *
 * The order is precedence, and it decides only what a set the validator has
 * ALREADY condemned looks like — the marks are exclusive on disk. The two that
 * SETTLE lead it ({@link SETTLED}), so a record a git merge left saying two
 * things at once resolves to the one that ended the wait.
 *
 * `cancelled` is the fourth, and it landed last (the human, 2026-08-25):
 * **"not happening" is a stored fact.** It was said by CLEARING a mark, which
 * left a bullet — a row indistinguishable from a line nobody ever called work,
 * carrying no instant, landing on no day, and telling a reader who came back to
 * it in a month nothing at all. The mark says it, records when it was said, and
 * — like `done` and unlike the other two — ENDS THE WAIT: see {@link SETTLED}.
 */
export const MARKS = ["done", "cancelled", "doing", "todo"] as const

/**
 * The marks that END THE WAIT — `done`, and now `cancelled`.
 *
 * THE ONE LIST that says what settling IS, and the reason the fourth mark was
 * one seam rather than a hunt through the readings. `./derive.ts`'s
 * `unfinishedWork` carries the contract for both of us and its header is where
 * the argument lives; what is here is the vocabulary that argument names.
 *
 * The two are NOT interchangeable and nothing here says they are: `done` is
 * work that HAPPENED and `cancelled` is work that will not, which is the whole
 * difference a journal page, a glyph and a commit line each draw. What they
 * share is exactly one property — nobody is waiting on either — and that
 * property is what every reading below asks about: what a day still owes, what
 * a badge burns for, what an arrow blocks, what a branch holds up.
 */
export const SETTLED = ["done", "cancelled"] as const

/**
 * What a node's checkbox shows: one of the {@link MARKS}. STORED, on the node
 * that carries it, whether or not it has children — and OPTIONAL everywhere,
 * because a node with no status is a bullet and not a task at all.
 *
 * Read off that list rather than spelled again, because a status IS a mark:
 * there is nothing else it could be now that nothing computes one. One name
 * for it, so nobody has to learn that two are the same — and one SCHEMA, so
 * the five places that were each writing `Schema.Literals(MARKS)` for
 * themselves (a request's `op`, a keystroke's `mark`, a read's `status`) are
 * one derivation read five times rather than five copies of it.
 *
 * Beside {@link MARKS} rather than beside the derivations, which is where it
 * was: it is a fact about what a RECORD may carry, the same list the fields
 * below are keyed by, and putting it here is what lets those fields be keyed
 * by it at all without this module reaching up into a walk.
 *
 * What there is deliberately no member for is UNMARKED. `open` used to be one,
 * and it was what a node got for carrying nothing, which made every node a
 * task and left one value answering two questions — "a task nobody has
 * started" and "not a task at all". Absence answers the second; `todo` is how
 * a node says the first, and someone has to put it there.
 */
export const Status = Schema.Literals(MARKS)
export type Status = typeof Status.Type

/** A mark that ends the wait — {@link SETTLED} as a type, so the exclusion
 *  below and `./derive.ts`'s predicate narrow to the same two words. */
export type Settled = (typeof SETTLED)[number]

/**
 * Does this mark END THE WAIT? Asked of a mark rather than of a node, so the
 * one caller that has narrowed already ({@link storedMarker}'s answer) and the
 * ones that have not ask the same question.
 *
 * A TYPE GUARD, so `Exclude<Status, Settled>` is reachable by narrowing rather
 * than by a cast — which is what lets {@link Unfinished} below be a filter of
 * the one list instead of a second list.
 */
export const settles = (mark: Status): mark is Settled =>
  (SETTLED as ReadonlyArray<Status>).includes(mark)

/**
 * The marks that mean WORK NOBODY HAS FINISHED — {@link MARKS} without the two
 * that {@link SETTLED} names.
 *
 * FILTERED from that list rather than spelled beside it, which is the same
 * restraint {@link Status} keeps one line up: two literal lists is two places a
 * fifth mark would have to be added, and the one that was forgotten would fail
 * silently — a mark that blocks nothing, in a shape whose whole subject is what
 * is standing in the way (`./derive.ts`'s `InTheWay`).
 *
 * It is a SCHEMA because that shape travels now: what a row is waiting on rides
 * to the browser on a page's reading since `vault-in-browser`'s PR 10, and a
 * type alone cannot be encoded.
 *
 * THE FILTER IS A DECISION and not only a saving, which is the half the
 * paragraph above does not say: "everything that is not `done`" — which is what
 * this was — reads a mark nobody has thought about yet as work somebody still
 * owes. That was exactly right for three marks and a decision disguised as an
 * omission for the fourth, so what it filters by is now the SETTLING list and
 * not one word: a mark that ends the wait has to be excluded HERE and in
 * `./derive.ts`'s `unfinished` (which spells the same rule of a mark, and whose
 * `unfinishedWork` header carries the contract for both), and those two are the
 * whole list — what is late, what a day owes, what a badge burns for and what
 * an arrow blocks all read one of them.
 */
export const Unfinished = Schema.Literals(
  MARKS.filter((mark): mark is Exclude<Status, Settled> => !settles(mark)),
)
export type Unfinished = typeof Unfinished.Type

/**
 * The four MARK fields a record may carry, at most one of them.
 *
 * ONE declaration, spread into {@link RegularNode} below and read back by
 * `./reading.ts`'s {@link Detail} — because a mark on an answer is the
 * record's own value handed over verbatim, and a second spelling of these
 * four beside the answer would be free to stop meaning what the file means.
 *
 * The `satisfies` is the closure, and it is the whole reason they are written
 * out rather than folded: a fifth {@link MARKS} entry becomes a missing key
 * HERE, named by the compiler, at the one place the format declares what a
 * record holds — rather than a mark that is writable, plannable and derivable
 * everywhere and readable back nowhere. It is what named `cancelled` at this
 * line the moment the list above grew.
 *
 * EXPORTED, and not through `./index.ts`: `./reading.ts` is one module over and
 * needs it, and the package's rule is that a spelling a rule happens to use is
 * not contract. A consumer outside this package that wanted these four would
 * be re-deriving what a record holds; what it should reach for is `Detail`,
 * which already carries them.
 */
export const STAMPED = {
  done: Schema.optionalKey(Marker),
  /** Work that is NOT HAPPENING. The fourth MARK, stamped with the instant the
   *  call was made exactly as `done` is — because a decision to stop is an
   *  event, it belongs on the day it was taken, and a bare `true` would put it
   *  on no day at all ({@link SETTLED}, and `./occasion.ts`). */
  cancelled: Schema.optionalKey(Marker),
  doing: Schema.optionalKey(Marker),
  /** Work that has not started. A stored mark like every other one here — a
   *  node is a task because someone said so, never by default. */
  todo: Schema.optionalKey(Marker),
} satisfies { readonly [M in Status]: unknown }

/** The fields both shapes share: identity, and where the record sits among its
 *  siblings. Named for what it IS rather than `Placement`, which this package
 *  now exports for a different thing — a MIRROR's location, `./reading.ts`.
 *  Two adjacent meanings under one word is the collision `OutlineSummary` was
 *  renamed to avoid, one file over and one visibility down. */
const Common = {
  id: Schema.String,
  /** Absent at top level. The only field docs/format.md marks optional for a
   *  regular node — which is how `ord` and `title` below are read as required. */
  parent: Schema.optionalKey(Schema.String),
  /** A fractional index over base62. Plain string comparison is the sort. */
  ord: Schema.String,
}

export const RegularNode = Schema.Struct({
  ...Common,
  /** Verbatim. Inline tags live here and are extracted at view time — `#topic`
   *  and `@person`, two namespaces rather than two spellings of one. */
  title: Schema.String,
  ...STAMPED,
  /**
   * When the CURRENT round of work started: the instant `set_doing` stamps
   * on EVERY start — a re-open after a settle writes a fresh one, because
   * the round that came before is no longer this field's concern: the
   * settle already banked it into `worked` below, and the pause between
   * two rounds is nobody's work. And it SURVIVES only while the bank can
   * still account for it: a settle keeps it when the round just closed was
   * live (`doing` said so), and buries it when none was — an undone settle
   * re-settled with no `set_doing` between: the alternative is the same
   * round countable twice (the stamp is dead weight a second settle would
   * mistake for a fresh round's). And where the `doing` comes off WITHOUT
   * a settle — `set_todo` queueing the work again, or the undo of the
   * `set_doing` itself — the round banks THERE, at the peel, and the stamp
   * goes with it: live minutes never sit on a record that cannot close
   * them, and the settle that lands later is an ordinary one.
   *
   * STAMPED, never asked for: there is no verb for it and none may write
   * it, exactly as the two stamps below. And nothing DERIVES from its
   * absence being filled in: a node without one simply has no round to
   * tell — the todo→done jump stores no `started` and answers no `took`
   * (`./derive.ts`), because falling back to `created` would measure the
   * node's age rather than the work.
   *
   * It puts the node on NO day, which is the reason it is not a value on
   * the `doing` mark: the journal reads a node's `date` and its SETTLING
   * instants only (`./occasion.ts`), and this is neither. It places
   * nothing the way `created` places nothing.
   */
  started: Schema.optionalKey(Schema.String),
  /**
   * How much work is BANKED, in whole seconds: the rounds already CLOSED,
   * summed. A round closes where its `doing` comes off: every settle —
   * `set_done` and `set_cancelled` alike — adds the round it closes (its
   * instant minus `started`) into this field, and the two doors that take
   * a `doing` off WITHOUT settling — the `set_todo` that queues the work
   * again, the undo of the `set_doing` itself — bank the span at the peel,
   * the stamp going with the `doing`. So a task picked up, put down and
   * picked up again counts the rounds and never the pauses between them.
   *
   * It is what makes the stamp above re-stampable: a re-opened node's
   * earlier work is HERE, so the fresh `started` measures the fresh round
   * and nothing is lost — and an undo that is never re-started leaves the
   * bank alone, because the work did happen.
   *
   * Written ONLY where a round closes, and only from a live one, so a
   * settle can never bank the same span twice: the `doing` that made the
   * round closable is gone by the time a second settle could reach for
   * it — and a round put down early was already banked at its peel. There
   * is no verb for it, no request carries one, and `set_prop` turns the
   * key away toward them, exactly as `started` above. Never NEGATIVE and
   * never fractional: whole seconds, and the schema says so rather than
   * the read having to argue with a hostile bank. ABSENT is the ordinary
   * state of a node whose rounds all predate the bank — and of the
   * todo→done jump, which never had a round to close — and absent reads
   * as zero everywhere it is asked (`./derive.ts`'s `tookOf`): no
   * migration, every old record already legal.
   */
  worked: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  date: Schema.optionalKey(Schema.String),
  /** How this node COMES BACK, in the words it is written in — `every week on
   *  monday` (./repeat.ts). Only on the occurrence that is NEXT: completing one
   *  hands the rule to the occurrence it spawns, so a finished record is a
   *  plain dated node and a recurrence has one live head. Needs `date` beside
   *  it, which is what it repeats from (./parse.ts refuses one without). */
  repeat: Schema.optionalKey(Schema.String),
  /** The note: one string, embedded newlines, markdown, stored verbatim. */
  desc: Schema.optionalKey(Schema.String),
  /** Relative path to an attached `.md`, resolved against this file. */
  doc: Schema.optionalKey(Schema.String),
  after: Schema.optionalKey(Schema.Array(Schema.String)),
  blocks: Schema.optionalKey(Schema.Array(Schema.String)),
  see: Schema.optionalKey(Schema.Array(Schema.String)),
  /**
   * The two STAMPS, and the only fields on this record nobody writes on
   * purpose: the ops layer puts `created` on a node when it is captured and
   * re-puts `changed` on it whenever it is written afterwards. There is no verb
   * for either, and `set_prop` refuses both by name.
   *
   * ABSENT is the ordinary state of a node written before this existed, and
   * nothing invents one: a ledger does not make up a past it did not see, and
   * `git log` is the archaeologist's tool. They appear as a node is touched.
   *
   * `changed` absent on a node that HAS a `created` is a real answer too — it
   * means nothing has been written to it since it was captured.
   */
  created: Schema.optionalKey(Schema.String),
  changed: Schema.optionalKey(Schema.String),
  /** The one OPEN field: named facts this format gives no meaning to, written
   *  by `set_prop` and read by whoever wrote them (./custom.ts). Every other
   *  key on this record is one of the fields above, and a key that is neither
   *  is a `bad-record` — which is exactly what makes one open field worth
   *  having rather than an open record. */
  custom: Schema.optionalKey(Custom),
})
export type RegularNode = typeof RegularNode.Type

export const MirrorNode = Schema.Struct({
  ...Common,
  mirror: Schema.String,
})
export type MirrorNode = typeof MirrorNode.Type

export const Node = Schema.Union([RegularNode, MirrorNode])
export type Node = typeof Node.Type

/**
 * The words a record's own fields have already claimed, and the verb that
 * writes each of them.
 *
 * A `custom` key may be anything — except one of these, and the reason is
 * SHADOWING rather than collision: the two namespaces are two places, so
 * `{"done":true,"custom":{"done":"yesterday"}}` is a perfectly legal record and
 * a perfectly unreadable one. A reader seeing `done` in a drawer would take it
 * for the mark, a query for one would find the wrong nodes, and the node would
 * be saying two things with one word. So the freeform writer is turned away
 * from these, each toward the verb that actually writes that fact
 * ({@link shadowFor}).
 *
 * Here rather than beside the writer, and keyed by the record's own field
 * names: a field added above with no sentence here is a COMPILE error, so the
 * day this format grows a key it cannot grow a hole at the same time. `status`
 * is the one entry that is not a field — nothing stores it, and it is exactly
 * the word a person reaches for when they mean the mark.
 */
const DOORS = {
  id: "an id is minted or chosen when the node is captured, and never rewritten",
  parent: "`move_node` writes where a node sits",
  ord: "`move_node` writes where a node sits among its siblings",
  title: "`set_title` writes the title",
  mirror: "`add_mirror` places a node in a second location",
  done: "`set_done` writes it, and records the instant",
  cancelled: "`set_cancelled` writes it, and records the instant",
  doing: "`set_doing` writes it, and records the instant",
  todo: "`set_todo` writes it, and records the instant",
  started:
    "`set_doing` stamps it on every start — a settle keeps it when the round banked, buries it when none could; a peel banks the round and takes the stamp with the `doing`",
  worked:
    "rounds bank where the `doing` comes off — `set_done` / `set_cancelled` add the round they closed, `set_todo` and an un-done start bank at the peel; only a live `doing` opens one",
  status:
    "the mark is `done`, `cancelled`, `doing` or `todo` — `set_done` / `set_cancelled` / `set_doing` / `set_todo` write it",
  date: "`set_date` writes it, and validates the day",
  repeat: "`set_repeat` writes the repeat rule, and completing the node hands it to the next occurrence",
  desc: "`set_desc` writes the note",
  doc: "a node names its document when it is captured; `write_document` writes what is in it",
  after: "`set_after` writes it, and refuses a cycle",
  blocks: "`set_after` writes it, said from the waiting node — `a blocks b` is `b after a`",
  see: "`set_see` writes it, and resolves the target",
  created: "the ops layer stamps this when a node is captured — nothing else may",
  changed: "the ops layer stamps this on every write — nothing else may",
  custom: "this is the map itself; a key inside it is what `set_prop` writes",
} as const satisfies Record<keyof RegularNode | keyof MirrorNode | "status", string>

/**
 * What a shadowed key shadows: the verb that writes that fact, and whether the
 * word is a FIELD of the record at all.
 *
 * The second half exists for one entry. `status` is in {@link DOORS} because it
 * is exactly the word a person reaches for when they mean the mark — and it is
 * not a field: nothing stores it, three fields answer it. A refusal that told
 * somebody "a node already says `status` with a field of its own" would be
 * teaching a shape this format does not have, in the one sentence whose whole
 * job is to point at the right door (found by Grok, review of #179).
 */
export interface Shadow {
  readonly door: string
  /** Is the word a field the record declares? `false` for `status` alone. */
  readonly field: boolean
}

const FIELD_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(RegularNode.fields),
  ...Object.keys(MirrorNode.fields),
])

/**
 * Is this custom key one of them — and if so, what to say instead?
 *
 * FOLDED, because a `Date` key shadows `date` for every reader who is not a
 * parser: the confusion this prevents is a human one, and humans do not read
 * case. The refusal is the only rule `set_prop` has about a key's spelling;
 * everything else is somebody's own vocabulary and none of this format's
 * business.
 */
export const shadowFor = (key: string): Shadow | undefined => {
  const folded = key.trim().toLowerCase()
  const door = (DOORS as Record<string, string | undefined>)[folded]
  return door === undefined ? undefined : { door, field: FIELD_NAMES.has(folded) }
}

/** The discriminator, as a type guard, so every consumer narrows the same way
 *  and none of them re-derives it from a field test. */
export const isMirror = (node: Node): node is MirrorNode => "mirror" in node

/**
 * A place in the loaded set: which file, which line.
 *
 * `file` is relative to the served directory, so it reads the same in the
 * browser, in a test assertion and in a report from another machine. `line` is
 * 1-based, and it is the WHOLE address because of what this module is about —
 * one node per line, so there is nothing finer to name. A `line` of 0 says
 * there is no record to point at and the place is the path itself, which is a
 * rule `./errors.ts` spells once as `hasLine` for the same reason this struct
 * is spelled once here.
 *
 * ONE declaration, and that is the whole of what it is for. FOUR things in
 * this package carry a place — an error's site (`./errors.ts`), a record in
 * the set ({@link Located} below), the flattened node every read answers with
 * and a mirror's location (`./reading.ts`'s `Found` and `Placement`) — and
 * each of them used to spell `{file, line}` for itself. Four spellings of one
 * fact is not four names for a type: it is a fact that can be extended in one
 * of four places and compile clean past the other three, which is the drift
 * this package keeps closing everywhere else (`MARKS`, `STAMPED`, `Status`).
 * The four remain four — they are different things ABOUT a place, and folding
 * them into each other would be a lie. The PLACE is one thing, and this is it.
 *
 * Here rather than in `./errors.ts`, where it lived: an error is one of the
 * four carriers and not the atom's home, and this is the module that says what
 * a line of an outline IS. It also imports nothing in this package, so every
 * carrier can reach it without a cycle — which the reverse arrangement, with
 * `./node.ts` reaching up into the error catalogue, could not promise.
 */
export const Site = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
})
export type Site = typeof Site.Type

/** A node located in the set. The validator, the snapshot and the browser all
 *  need "which file, which line" alongside the record; carrying it beside the
 *  node rather than inside it keeps the record exactly the fields on disk. */
export const Located = Schema.Struct({
  ...Site.fields,
  node: Node,
})
export type Located = typeof Located.Type

/**
 * A located record already known to be a regular node — what a mirror chain
 * resolves to, and what a row displays. Carrying the narrowing in the type is
 * what saves every consumer from re-deriving it with a field test.
 *
 * A SCHEMA rather than the intersection it was (`Located & { node: RegularNode }`),
 * and what that buys is that it can TRAVEL. Every drawable shape in this
 * package is built out of this pair — a row, a crumb, a blocker, a day's entry
 * — and since `vault-in-browser`'s PR 10 those ARE what the wire carries to a
 * page, in place of the records a browser would have walked to build them. An
 * intersection of two declarations is a type and nothing more; this is a
 * declaration, so `@olai/surface` can name it and the encoder can carry it.
 *
 * Structurally what it always was, which is what keeps {@link isRegular} a
 * narrowing of {@link Located} rather than a cast: the same `Site` fields, the
 * regular record.
 */
export const LocatedRegular = Schema.Struct({
  ...Site.fields,
  node: RegularNode,
})
export type LocatedRegular = typeof LocatedRegular.Type

/**
 * ...and the guard that NARROWS to it, which {@link isMirror} cannot do on its
 * own: a discriminant test on `at.node` narrows the record and leaves the place
 * around it as wide as it was, so every caller that wanted the pair either
 * annotated its own predicate or reached for a cast.
 *
 * Both of those were in the tree — `./derive.ts`'s counted-children filter
 * spells the predicate inline, and the backlinks reading asserted one — which
 * is the shape {@link isMirror}'s own note warns about one level down: every
 * consumer should narrow the same way rather than re-derive it. This is that
 * sentence read for the located pair.
 */
export const isRegular = (at: Located): at is LocatedRegular => !isMirror(at.node)

/**
 * What a record claims about itself, which IS its status — and `undefined` for
 * one claiming nothing, the one spelling of absence this format has. Read in
 * {@link MARKS} order, which is precedence: the four are mutually exclusive on
 * disk, so it only decides what a set the validator has already condemned looks
 * like.
 *
 * BESIDE THE LIST IT READS, which is where {@link Status} already sits and for
 * that member’s own reason: what a record CARRIES is this module’s subject, and
 * a derivation over a set is not. It lived in `./derive.ts` until `./occasion.ts`
 * — the leaf that decides which of a node’s fields put it on a day — needed it:
 * that module is imported BY the fold, so reaching back up into the fold would
 * have been a cycle through the one module every reading here is layered on.
 */
export const storedMarker = (node: RegularNode): Status | undefined =>
  MARKS.find((mark) => node[mark] !== undefined)

/** Ids are slugs — a chosen name or a minted short string. The shape is
 *  checked rather than assumed because ids appear in URLs, in `#tag`-adjacent
 *  text and as bare wire keys. */
export const ID_SHAPE = /^[A-Za-z0-9_-]+$/

/** The edge fields, and the order the validator reports them in. `blocks` is
 *  sugar — `a blocks b` means `b after a` — so it is normalised into `after`
 *  before the acyclicity check, and only there. */
export const EDGE_FIELDS = ["after", "blocks", "see"] as const
export type EdgeField = (typeof EDGE_FIELDS)[number]

/** Every field a record can NAME another record with: the edge fields, and the
 *  one a placement points with. The closed list {@link targetsOf} answers in
 *  and {@link ./derive.ts}'s reverse index carries — `string` there would be a
 *  second, open vocabulary for the closed one this file already owns, which is
 *  the failure `targetsOf` itself is written against one level down. */
export type TargetField = EdgeField | "mirror"

/** The answer for a record that points at nothing, which is nearly every
 *  record: ONE list, shared. See {@link targetsOf}'s last paragraph. */
const NOTHING_NAMED: ReadonlyArray<readonly [field: TargetField, id: string]> = []

/**
 * Every id this record POINTS AT, and the field it pointed with — in
 * declaration order, so two readings answer the same.
 *
 * One function, because two questions are the same question read from either
 * end. The validator asks it forwards ("does everything this record names
 * exist?"); the ops layer asks it backwards, over the set, before it takes a
 * record away ("does anything still name this?"). A second list of field names
 * in the second caller is the failure this format keeps warning about: the day
 * a fourth relation is added, the rule that scans for it silently stops seeing
 * one, and the write that should have been refused lands.
 *
 * A mirror points with `mirror` and nothing else — it has no edges of its own —
 * which is the same reason it is a separate shape rather than an optional field.
 * `parent` is deliberately not here: it is same-file placement rather than a
 * bare reference, and it has its own rules and its own error codes.
 *
 * A record pointing at NOTHING — which is nearly every record — allocates
 * nothing: it shares one empty list. That is not a micro-optimisation for its
 * own sake, it is what lets `derive` ask this of every node in the directory
 * to build its reverse index. The `flatMap` this replaced allocated four
 * arrays per record whether or not the record carried a single edge, which on
 * a vault-sized set is most of the cost of the derivation.
 */
export const targetsOf = (
  node: Node,
): ReadonlyArray<readonly [field: TargetField, id: string]> => {
  if (isMirror(node)) return [["mirror", node.mirror] as const]
  let named: Array<readonly [field: TargetField, id: string]> | undefined
  for (const field of EDGE_FIELDS) {
    const ids = node[field]
    if (ids === undefined) continue
    for (const id of ids) (named ??= []).push([field, id] as const)
  }
  return named ?? NOTHING_NAMED
}

/** Where work that is over is put away: one `_olai/Trash.org` for the
 *  whole served directory. Being trashed is a fact about the FILE a node is
 *  written in — there is no field for it, and there is not going to be one,
 *  for the reason no derived state is stored. It lives here rather than in
 *  ./kinds.ts because it is a fact about ONE kind — which outline a directory
 *  puts its finished work in — and the registry holds only what every kind has
 *  an answer to.
 *
 *  There used to be one `Archive.org` per directory, beside the outline it
 *  left. That convention is dead (human, 2026-08-19): those files stay on disk
 *  and stop being read — not trash, not drawn on the trash page, invisible to
 *  `is:trashed`, and dormant in every live reading until a human opens one and
 *  hand-moves it. No migration. The kind registry still parses them — they are
 *  `.org` — because a skip for a dead name would keep that name load-bearing;
 *  {@link isLeftoverArchive} is the predicate the readings ask, the same way
 *  {@link isTrashed} is asked of the one trash.
 *
 *  THE CENSUS IS KEPT because it is what makes the one spelling honest, and it
 *  is longer than it looks — nine rules in three packages, which is exactly why
 *  none of them may re-derive the name:
 *
 *    - `@olai/ops` — the op that MOVES a subtree there, and `untrash`'s
 *      rules about what may come back out and where it lands. The outermost
 *      scaffold title is the outline the node left, so one file can hold
 *      piles from many;
 *    - ./derive.ts — blockedness, which exempts what has been put away at both
 *      ends of an arrow, so trashed work holds nothing up and nothing holds
 *      it up;
 *    - ./changes.ts — what tells a cross-file move that landed here
 *      (*trashed*) from one that did not (*moved*);
 *    - ./dates.ts — the walk every date reading is built from, which leaves
 *      the trash out because what was put away is drawn on the trash page
 *      and nowhere else (ruled 2026-08-17);
 *    - ./filter.ts, twice — the `is:trashed` clause, which is how a query
 *      NAMES the trash, and the default one node up that keeps it out of
 *      every reading that did not;
 *    - `@olai/web`, five times, all of them the same ruling read on a screen:
 *      the trash file's own address opens the TRASH rather than an editable
 *      tree (`page.ts`, which also skips it when `/` picks a first outline);
 *      the sidebar's file tree does not list it (`Sidebar.tsx`), because the
 *      Trash entry at the foot of the column is where it is read; the
 *      filter widens its scope only on a page already drawing trashed rows
 *      (`filter/narrowing.ts`); the tag vocabulary does not count them
 *      (`./vocabulary.ts`, which that page asks for), because that count is a
 *      promise about rows; and
 *      the move-to picker refuses it as a DESTINATION in its own words
 *      (`./moving.ts`) — a query that says `is:trashed` can reach the
 *      Trash from there, and what is put away is not somewhere work is moved
 *      TO.
 *
 *  Two spellings would be two answers about the same file — and the
 *  commit-message reader makes that permanent, since a subject cannot be
 *  corrected after the fact. */
export const TRASH = `Trash${OUTLINE_EXT}`

/** The NAME a quick capture's outline is found by — named the way a person
 *  would name it, because an inbox nobody has created is a promise a surface
 *  makes ("capture to the Inbox"). Beside {@link TRASH} because it is the same
 *  kind of statement: what a served file IS, by its name.
 *
 *  WHERE ONE IS MINTED is {@link mintedInto}'s and not this constant's, exactly
 *  as the shelf's is: `_olai/Inbox.org`, beside the shelf and the trash
 *  (human, 2026-08-20, reversing that of 2026-08-19 which kept it at the root).
 *  Nothing about the reading moved with it — {@link inboxIn} goes on finding
 *  whichever outline is CALLED this, wherever it sits. */
export const INBOX = `Inbox${OUTLINE_EXT}`

/**
 * The directory's inbox, or `undefined` when it has none.
 *
 * A CONVENTION read off the files, in the shape {@link dailyNotePathFor} reads
 * the daily-note one — and HERE rather than in whichever face happens to ask,
 * for the reason `TRASH` is here: a rule about what a file is, spelled in
 * two places, is two answers about the same directory. The web's quick capture
 * resolves through it (`@olai/server`'s `edit.ts`), and an agent capturing by
 * hand reads the same sentence rather than guessing at the browser's.
 *
 * HOW that file is found is {@link outlineCalled}'s, and it is that function
 * rather than a walk here because the shelf below is found the same way. WHERE
 * one is minted when there is none is {@link mintedInto}'s, and the two
 * questions stay apart: a directory already keeping `Inbox.org` at its root,
 * or `notes/inbox.org`, goes on capturing into the file it has, and nothing
 * migrates.
 */
export const inboxIn = (files: Iterable<string>): string | undefined =>
  outlineCalled(files, INBOX)

/**
 * The outline the PINNED SHELF is — every pin the directory holds, one node
 * per pin, in the order they are drawn.
 *
 * The third filename in this file that means something, and it means it the
 * way the other two do: BY ITS NAME, with no field on any record saying so.
 * What is in it is ORDINARY NODES whose titles name an ADDRESS in this app —
 * which is what a bookmark is — so an agent reads the shelf with
 * `read_subtree`, adds to it with `add_node`, reorders it with `move_node`
 * and takes something off it with `trash_node`. Pinning grew no op and no
 * AGENT tool, which is the whole reason the shelf is a file of nodes rather
 * than a field (docs/format.md's Pins). The browser grew one verb of its own,
 * `pin`, and it resolves to that same `add` — what it saves a tab is the
 * READING of which file the shelf is, never an op (`@olai/surface`'s
 * `edit.ts`, where quick capture makes the identical trade).
 *
 * WHERE ONE IS MINTED is {@link mintedInto}'s and not this constant's, and the
 * two questions are deliberately apart: this is the NAME a directory's shelf is
 * found by, wherever it sits, and a directory that already keeps a `Pins.org`
 * at its root goes on using it. What olai CREATES, when there is none, is
 * `_olai/Pins.org` — a file olai made rather than one a person did, so it
 * goes where those go (human, 2026-08-19).
 */
export const PINS = `Pins${OUTLINE_EXT}`

/**
 * The outline a directory DECLARES ITS PROPERTY TYPES in — one node per key,
 * the title IS the key, and an enum's variants are that node's children
 * ({@link ./typing.ts}, where what a declaration says is read).
 *
 * The fourth filename in this file that means something, and it means it the
 * way the other three do: BY ITS NAME, with no field on any record saying so.
 * Which is the whole of why declarations are DATA rather than config — editing
 * the vocabulary is editing an outline, the file is readable in olai like any
 * other, and adding a variant is adding a child row.
 *
 * NOTHING MINTS THIS ONE, which is where it parts company with the three
 * above: the shelf, the inbox and the trash are files olai made because
 * somebody pressed something, and there is no gesture that declares a key. A
 * directory with no such file has no typed key, which is the state every vault
 * starts in — typing is opt-in per key ({@link ./typing.ts}) — so the mint has
 * nothing to make.
 */
export const PROPERTIES = `Properties${OUTLINE_EXT}`

/**
 * THE DIRECTORY OLAI MINTS ITS OWN FILES INTO.
 *
 * A served directory is somebody's — their outlines, their notes, their names,
 * at the top level where they put them. A file OLAI made because a person
 * pressed something is a different kind of thing, and it does not belong in
 * that list: the shelf was the first of them, and the trash is the second
 * (human, 2026-08-19).
 *
 * `_` rather than `.`, and that is load-bearing rather than a style: a
 * dot-directory is not WALKED at all (`@olai/store`'s `disk.ts` prunes them,
 * because whoever put one there did not mean it as content), so a shelf under
 * one would never be read back. An underscore is an ordinary directory that
 * sorts to the top and reads as machine-owned to a person looking at `ls`.
 *
 * IT IS A MINT AND NOT A HOME, which is the whole distinction this file keeps
 * between the two questions a convention asks. {@link pinsIn} and
 * {@link inboxIn} go on finding whichever outline is CALLED `Pins.org` or
 * `Inbox.org`, wherever it sits — a directory that already keeps one at the
 * root, or under `notes/`, keeps using the file it has and nothing moves. This
 * says only where olai puts one when the directory has none.
 */
export const OLAI_DIR = "_olai"

/** `_olai/` — {@link OLAI_DIR} as the thing {@link inOlaiDir} below actually
 *  compares, built once rather than per file asked. */
const OLAI_PREFIX = `${OLAI_DIR}/`

/**
 * Whether `file` is one of the files OLAI NAMED FOR ITSELF — the mint above,
 * read backwards.
 *
 * A predicate rather than a `startsWith` at whichever face happens to ask, for
 * the reason {@link isTrashed} is one: it is a statement about what a served
 * file IS, and a second spelling of `_olai/` is a second answer about one
 * directory. Its readers are the two faces that have to seat olai's own files
 * apart from the reader's, and both are DRAWINGS: the sidebar, which keeps the
 * corpus in the tree and the `_olai/` rows in the quiet group at the column's
 * foot (`@olai/web`'s `Sidebar.tsx`), and the wake picker, which offers the
 * boards somebody keeps and not the shelf, the property declarations or a
 * watcher's knobs (`@olai/web`'s `chat/scopable.ts`, which argues why that is
 * still a drawing rule: what it leaves off a list it does not refuse). It is a
 * DRAWING rule and nothing more: search, the agents, `list_outlines`, the
 * trash page and the shelf read the same set either way, and so does the
 * doorbell once a file has been picked.
 *
 * The ROOT `_olai/`, exactly, because that is the only one {@link mintedInto}
 * writes. A `notes/_olai/` is a directory somebody made inside their own
 * folder, and seating it apart would be this app deciding something about a
 * name a person chose.
 *
 * Asked the way {@link isTrashed} is — once per FILE, against a prefix built
 * once, so a walk of a whole directory allocates nothing.
 */
export const inOlaiDir = (file: string): boolean => file.startsWith(OLAI_PREFIX)


/**
 * Where olai mints a file it names itself — one spelling, so a convention that
 * lands here is one call rather than a path assembled at three sites.
 *
 * The shelf was first; the trash moved here next (human, 2026-08-19); and the
 * inbox is the third — a capture into a directory with none mints
 * `_olai/Inbox.org` (human, 2026-08-20, reversing the 2026-08-19 ruling that
 * kept it at the root). All three are files olai made because
 * somebody pressed something, and the top level of a served directory is the
 * reader's.
 */
export const mintedInto = (name: string): string => `${OLAI_DIR}/${name}`

/**
 * THE one trash. Minted here, found here, written here. Not "whichever
 * outline is called `Trash.org`" — {@link pinsIn} and {@link inboxIn} still
 * find by name wherever the file sits; the trash is one file at one path,
 * because a node put away from any outline has to have one place to go, and
 * an entry in that file records which outline it came from so untrash can
 * put it back.
 *
 * Exact path, not a basename walk: `_olai/trash.org` is a different file
 * and an ordinary outline. The mint always writes {@link TRASH}.
 */
export const TRASH_FILE = mintedInto(TRASH)

/** Whether `file` is the one trash — asked once per file per probe, compared
 *  against a constant so the hot path allocates nothing. */
export const isTrashed = (file: string): boolean => file === TRASH_FILE

/**
 * Leftover per-directory `Archive.org`: parsed as an outline so a human can
 * open it and hand-move, but dormant — not trash, not live readings.
 *
 * Basename exactly `Archive.org` (human, 2026-08-19: left on disk and stop
 * being read — orphaned). Exact, not a kind-registry skip: a tombstone for a
 * dead convention would keep the name load-bearing. `archive.org` is a
 * different file and an ordinary outline.
 *
 * Asked the way {@link isTrashed} is — once per file, compared against a
 * constant so the hot path allocates nothing.
 */
export const isLeftoverArchive = (file: string): boolean =>
  file === "Archive.org" || file.endsWith("/Archive.org")

/**
 * WHAT WAS PUT AWAY — the one question every reading of the live set actually
 * asks, which is the disjunction of the two above.
 *
 * They are two facts and stay two functions: one is a file this app mints and
 * owns ({@link TRASH_FILE}), the other is a dead convention left readable on
 * disk (the human's ruling, 2026-08-19). But no reading has ever wanted one
 * without the other — "is this file out of the live set" is what backlinks,
 * the blocked-status walk, the date readings, the tag vocabulary and the
 * sidebar's first-outline pick each ask — and the disjunction was written out
 * at every one of them. Half a dozen spellings of one rule is half a dozen
 * places for a third kind of dormant file to be forgotten.
 *
 * Asked the way its two halves are: once per FILE per probe, never per record.
 */
export const isPutAway = (file: string): boolean =>
  isTrashed(file) || isLeftoverArchive(file)

/** The directory's shelf, or `undefined` when it has none — {@link inboxIn}'s
 *  question one convention over, answered by the same walk so that one
 *  directory cannot have two answers depending on who asked. */
export const pinsIn = (files: Iterable<string>): string | undefined =>
  outlineCalled(files, PINS)

/** The directory's property declarations, or `undefined` when it has none —
 *  {@link pinsIn}'s question one convention over, answered by the same walk for
 *  the same reason: one directory, one answer, whoever asked. A vault with no
 *  such file declares no key, and every key in it is text. */
export const propertiesIn = (files: Iterable<string>): string | undefined =>
  outlineCalled(files, PROPERTIES)

/**
 * The one outline a directory CALLS by a given name, or `undefined`.
 *
 * Two conventions are read this way — the inbox a capture lands in, the shelf a
 * pin lands on — and they became one function the moment there were two of
 * them: the rule is not "where the inbox is", it is "how this format finds the
 * file a directory named", and a second copy of it would be two directories'
 * worth of behaviour under one sentence in docs/format.md.
 *
 * The file is whichever outline is CALLED that, wherever it sits, so a
 * directory that already keeps its inbox under `notes/` captures into the file
 * it has rather than growing a second one at the root. Case-insensitively,
 * because it is a name a person typed and `inbox.org` is the same intention.
 *
 * SHALLOWEST WINS, then path order — one answer, and a stable one, for the
 * directory that somehow holds two. "First in path order" would let a file
 * three directories down claim the capture from the obvious one beside it.
 * PATH ORDER is the set's own ({@link ./paths.ts}), rather than a compare
 * spelled here: there is one answer in this package to "which file comes
 * first", and a second one would be a directory whose inbox depended on who
 * was asking. It is asked as a running minimum ({@link nearerOf}) rather than
 * as a sort, which is also what makes the answer independent of the ORDER the
 * files arrive in — a caller may hand over a list, a map's keys or a set, and
 * a directory that holds two still has one answer.
 *
 * ITERABLE and not a list, for that last reason and for one more: the two
 * readers that ask this of a derivation were spelling it
 * `propertiesIn([...derived.byFile.keys()])`, which is a copy of every served
 * path built to be walked once and dropped ({@link ./rules.ts},
 * {@link ./typing.ts}, once per write each).
 */
const outlineCalled = (
  files: Iterable<string>,
  name: string,
): string | undefined => {
  const called = name.toLowerCase()
  let held: string | undefined
  for (const file of files) {
    if (basenameOf(file).toLowerCase() !== called) continue
    held = held === undefined ? file : nearerOf(held, file)
  }
  return held
}

/**
 * Of two files a directory calls the same thing, the one a convention MEANS —
 * {@link outlineCalled}'s tie rule as a comparison of two, which is what makes
 * the walk above a running minimum rather than a filtered list that is then
 * sorted.
 *
 * The rule is unchanged and reads the same way: shallowest wins, then path
 * order. What changed is that the walk no longer ALLOCATES — a list of the
 * matches, a sort over it, and (in {@link depthOf}) an array of segments per
 * comparison — for an answer that is one string. The walk is over every served
 * file, and {@link ./conventions.ts} is what stopped it being run per revision;
 * what it spends per file is worth spelling out for the times it does run.
 *
 * A TIE IS UNREACHABLE and is therefore not a case of its own: two paths of
 * equal depth that compare equal under {@link byPath} are the same string, and
 * a directory does not serve one file twice. `held` is kept when they tie,
 * which is what the stable sort answered as well.
 */
const nearerOf = (held: string, file: string): string => {
  const deeper = depthOf(file) - depthOf(held)
  return deeper < 0 || (deeper === 0 && byPath(file, held) < 0) ? file : held
}

/** How many segments deep a path sits — COUNTED rather than split, so a
 *  comparison of two files allocates nothing. `a.org` is 1 and
 *  `wing/a.org` is 2, which is `split("/").length` exactly. */
const depthOf = (file: string): number => {
  let depth = 1
  for (let at = 0; at < file.length; at++) {
    if (file.charCodeAt(at) === SEPARATOR) depth++
  }
  return depth
}

/** `/` as {@link depthOf} counts it — the one character a path is made of
 *  segments by, and the same one {@link ./paths.ts} sorts first. */
const SEPARATOR = "/".charCodeAt(0)
