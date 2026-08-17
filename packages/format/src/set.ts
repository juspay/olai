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
import { byPath } from "./paths.ts"

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
  /** Every `.olai` found, in path order — put there by {@link assemble} rather
   *  than inherited from whoever handed the files over, so the order is the
   *  same whichever caller assembled the set. Including any that hold no nodes
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
 * What one decoded file contributes to the set's records — nothing for a
 * document, and nothing for a file that did not parse.
 *
 * {@link assemble}'s per-file answer, asked one file at a time, and here rather
 * than at the asker for that reason: which files hold records is this module's
 * sentence, and a second reading of it somewhere above would be a caller
 * deciding for itself that a `.md` holds none. What asks is the store's codec,
 * building the delta a patched validation takes ({@link ./patch.ts}) out of the
 * files a probe re-decoded — the same values `assemble` reads, one path at a
 * time instead of all of them.
 *
 * `undefined` answers the same as a failure: a path the map does not hold
 * contributes no records, which is what the delta means by a file with none.
 */
export const nodesIn = <E>(
  decoded: Result.Result<DecodedFile, E> | undefined,
): ReadonlyArray<Located> =>
  decoded === undefined || Result.isFailure(decoded) || isDocument(decoded.success)
    ? []
    : decoded.success.nodes

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
 *
 * IN PATH ORDER ({@link ./paths.ts}'s `byPath`), and it sorts for itself rather
 * than inheriting that from whoever built the map. {@link OutlineSet.files}
 * promises it, `nodes` follows it file by file, and every reader spends it:
 * `list_outlines` answers in it,
 * a search tie breaks on it, the sidebar draws it. Until #208 the promise held
 * only because the one caller in the tree walks a directory in sorted order —
 * so a caller that built its map any other way got a set that broke the
 * promise silently, and the write gate was exactly such a caller: it assembles
 * the last probe's files with the written ones swapped in, which puts a path
 * that did not exist before at the END of the map and, for a file sorting
 * first, at the wrong end of the published list. Sorting here makes the
 * documented order a fact about `assemble` rather than a fact about its
 * callers, and makes the set a function of the map's ENTRIES rather than of the
 * order they were put in.
 *
 * WHICH order that is stopped being a plain `.sort()` in slice 4 of
 * `model-indices`: the promise was always the WALK's, and a bare code-point
 * sort keeps it for every pair of paths except the one where a file and a
 * directory share a name — which is exactly the pair a patched view and a
 * client's own sort came to disagree about ({@link ./paths.ts}).
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
  //
  // The paths are put in order FIRST, so every list below comes out in it and
  // none of them has to be sorted afterwards — `nodes` in particular could not
  // be, since its order is file order and then line order within a file.
  for (const path of [...files.keys()].sort(byPath)) {
    const decoded = files.get(path)!
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
