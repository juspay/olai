/**
 * The loaded set: what one served directory amounts to once it is read and
 * found valid.
 *
 * These are Schemas rather than plain interfaces because the set is what the
 * browser subscribes to — it travels the wire verbatim. Nothing is projected
 * or re-shaped on the way out: the client renders the same records the
 * validator approved, and derives everything else with the same functions the
 * validator used ({@link ./derive.ts}). A view that received a pre-digested
 * tree would be a second interpretation of the format.
 */

import { Schema } from "effect"

import { Located } from "./node.ts"

/** One `.jsonl` file's worth of nodes, in file order. */
export const Outline = Schema.Struct({
  file: Schema.String,
  nodes: Schema.Array(Located),
})
export type Outline = typeof Outline.Type

/** A `.md` file found under the served directory. Documents are part of the
 *  set because `doc` points into them: a reference the validator cannot see is
 *  a reference it cannot check. Their text is not carried — nothing renders a
 *  document yet, and the path is the whole of what `doc` needs. */
export const Document = Schema.Struct({
  file: Schema.String,
})
export type Document = typeof Document.Type

export const OutlineSet = Schema.Struct({
  outlines: Schema.Array(Outline),
  documents: Schema.Array(Document),
})
export type OutlineSet = typeof OutlineSet.Type
