/**
 * One line of an outline: one node, as a record.
 *
 * The field set and its canonical order are fixed by docs/format.md. Order is
 * a *writing* rule — diffs stay stable because writers always re-serialise in
 * it — but the declaration below keeps it anyway, so the one place a reader
 * looks for "what fields exist" is also the one place a writer will look for
 * "in what order".
 *
 * Which fields are required is read off that spec's own table: it calls out
 * "absent at top level" for `parent` and nothing of the sort for `id`, `ord`
 * and `title`, so those three are required on a regular node. A mirror is the
 * one other record shape, and it is exclusive: `{id, parent?, ord, mirror}`
 * and nothing else. That exclusivity is not expressible as a struct — it is a
 * rule about which fields may co-occur — so it lives in the validator with the
 * other rules rather than being smuggled into a union whose failure message
 * would name neither shape.
 */

import { Schema } from "effect"

/** `true`, or the ISO date/datetime the state was reached at. */
const Marker = Schema.Union([Schema.Literal(true), Schema.String])

export const Node = Schema.Struct({
  id: Schema.String,
  parent: Schema.optionalKey(Schema.String),
  ord: Schema.String,
  title: Schema.optionalKey(Schema.String),
  done: Schema.optionalKey(Marker),
  doing: Schema.optionalKey(Marker),
  date: Schema.optionalKey(Schema.String),
  desc: Schema.optionalKey(Schema.String),
  doc: Schema.optionalKey(Schema.String),
  after: Schema.optionalKey(Schema.Array(Schema.String)),
  blocks: Schema.optionalKey(Schema.Array(Schema.String)),
  see: Schema.optionalKey(Schema.Array(Schema.String)),
  mirror: Schema.optionalKey(Schema.String),
})
export type Node = typeof Node.Type

/** `title` is optional in the struct above and required by the validator, so
 *  that a mirror — which may not carry one — and a regular node without one
 *  get the message each deserves instead of a shared "expected string". */
export const isMirror = (node: Node): boolean => node.mirror !== undefined

/** The fields a mirror record may carry. Everything else on a mirror is an
 *  error: a mirror is a *placement* of an existing node, so any field that
 *  would describe the node itself has an authoritative copy at the target. */
export const MIRROR_FIELDS: ReadonlySet<string> = new Set([
  "id",
  "parent",
  "ord",
  "mirror",
])

/** A node located in the set. The validator, the store snapshot and the
 *  browser all need "which file, which line" alongside the record; carrying it
 *  beside the node rather than inside it keeps the record exactly the fields
 *  that are on disk. */
export const Located = Schema.Struct({
  file: Schema.String,
  line: Schema.Int,
  node: Node,
})
export type Located = typeof Located.Type

/** Ids are slugs — a chosen name or a minted short string. The shape is
 *  checked rather than assumed because ids appear in URLs, in `#tag`-adjacent
 *  text and as bare wire keys. */
export const ID_SHAPE = /^[A-Za-z0-9_-]+$/

/** The edge fields, and the order the validator reports them in. `blocks` is
 *  sugar — `a blocks b` means `b after a` — so it is normalised into `after`
 *  before the acyclicity check, and only there. */
export const EDGE_FIELDS = ["after", "blocks", "see"] as const
export type EdgeField = (typeof EDGE_FIELDS)[number]
