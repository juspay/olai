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
  bodyKind,
  type DecodedFile,
  fileKind,
  isKept,
  type OutlineError,
  type OutlineSet,
  parseOutline,
  validate,
} from "@olai/format"
import type { Codec } from "@olai/store"
import { Result } from "effect"

export const codec: Codec<DecodedFile, OutlineSet, ReadonlyArray<OutlineError>> = {
  match: (path) => fileKind(path) !== null,

  /** A file whose content the set does not KEEP decodes to its path and
   *  nothing else, and the store never reads it — which is the whole of what
   *  this member buys: a vault of saved pages is not read at boot, not re-read
   *  when one of them changes, and not held for the life of the process.
   *
   *  WHICH files those are is the registry's answer again (`@olai/format`'s
   *  `kinds.ts`), asked of the kind this path already is. What a reader who
   *  OPENS one gets is a body read then and there and kept by nobody
   *  (`@olai/server`'s `bodies.ts`); what the SET gets is the path, which is
   *  all a `doc` reference was ever checked against. */
  byName: (path) => {
    const kind = fileKind(path)
    return kind === null || isKept(kind)
      ? null
      : Result.succeed({ file: path, text: null })
  },

  /** A BODIED file decodes to its text, verbatim: what it says is interpreted
   *  at view time, so there is nothing to parse here and nothing that can fail.
   *  It is carried rather than dropped because it is content of the served
   *  directory the same way a note is (`@olai/format`'s `Document`), and this
   *  is the read path that already re-reads only what changed.
   *
   *  WHICH files those are is the registry's answer and not this file's
   *  (`@olai/format`'s `kinds.ts`): a kind whose content is a body decodes to
   *  its bytes, and everything else is an outline to parse. A branch spelled
   *  here would be the second answer to a question the format already
   *  settles — and the way that reads is a file parsed as records nobody wrote
   *  as records. */
  decode: (path, contents) =>
    bodyKind(path) !== null
      ? Result.succeed({ file: path, text: contents })
      : parseOutline(path, contents),

  /** Failures included: whether an unreadable file is a hole the rest of the
   *  set renders around or a reason to hold the last good snapshot is a
   *  question about the FORMAT, so `assemble` carries them in and `validate`
   *  answers it. */
  validate: (files) => validate(assemble(files)),

  /** The store's own failure — the directory would not be listed, a file would
   *  not be read — said in the format's vocabulary, so it travels the channel
   *  a validation error travels and lands under the same banner. Its `line` is
   *  0 because there is no record to point at: the site is the path itself. */
  unreadable: (failure) => [{
    file: failure.path,
    line: 0,
    code: "unreadable-directory",
    message:
      `${failure.message} — the outline below is the last one that loaded, and it will catch up on its own once the directory can be read again.`,
  }],
}
