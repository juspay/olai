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

import { Result, Schema } from "effect"

import { Document } from "./documents.ts"
import { OutlineError } from "./errors.ts"
import { bodyKind } from "./kinds.ts"
import { Located } from "./node.ts"

/**
 * A file of the set that could not be read, and why.
 *
 * It rides in the SET rather than only in the error report because the two
 * answer different questions. The report is "what must be fixed"; this is
 * "what does `pantry.olai` show" — and the answer, for a file whose lines do
 * not parse, is its own errors, in place, while every other outline stays live
 * (the hybrid error scope, resolved 2026-08-09). A view that had only the
 * report would have to guess which outline a `file:line` belonged to and hope
 * the two lists agreed.
 */
export const BrokenFile = Schema.Struct({
  file: Schema.String,
  errors: Schema.Array(OutlineError),
})
export type BrokenFile = typeof BrokenFile.Type

export const OutlineSet = Schema.Struct({
  /** Every `.olai` found, in path order — including any that hold no nodes
   *  and any that did not parse, which is why this is not derived from
   *  `nodes`. */
  files: Schema.Array(Schema.String),
  nodes: Schema.Array(Located),
  /** Every BODIED file found — each `.md` and each `.html` — with its text, or
   *  with `null` for a body the set does not keep ({@link ./documents.ts}).
   *  Every one of them is HERE, whichever it is, because `doc` points into
   *  them: a reference the validator cannot see is one it cannot check, and
   *  what checking one needs is the path. A document's text rides along beside
   *  it because it is the same kind of thing a note is — content of the
   *  directory, read by the same probe and published in the same revision. The
   *  field keeps the name it has on the wire. */
  documents: Schema.Array(Document),
  /** The files above that did not parse. Their nodes are absent from `nodes`,
   *  which is exactly what makes the rest of the set renderable. */
  broken: Schema.Array(BrokenFile),
})
export type OutlineSet = typeof OutlineSet.Type

/** One file's worth of nodes, in file order — the codec's per-file unit, which
 *  the store caches and re-decodes independently. It is not what the browser
 *  receives; {@link OutlineSet} is. */
export interface Outline {
  readonly file: string
  readonly nodes: ReadonlyArray<Located>
}

/** What one file decoded to: an outline's nodes, or a document's text.
 *
 *  It carries no tag saying which it is. `fileKind` already answers that from
 *  the path, and `decode` branched on that same answer to produce this — so a
 *  tag would be a second answer that could disagree with the name. */
export type DecodedFile = Outline | Document

/** Which arm a decoded file is — named, like this package's other two-shape
 *  decision (`isMirror`, {@link ./node.ts}), rather than spelled as a field
 *  test wherever it is wanted. It reads BACK what `fileKind` already decided:
 *  `decode` branched on the path to produce this value, so the shape is that
 *  answer in another form and not a second one. */
const isDocument = (decoded: DecodedFile): decoded is Document => "text" in decoded

/**
 * Decoded files into the set the validator judges.
 *
 * The assembly is a statement about the format — which files are outlines,
 * where their nodes go, what counts as a document — so it lives beside the
 * rules rather than in whatever read the directory. A caller supplies bytes
 * and gets back the one shape everything above it renders.
 *
 * A file that FAILED to decode is still a file that was found: it keeps its
 * place in `files` (the sidebar lists it; a fix will fill it in) or in
 * `documents`, and its errors go to `broken`. Only its nodes are missing, and
 * that is the whole of what one unreadable file costs the set.
 */
export const assemble = (
  files: ReadonlyMap<string, Result.Result<DecodedFile, ReadonlyArray<OutlineError>>>,
): OutlineSet => {
  const outlines: Array<string> = []
  const nodes: Array<Located> = []
  const documents: Array<Document> = []
  const broken: Array<BrokenFile> = []

  // Two questions per file, and they are answered from two different places
  // because two different things know them. WHICH LIST a file belongs to is its
  // NAME's answer — a file that would not decode has no value to ask, and it
  // still has to keep its place. WHAT IT HOLDS is the VALUE's answer, and the
  // value is the only thing that has it.
  for (const [path, decoded] of files) {
    if (Result.isFailure(decoded)) {
      broken.push({ file: path, errors: decoded.failure })
      if (bodyKind(path) !== null) documents.push({ file: path, text: "" })
      else outlines.push(path)
      continue
    }
    const value = decoded.success
    // The path is the caller's listing rather than the value's idea of itself:
    // one of them is where the file was found, and that is the one every other
    // list here is built from.
    if (isDocument(value)) documents.push({ file: path, text: value.text })
    else {
      outlines.push(path)
      nodes.push(...value.nodes)
    }
  }
  return { files: outlines, nodes, documents, broken }
}
