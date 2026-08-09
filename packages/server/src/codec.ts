/**
 * The seam where the generic store meets the outline format.
 *
 * This is the only place the two know about each other, and it is four
 * bindings with no branch of its own. Everything it would otherwise have to
 * decide — which files belong to the set, how decoded files become one set,
 * how failures join — is a statement about the format and lives in
 * `@olai/format`, where phases 3, 4 and 7 can reach it too. If a rule ever
 * appears in this file, the one-validator rule has been broken.
 */

import {
  assemble,
  compareErrors,
  type DecodedFile,
  fileKind,
  type OutlineError,
  type OutlineSet,
  parseOutline,
  validate,
} from "@olai/format"
import type { Codec } from "@olai/store"
import { Result } from "effect"

export const codec: Codec<DecodedFile, OutlineSet, ReadonlyArray<OutlineError>> = {
  match: (path) => fileKind(path) !== null,

  decode: (path, contents) =>
    fileKind(path) === "document"
      ? Result.succeed({ kind: "document" })
      : Result.map(
        parseOutline(path, contents),
        (outline) => ({ kind: "outline", outline }) as const,
      ),

  validate: (files) => validate(assemble(files)),

  /** Several files' failures, as one list in reading order: concatenated and
   *  re-sorted so the report reads top to bottom whatever order the files were
   *  read in. */
  combine: (errors) => errors.flat().sort(compareErrors),
}
