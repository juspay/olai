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
 * The marks that mean WORK NOBODY HAS FINISHED — {@link MARKS} without `done`.
 *
 * FILTERED from that list rather than spelled beside it, which is the same
 * restraint {@link Status} keeps one line up: two literal lists is two places a
 * fourth mark would have to be added, and the one that was forgotten would fail
 * silently — a mark that blocks nothing, in a shape whose whole subject is what
 * is standing in the way (`./derive.ts`'s `InTheWay`).
 *
 * It is a SCHEMA because that shape travels now: what a row is waiting on rides
 * to the browser on a page's reading since `vault-in-browser`'s PR 10, and a
 * type alone cannot be encoded.
 */
export const Unfinished = Schema.Literals(
  MARKS.filter((mark): mark is Exclude<Status, "done"> => mark !== "done"),
)
export type Unfinished = typeof Unfinished.Type

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
  doing: "`set_doing` writes it, and records the instant",
  todo: "`set_todo` writes it, and records the instant",
  status: "the mark is `done`, `doing` or `todo` — `set_done` / `set_doing` / `set_todo` write it",
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
 * {@link MARKS} order, which is precedence: the three are mutually exclusive on
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

/** Where work that is over is put away: one `_olai/Trash.olai` for the
 *  whole served directory. Being trashed is a fact about the FILE a node is
 *  written in — there is no field for it, and there is not going to be one,
 *  for the reason no derived state is stored. It lives here rather than in
 *  ./kinds.ts because it is a fact about ONE kind — which outline a directory
 *  puts its finished work in — and the registry holds only what every kind has
 *  an answer to.
 *
 *  There used to be one `Archive.olai` per directory, beside the outline it
 *  left. That convention is dead (human, 2026-08-19): those files stay on disk
 *  and stop being read — not trash, not drawn on the trash page, invisible to
 *  `is:trashed`, and dormant in every live reading until a human opens one and
 *  hand-moves it. No migration. The kind registry still parses them — they are
 *  `.olai` — because a skip for a dead name would keep that name load-bearing;
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
 *  as the shelf's is: `_olai/Inbox.olai`, beside the shelf and the trash
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
 * questions stay apart: a directory already keeping `Inbox.olai` at its root,
 * or `notes/inbox.olai`, goes on capturing into the file it has, and nothing
 * migrates.
 */
export const inboxIn = (files: ReadonlyArray<string>): string | undefined =>
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
 * found by, wherever it sits, and a directory that already keeps a `Pins.olai`
 * at its root goes on using it. What olai CREATES, when there is none, is
 * `_olai/Pins.olai` — a file olai made rather than one a person did, so it
 * goes where those go (human, 2026-08-19).
 */
export const PINS = `Pins${OUTLINE_EXT}`

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
 * {@link inboxIn} go on finding whichever outline is CALLED `Pins.olai` or
 * `Inbox.olai`, wherever it sits — a directory that already keeps one at the
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
 * directory. It has exactly one reader today and that is on purpose — the
 * sidebar's file tree, which stops drawing these rows because each of them
 * already has a door of its own (the shelf IS `Pins.olai`'s face, the Trash
 * entry is the trash's, the Inbox entry is the inbox's), and draws them again
 * for a reader who asks (`@olai/web`'s `settings/hiddenOutlines.ts`). It is a
 * DRAWING rule and nothing more: search, the agents, `list_outlines`, the
 * trash page and the shelf read the same set either way.
 *
 * The ROOT `_olai/`, exactly, because that is the only one {@link mintedInto}
 * writes. A `notes/_olai/` is a directory somebody made inside their own
 * folder, and hiding it would be this app deciding something about a name a
 * person chose.
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
 * `_olai/Inbox.olai` (human, 2026-08-20, reversing the 2026-08-19 ruling that
 * kept it at the root). All three are files olai made because
 * somebody pressed something, and the top level of a served directory is the
 * reader's.
 */
export const mintedInto = (name: string): string => `${OLAI_DIR}/${name}`

/**
 * THE one trash. Minted here, found here, written here. Not "whichever
 * outline is called `Trash.olai`" — {@link pinsIn} and {@link inboxIn} still
 * find by name wherever the file sits; the trash is one file at one path,
 * because a node put away from any outline has to have one place to go, and
 * an entry in that file records which outline it came from so untrash can
 * put it back.
 *
 * Exact path, not a basename walk: `_olai/trash.olai` is a different file
 * and an ordinary outline. The mint always writes {@link TRASH}.
 */
export const TRASH_FILE = mintedInto(TRASH)

/** Whether `file` is the one trash — asked once per file per probe, compared
 *  against a constant so the hot path allocates nothing. */
export const isTrashed = (file: string): boolean => file === TRASH_FILE

/**
 * Leftover per-directory `Archive.olai`: parsed as an outline so a human can
 * open it and hand-move, but dormant — not trash, not live readings.
 *
 * Basename exactly `Archive.olai` (human, 2026-08-19: left on disk and stop
 * being read — orphaned). Exact, not a kind-registry skip: a tombstone for a
 * dead convention would keep the name load-bearing. `archive.olai` is a
 * different file and an ordinary outline.
 *
 * Asked the way {@link isTrashed} is — once per file, compared against a
 * constant so the hot path allocates nothing.
 */
export const isLeftoverArchive = (file: string): boolean =>
  file === "Archive.olai" || file.endsWith("/Archive.olai")

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
export const pinsIn = (files: ReadonlyArray<string>): string | undefined =>
  outlineCalled(files, PINS)

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
const outlineCalled = (
  files: ReadonlyArray<string>,
  name: string,
): string | undefined =>
  files
    .filter((file) => basenameOf(file).toLowerCase() === name.toLowerCase())
    .sort((a, b) => depthOf(a) - depthOf(b) || byPath(a, b))
    .at(0)


const depthOf = (file: string): number => file.split("/").length
