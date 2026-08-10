/**
 * The seam where the generic store meets the outline format.
 *
 * This is the only place the two know about each other, and it is four
 * bindings with no branch of its own. Everything it would otherwise have to
 * decide — which files belong to the set, how decoded files become one set,
 * how failures join — is a statement about the format and lives in
 * `@olai/format`, where every layer above can reach it too. If a rule ever
 * appears in this file, the one-validator rule has been broken.
 *
 * It lives in the OPS package rather than in the server because this is where
 * the joint belongs: ops is the layer that holds `format` and `store` at once
 * (see {@link ./deps.ts}), and the write gate validates through this same
 * codec on every commit. The server composes what is already joined.
 */

import {
  assemble,
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
      ? Result.succeed(null)
      : parseOutline(path, contents),

  /** Failures included: whether an unreadable file is a hole the rest of the
   *  set renders around or a reason to hold the last good snapshot is a
   *  question about the FORMAT, so `assemble` carries them in and `validate`
   *  answers it. */
  validate: (files) => validate(assemble(files)),
}
