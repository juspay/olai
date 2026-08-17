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
import { byPath } from "./paths.ts"

/** `true`, or the ISO date/datetime the state was reached at. */
const Marker = Schema.Union([Schema.Literal(true), Schema.String])

/**
 * The three MARKS a record may carry, at most one of them, in the order a
 * reader resolves them.
 *
 * One list, because three questions read it: the per-line rule that refuses a
 * record carrying two, the ISO check over their values, and the walk that asks
 * what a leaf claims about itself. A second list would be a fourth mark
 * somewhere and three marks everywhere else.
 *
 * The order is precedence, and it decides only what a set the validator has
 * ALREADY condemned looks like — the marks are exclusive on disk.
 */
export const MARKS = ["done", "doing", "todo"] as const

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

/**
 * The three MARK fields a record may carry, at most one of them.
 *
 * ONE declaration, spread into {@link RegularNode} below and read back by
 * `./reading.ts`'s {@link Detail} — because a mark on an answer is the
 * record's own value handed over verbatim, and a second spelling of these
 * three beside the answer would be free to stop meaning what the file means.
 *
 * The `satisfies` is the closure, and it is the whole reason the three are
 * written out rather than folded: a fourth {@link MARKS} entry becomes a
 * missing key HERE, named by the compiler, at the one place the format
 * declares what a record holds — rather than a mark that is writable,
 * plannable and derivable everywhere and readable back nowhere.
 *
 * EXPORTED, and not through `./index.ts`: `./reading.ts` is one module over and
 * needs it, and the package's rule is that a spelling a rule happens to use is
 * not contract. A consumer outside this package that wanted these three would
 * be re-deriving what a record holds; what it should reach for is `Detail`,
 * which already carries them.
 */
export const STAMPED = {
  done: Schema.optionalKey(Marker),
  doing: Schema.optionalKey(Marker),
  /** Work that has not started. The third MARK, and stored like the other two
   *  — a node is a task because someone said so, never by default. */
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
  date: Schema.optionalKey(Schema.String),
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
  doing: "`set_doing` writes it, and records the instant",
  todo: "`set_todo` writes it, and records the instant",
  status: "the mark is `done`, `doing` or `todo` — `set_done` / `set_doing` / `set_todo` write it",
  date: "`set_date` writes it, and validates the day",
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

/** A located record already known to be a regular node — what a mirror chain
 *  resolves to, and what a row displays. Carrying the narrowing in the type
 *  is what saves every consumer from re-deriving it with a field test. */
export type LocatedRegular = Located & { readonly node: RegularNode }

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

/** Where work that is over is put away: one `Archive.olai` per directory,
 *  beside the outline it left. The same rule as the racket reference, so a
 *  directory that has been archived from before goes on reading the way it did.
 *
 *  Being archived is a fact about the FILE a node is written in — there is no
 *  field for it, and there is not going to be one, for the reason no derived
 *  state is stored. It lives here rather than in ./kinds.ts because it is a
 *  fact about ONE kind — which outline a directory puts its finished work in —
 *  and the registry holds only what every kind has an answer to. Three rules in
 *  three packages read it: the op that moves a subtree there;
 *  blockedness, which exempts what has been put away at both ends of an arrow
 *  (./derive.ts); and ./changes.ts, which is what tells a cross-file move that
 *  landed here (*archived*) from one that did not (*moved*). Two spellings
 *  would be two answers about the same file — and the third reader makes that
 *  permanent, since a commit message cannot be corrected after the fact. */
export const ARCHIVE = `Archive${OUTLINE_EXT}`

export const isArchived = (file: string): boolean =>
  file === ARCHIVE || file.endsWith(`/${ARCHIVE}`)

/** The archive that sits beside `file`: same directory, the one name above.
 *  `archive` writes there and `unarchive` reads back from there, and one
 *  spelling of the adjacency is what makes the second visibly the first's
 *  inverse — two ad-hoc path slices were two chances to disagree about where
 *  a node's archive is. */
export const archiveBeside = (file: string): string => {
  const cut = file.lastIndexOf("/")
  return cut === -1 ? ARCHIVE : `${file.slice(0, cut + 1)}${ARCHIVE}`
}

/** The outline a quick capture lands in when a directory has none yet — at the
 *  ROOT, and named the way a person would name it, because an inbox nobody has
 *  created is a promise a surface makes ("capture to the Inbox") and the file
 *  it mints has to be the file they would have made themselves. Beside
 *  {@link ARCHIVE} because it is the same kind of statement: what a served
 *  file IS, by its name. */
export const INBOX = `Inbox${OUTLINE_EXT}`

/**
 * The directory's inbox, or `undefined` when it has none.
 *
 * A CONVENTION read off the files, in the shape {@link dailyNotePathFor} reads
 * the daily-note one — and HERE rather than in whichever face happens to ask,
 * for the reason `ARCHIVE` is here: a rule about what a file is, spelled in
 * two places, is two answers about the same directory. The web's quick capture
 * resolves through it (`@olai/server`'s `edit.ts`), and an agent capturing by
 * hand reads the same sentence rather than guessing at the browser's.
 *
 * The file is whichever outline is CALLED `Inbox.olai`, wherever it sits, so
 * a directory that already keeps its inbox under `notes/` captures into the
 * file it has rather than growing a second one at the root. Case-insensitively,
 * because it is a name a person typed and `inbox.olai` is the same intention.
 *
 * SHALLOWEST WINS, then path order — one answer, and a stable one, for the
 * directory that somehow holds two. "First in path order" would let a file
 * three directories down claim the capture from the obvious one beside it.
 * PATH ORDER is the set's own ({@link ./paths.ts}), rather than a compare
 * spelled here: there is one answer in this package to "which file comes
 * first", and a second one would be a directory whose inbox depended on who
 * was asking.
 */
export const inboxIn = (files: ReadonlyArray<string>): string | undefined =>
  files
    .filter((file) => basenameOf(file).toLowerCase() === INBOX.toLowerCase())
    .sort((a, b) => depthOf(a) - depthOf(b) || byPath(a, b))
    .at(0)

const basenameOf = (file: string): string => file.slice(file.lastIndexOf("/") + 1)

const depthOf = (file: string): number => file.split("/").length
