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
  type Document,
  type Outline,
  type OutlineError,
  type OutlineSet,
  parseOutline,
  validate,
} from "@olai/format"
import type { Codec } from "@olai/store"
import { Result } from "effect"

/** What one matched file decodes to. `.md` files are part of the set because
 *  `doc` points into them — a reference the validator cannot see is one it
 *  cannot check — and their text is dropped because the path is all `doc`
 *  needs. Rendering documents is phase 7's problem, and it will read them
 *  then. */
export type File =
  | { readonly kind: "outline"; readonly outline: Outline }
  | { readonly kind: "document"; readonly document: Document }

const isDocument = (path: string): boolean => path.endsWith(".md")

export const codec: Codec<File, OutlineSet, ReadonlyArray<OutlineError>> = {
  match: (path) => path.endsWith(".jsonl") || isDocument(path),

  decode: (path, contents) =>
    isDocument(path)
      ? Result.succeed({ kind: "document", document: { file: path } })
      : Result.map(
        parseOutline(path, contents),
        (outline) => ({ kind: "outline", outline }) as const,
      ),

  validate: (files) => {
    const outlines: Array<Outline> = []
    const documents: Array<Document> = []
    for (const file of files.values()) {
      if (file.kind === "outline") outlines.push(file.outline)
      else documents.push(file.document)
    }
    return validate({ outlines, documents })
  },
}

/** Several files' failures, as one list in reading order. The store cannot
 *  know how to join an `E`; for olai an `E` is a list of located errors, and
 *  joining them is concatenating and re-sorting so the report reads top to
 *  bottom whatever order the files were read in. */
export const combine = (
  errors: ReadonlyArray<ReadonlyArray<OutlineError>>,
): ReadonlyArray<OutlineError> => errors.flat().sort(compareErrors)
