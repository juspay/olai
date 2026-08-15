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
})
export type RegularNode = typeof RegularNode.Type

export const MirrorNode = Schema.Struct({
  ...Common,
  mirror: Schema.String,
})
export type MirrorNode = typeof MirrorNode.Type

export const Node = Schema.Union([RegularNode, MirrorNode])
export type Node = typeof Node.Type

/** The discriminator, as a type guard, so every consumer narrows the same way
 *  and none of them re-derives it from a field test. */
export const isMirror = (node: Node): node is MirrorNode => "mirror" in node

/** A node located in the set. The validator, the snapshot and the browser all
 *  need "which file, which line" alongside the record; carrying it beside the
 *  node rather than inside it keeps the record exactly the fields on disk. */
export const Located = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
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
 */
export const targetsOf = (
  node: Node,
): ReadonlyArray<readonly [field: string, id: string]> =>
  isMirror(node)
    ? [["mirror", node.mirror] as const]
    : EDGE_FIELDS.flatMap((field) =>
      (node[field] ?? []).map((id) => [field, id] as const)
    )

/** What a served file is, by its name. An outline is a `.jsonl`, a document is
 *  a `.md`, and anything else is not part of the set.
 *
 *  It lives HERE rather than in whatever happens to read a directory, because
 *  it is a statement about the format: the error that says "no such `.md` file
 *  is served" and the field documented as "every `.jsonl` found" are both in
 *  this package, and phases 3, 4 and 7 each need the same answer for a
 *  different reason. None of them can import the server. */
export type FileKind = "outline" | "document"

export const fileKind = (path: string): FileKind | null =>
  path.endsWith(".jsonl") ? "outline" : path.endsWith(".md") ? "document" : null

/** Where work that is over is put away: one `Archive.jsonl` per directory,
 *  beside the outline it left. The same rule as the racket reference, so a
 *  directory that has been archived from before goes on reading the way it did.
 *
 *  Being archived is a fact about the FILE a node is written in — there is no
 *  field for it, and there is not going to be one, for the reason no derived
 *  state is stored. It lives here beside {@link fileKind} because it is the
 *  same kind of statement (what a served file IS, by its name) and because
 *  three rules in three packages read it: the op that moves a subtree there;
 *  blockedness, which exempts what has been put away at both ends of an arrow
 *  (./derive.ts); and ./changes.ts, which is what tells a cross-file move that
 *  landed here (*archived*) from one that did not (*moved*). Two spellings
 *  would be two answers about the same file — and the third reader makes that
 *  permanent, since a commit message cannot be corrected after the fact. */
export const ARCHIVE = "Archive.jsonl"

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
export const INBOX = "Inbox.jsonl"

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
 * The file is whichever outline is CALLED `Inbox.jsonl`, wherever it sits, so
 * a directory that already keeps its inbox under `notes/` captures into the
 * file it has rather than growing a second one at the root. Case-insensitively,
 * because it is a name a person typed and `inbox.jsonl` is the same intention.
 *
 * SHALLOWEST WINS, then path order — one answer, and a stable one, for the
 * directory that somehow holds two. "First in path order" would let a file
 * three directories down claim the capture from the obvious one beside it.
 */
export const inboxIn = (files: ReadonlyArray<string>): string | undefined =>
  files
    .filter((file) => basenameOf(file).toLowerCase() === INBOX.toLowerCase())
    .sort((a, b) => depthOf(a) - depthOf(b) || (a < b ? -1 : a > b ? 1 : 0))
    .at(0)

const basenameOf = (file: string): string => file.slice(file.lastIndexOf("/") + 1)

const depthOf = (file: string): number => file.split("/").length
