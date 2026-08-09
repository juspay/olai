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

import { fileKind, Located } from "./node.ts"

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

/** What one file decoded to: an outline's nodes, or a document, whose text is
 *  not carried — nothing renders a document yet, and the path is the whole of
 *  what `doc` needs. */
export type DecodedFile =
  | { readonly kind: "outline"; readonly outline: Outline }
  | { readonly kind: "document" }

/**
 * Decoded files into the set the validator judges.
 *
 * The assembly is a statement about the format — which files are outlines,
 * where their nodes go, what counts as a document — so it lives beside the
 * rules rather than in whatever read the directory. A caller supplies bytes
 * and gets back the one shape everything above it renders.
 */
export const assemble = (
  files: ReadonlyMap<string, DecodedFile>,
): OutlineSet => {
  const outlines: Array<string> = []
  const nodes: Array<Located> = []
  const documents: Array<string> = []

  for (const [path, file] of files) {
    if (file.kind === "document") {
      documents.push(path)
      continue
    }
    outlines.push(path)
    nodes.push(...file.outline.nodes)
  }
  return { files: outlines, nodes, documents }
}

/** Re-exported so a reader of the set finds the rule that decides what belongs
 *  in it without leaving this file. */
export { fileKind }
