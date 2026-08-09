/**
 * The loaded set: what one served directory amounts to once it is read and
 * found valid.
 *
 * It is FLAT. Every `Located` already carries the file it came from, so
 * grouping the nodes by file as well would be the same fact twice — and every
 * consumer that tried it ended up flattening the groups back out and
 * re-filtering by `located.file` anyway. `files` is the list the sidebar
 * shows; the nodes are one list, the way every rule and every walk wants them.
 *
 * These are Schemas rather than plain interfaces because the set is what the
 * browser subscribes to — it travels the wire verbatim. Nothing is projected
 * or re-shaped on the way out: the client renders the same records the
 * validator approved, and derives everything else with the same functions the
 * validator used ({@link ./derive.ts}).
 */

import { Schema } from "effect"

import { Located } from "./node.ts"

export const OutlineSet = Schema.Struct({
  /** Every `.jsonl` found, in path order — including any that hold no nodes,
   *  which is why this is not derived from `nodes`. */
  files: Schema.Array(Schema.String),
  nodes: Schema.Array(Located),
  /** Every `.md` found. Documents are part of the set because `doc` points
   *  into them: a reference the validator cannot see is one it cannot check.
   *  Their text is not carried — nothing renders a document yet, and the path
   *  is the whole of what `doc` needs. */
  documents: Schema.Array(Schema.String),
})
export type OutlineSet = typeof OutlineSet.Type

/** One file's worth of nodes, in file order — the codec's per-file unit, which
 *  the store caches and re-decodes independently. It is not what the browser
 *  receives; {@link OutlineSet} is. */
export interface Outline {
  readonly file: string
  readonly nodes: ReadonlyArray<Located>
}
