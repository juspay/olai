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
  admits,
  assemble,
  bodiedDocument,
  bodyKind,
  type Document,
  fileKind,
  nodesIn,
  parseOutline,
  type Reading,
  unkept,
  validate,
  type Verdict,
  verdictOf,
} from "@olai/format"
import type { Codec } from "@olai/store"
import { Result } from "effect"

export const codec: Codec<Document, Reading, Verdict> = {
  match: (path) => fileKind(path) !== null,

  /** A file whose content the set does not KEEP decodes to its path and
   *  nothing else, and the store never reads it — which is the whole of what
   *  this member buys: a vault of saved pages is not read at boot, not re-read
   *  when one of them changes, and not held for the life of the process.
   *
   *  WHICH files those are is the registry's answer again (`@olai/format`'s
   *  `unkept`, which every layer that asks this asks). What a reader who
   *  OPENS one gets is a body read then and there and kept by nobody
   *  (`@olai/server`'s `bodies.ts`); what the SET gets is the path, which is
   *  all a `doc` reference was ever checked against. */
  byName: (path) => unkept(path) ? Result.succeed(bodiedDocument(path, null)) : null,

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
      ? Result.succeed(bodiedDocument(path, contents))
      // A VERDICT either way, which is what the store's `E` is: the parser
      // judges one file and `validate` below judges the set, and a caller
      // handed the two on one channel should not have to know which half
      // spoke. `verdictOf` is the format's one constructor for it.
      : Result.mapError(parseOutline(path, contents), verdictOf),

  /** Failures included: whether an unreadable file is a hole the rest of the
   *  set renders around or a reason to hold the last good snapshot is a
   *  question about the FORMAT, so `assemble` carries them in and `validate`
   *  answers it.
   *
   *  What a valid set publishes as is the validator's own {@link Reading} — the
   *  set AND the derivation the rules were run over — because the store's `S`
   *  is whatever the codec says a validated set is, and the alternative is
   *  every reader above deriving the corpus a second time from a value that had
   *  just been built and dropped inside this call.
   *
   *  THIS is the validation the write gate pays for once rather than twice
   *  ({@link ../../store/src/store.ts}'s `commit`, which says how), and it used
   *  to be that walk twice per keystroke. What one call costs is no longer one
   *  sentence: handed nothing to follow it is the whole corpus derived and the
   *  whole-set rules run over it, and handed the reading it follows it is
   *  neither. The store states the property generically because it must; the
   *  argument for olai is `docs/brainstorming/model-indices.md`, slice 2.
   *
   *  BOTH HALVES OF THAT ARE THE SECOND ARGUMENT, and passing it is the whole
   *  of what this seam adds. The store says what it last published and which
   *  paths have moved since; the format says what a set means. Between them is
   *  one translation and no rule: each moved path, with the records it decoded
   *  to, is an upsert.
   *
   *  THE DERIVATION IS PATCHED from it (slice 3) — the format's own patcher,
   *  held to `derive` by a property test and free to hand the whole thing back
   *  to `derive` whenever it would rather. AND THE RULES ARE NARROWED OVER IT
   *  (`perf-validate-flip`): since the flip the validator asks what the edit
   *  touched and answers with it, walking the corpus only when there is nothing
   *  to narrow from — which for a codec driven this way is the boot and the
   *  revisions a patch was declined on. So a corpus-sized derivation AND a
   *  corpus-sized set of rules per keystroke both become a walk of what the
   *  keystroke touched, and neither of those is a promise this file makes: it
   *  hands over what it knows and `@olai/format` decides what to do with it. */
  validate: (files, since) =>
    validate(
      assemble(files),
      since === undefined ? undefined : {
        read: since.value,
        // The paths the store names, read out of the very map `assemble` is
        // reading — so the delta and the set it is about cannot be two
        // different accounts of one directory. A path in both lists (deleted
        // out of band, written back by this commit) is a remove the upsert
        // then answers, which is the order a delta is applied in.
        delta: {
          upserts: since.changed.map(
            (file) => [file, { nodes: nodesIn(files.get(file)) }] as const,
          ),
          removes: since.removed,
        },
      },
    ),

  /** The store's own failure — the directory would not be listed, a file would
   *  not be read — said in the format's vocabulary, so it travels the channel
   *  a validation error travels and lands under the same banner. Its `line` is
   *  0 because there is no record to point at: the site is the path itself. */
  unreadable: (failure) =>
    verdictOf([{
      file: failure.path,
      line: 0,
      code: "unreadable-directory",
      message:
        `${failure.message} — the outline below is the last one that loaded, and it will catch up on its own once the directory can be read again.`,
    }]),

  /** A kept file that will not open is a hole, not a banner. The probe
   *  absorbs it; {@link assemble} keeps the file's place; the wire's
   *  `DocumentEntry.refused` is what a face draws. */
  unread: (failure) =>
    Result.fail(verdictOf([{
      file: failure.path,
      line: 0,
      code: "unreadable-file" as const,
      message: `${failure.message} — this file is in the directory and will not open.`,
    }])),

  /**
   * IS THE REFUSAL ABOUT THESE FILES? — the write gate's question, asked of the
   * verdict `validate` above just handed back ({@link @olai/format}'s `admits`).
   *
   * This is the whole of `broken-file-blocks-healthy-writes`. The store judged
   * the set, because a set is what a codec judges; whether the judgement has
   * anything to do with the files a commit is putting down is a different
   * question, and until the verdict had a shape there was nowhere to ask it —
   * so one outline failing typed validation refused an `add_node` into a
   * perfectly healthy file three directories away, and refused it with a
   * sentence that named nothing.
   *
   * NO RULE IS SPELLED HERE, which is this file's standing promise: `admits` is
   * the format's, the paths are the store's, and this line is the two of them
   * meeting. The refusal still stands — the set is still invalid, the last good
   * snapshot still stands, the banner still says so — and the bytes land beside
   * it, which is exactly what a READ of the same directory already gets.
   */
  admits: (refusal, paths) => admits(refusal, paths)._tag === "admitted",
}
