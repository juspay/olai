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

import { EDGE_FIELDS, listOf, Props } from "./props.ts"

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
  /**
   * Every FACT about the node that is not its identity, its placement, its
   * name or its prose: the mark and when it was reached, what it is scheduled
   * for, what it points at, and whatever else a writer has put there
   * (`./props.ts`, docs/brainstorming/properties.md).
   *
   * ONE field where there were seven, and the seven are not coming back as
   * keys of a struct: the whole point is that a key needs no declaration, so
   * `isbn` on a book note costs nothing and teaches this file nothing. What
   * olai itself reads is `./props.ts`'s `SYSTEM_KEYS`, which is a list rather
   * than a shape for exactly that reason.
   *
   * Absent, not empty, for a node with no facts on it — a plain bullet — and
   * `./write.ts` is what keeps `{}` off disk.
   */
  props: Schema.optionalKey(Props),
  /** The note: one string, embedded newlines, markdown, stored verbatim. NOT a
   *  property: prose stays prose, and a property value that grows a paragraph
   *  is a smell rather than a note. */
  desc: Schema.optionalKey(Schema.String),
  /** Relative path to an attached `.md`, resolved against this file. */
  doc: Schema.optionalKey(Schema.String),
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

/** The edge keys, re-exported from `./props.ts` where they are declared: they
 *  are entries in the map now rather than fields of this struct, and the list
 *  that says so is the one `SYSTEM_KEYS` is built from. Re-exported here
 *  because {@link targetsOf} below is the reading every consumer of an edge
 *  reaches for, and it should not send them to a second file to learn what an
 *  edge is called. */
export { EDGE_FIELDS, type EdgeField } from "./props.ts"

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
      listOf(node, field).map((id) => [field, id] as const)
    )

/** The suffix an outline wears, and the ONE place it is spelled as a rule.
 *
 *  Five rules read it and they have to agree, because between them they decide
 *  which files are served at all: what {@link fileKind} claims, what
 *  {@link ARCHIVE} and {@link INBOX} are called, what a commit subject strips
 *  to name an outline (`../message.ts`), and what path `create_outline` will
 *  mint (`@olai/ops`' `outlinePath`). Four of those used to retype it. That is
 *  four chances for one of them to be left behind — and the way that failure
 *  reads is not a type error but a file the walk stops claiming, or an op that
 *  refuses a path the sidebar just offered.
 *
 *  It is not a knob. A directory holds one kind of outline and this is what it
 *  is called; the constant exists so the answer is asked for rather than
 *  retyped.
 *
 *  **CODE that DECIDES reads it; PROSE that DESCRIBES spells it out.** The
 *  eighty-odd docstrings, tool descriptions and refusal messages that say
 *  `.olai` in words go on saying it in words — they are read by a person or an
 *  agent, not by a branch, and interpolating a constant into a sentence buys
 *  nothing while costing the one thing a message has: you can grep for it. The
 *  rule is written here because the line between the two is the only thing a
 *  reader would otherwise have to guess at. */
export const OUTLINE_EXT = ".olai"

/** The other kind's, on the same terms: `create_document` mints a path and
 *  {@link fileKind} decides whether the walk will ever claim one, and those two
 *  disagreeing is a document written where nothing reads it back. That the
 *  suffix is not moving today is not a reason for the answer to live twice.
 *
 *  Deliberately NOT `@olai/surface`'s `DOCUMENT_EXTENSIONS`, which answers a
 *  different question — what may be handed to an agent as a path — with five
 *  entries. The one string they share means a different thing on each side. */
export const DOCUMENT_EXT = ".md"

/** What a served file is, by its name. An outline is an {@link OUTLINE_EXT}, a
 *  document is a {@link DOCUMENT_EXT}, and anything else is not part of the set.
 *
 *  It lives HERE rather than in whatever happens to read a directory, because
 *  it is a statement about the format: the error that says "no such `.md` file
 *  is served" and the field documented as "every outline found" are both in
 *  this package, and phases 3, 4 and 7 each need the same answer for a
 *  different reason. None of them can import the server. */
export type FileKind = "outline" | "document"

export const fileKind = (path: string): FileKind | null =>
  path.endsWith(OUTLINE_EXT)
    ? "outline"
    : path.endsWith(DOCUMENT_EXT)
    ? "document"
    : null

/** Where work that is over is put away: one `Archive.olai` per directory,
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
 */
export const inboxIn = (files: ReadonlyArray<string>): string | undefined =>
  files
    .filter((file) => basenameOf(file).toLowerCase() === INBOX.toLowerCase())
    .sort((a, b) => depthOf(a) - depthOf(b) || (a < b ? -1 : a > b ? 1 : 0))
    .at(0)

const basenameOf = (file: string): string => file.slice(file.lastIndexOf("/") + 1)

const depthOf = (file: string): number => file.split("/").length
