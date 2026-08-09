/**
 * The seam where the generic store meets the outline format.
 *
 * This is the only place the two know about each other, and it is deliberately
 * boring: `decode` is `parseOutline`, `validate` is `validate`, and neither
 * gets a rule of its own. If a check ever appears in this file, the
 * one-validator rule has been broken and the check belongs in @olai/format.
 */

import {
  compareErrors,
  type Outline,
  type OutlineError,
  type OutlineSet,
  parseOutline,
  validate,
} from "@olai/format"
import type { Codec } from "@olai/store"
import { Result } from "effect"

/** What one matched file decodes to.
 *
 *  `.md` files are part of the set because `doc` points into them — a
 *  reference the validator cannot see is one it cannot check — and their text
 *  is dropped because the path is all `doc` needs. Rendering documents is
 *  phase 7's problem, and it will read them then. */
export type File =
  | { readonly kind: "outline"; readonly outline: Outline }
  | { readonly kind: "document" }

/** What a path is, decided once. The suffix test used to be spelled three
 *  times — in `match`, in `decode` and again in `validate` — which is three
 *  chances for them to answer differently. */
const kindOfPath = (path: string): File["kind"] | null =>
  path.endsWith(".jsonl") ? "outline" : path.endsWith(".md") ? "document" : null

export const codec: Codec<File, OutlineSet, ReadonlyArray<OutlineError>> = {
  match: (path) => kindOfPath(path) !== null,

  decode: (path, contents) =>
    kindOfPath(path) === "document"
      ? Result.succeed({ kind: "document" })
      : Result.map(
        parseOutline(path, contents),
        (outline) => ({ kind: "outline", outline }) as const,
      ),

  validate: (files) => {
    const outlines: Array<string> = []
    const nodes = []
    const documents: Array<string> = []
    for (const [path, file] of files) {
      if (file.kind === "document") {
        documents.push(path)
        continue
      }
      outlines.push(path)
      nodes.push(...file.outline.nodes)
    }
    return validate({ files: outlines, nodes, documents })
  },

  /** Several files' failures, as one list in reading order: concatenated and
   *  re-sorted so the report reads top to bottom whatever order the files were
   *  read in. */
  combine: (errors) => errors.flat().sort(compareErrors),
}
