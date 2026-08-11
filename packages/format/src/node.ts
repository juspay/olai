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

/** The fields both shapes share: identity and placement. */
const Placement = {
  id: Schema.String,
  /** Absent at top level. The only field docs/format.md marks optional for a
   *  regular node — which is how `ord` and `title` below are read as required. */
  parent: Schema.optionalKey(Schema.String),
  /** A fractional index over base62. Plain string comparison is the sort. */
  ord: Schema.String,
}

export const RegularNode = Schema.Struct({
  ...Placement,
  /** Verbatim. Inline `#tags` live here and are extracted at view time. */
  title: Schema.String,
  done: Schema.optionalKey(Marker),
  doing: Schema.optionalKey(Marker),
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
  ...Placement,
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

/**
 * Where an archived subtree goes: beside the outline it left, always by this
 * name — the same rule as the racket reference, so a directory that has been
 * archived from before goes on reading the way it did.
 *
 * Here rather than beside the op that writes it, because two layers need the
 * same answer and they are in different packages: the ops layer DECIDES to move
 * a subtree here, and `./changes.ts` is what tells a cross-file move that
 * landed here (*archived*) from one that did not (*moved*). Two spellings would
 * mean renaming it in one place and silently mislabelling every archive in the
 * panel and in the commit log — permanently, since a commit message cannot be
 * corrected after the fact.
 */
export const ARCHIVE = "Archive.jsonl"
