/**
 * The two-phase codec: the whole of what the store knows about content.
 *
 * It mirrors "parse per line, validate the set". `decode` sees ONE file and is
 * cached against that file's stamp, so a probe re-reads only what changed;
 * `validate` sees ALL of them and is where every cross-file invariant lives.
 * The store never looks inside either half — that line is what keeps olai's
 * one-validator rule intact and what would let this package move to its own
 * repo without a redesign.
 *
 * `validate` takes each file's `Result`, decode FAILURES INCLUDED, rather than
 * a map of the ones that parsed. That is deliberate and it is the whole of the
 * error-scope decision (docs/brainstorming/architecture.live-store.md, resolved
 * 2026-08-09): only the codec knows whether one unreadable file poisons the set
 * or is a hole the rest can be rendered around, so only the codec can decide
 * whether the answer is a published `S` with that failure embedded in it — an
 * outline showing its own error, in place, while its neighbours stay live — or
 * a failure that holds the last good snapshot. A store that filtered the
 * failures out first would have made that decision for every codec, by
 * omission.
 *
 * `unreadable` is the third method and the newest, and it is here for the same
 * reason the other two are: the store has a failure only IT can have — the
 * directory would not be listed, a file would not be read — and only the codec
 * knows how to say that in a vocabulary the caller's own surfaces render.
 */

import type { Result } from "effect"

import type { PlatformFailure } from "./errors.ts"

export interface Codec<F, S, E> {
  /** Which files under the root belong to the set. Paths are relative to the
   *  root and use `/`, so a codec's rules read the same on every platform. */
  readonly match: (path: string) => boolean
  readonly decode: (path: string, contents: string) => Result.Result<F, E>
  /**
   * What a file decodes to from its NAME ALONE — or `null` for one whose bytes
   * the codec needs, which is every file when this member is absent.
   *
   * The store reads a file because the codec is about to be shown it, so this
   * is the one question that can stop the read happening at all: a path this
   * answers for is STATTED like every other file of the set — it is listed, it
   * is stamped, it is `changed` when it moves and gone when it goes — and its
   * contents are never opened. Everything else about it is unchanged, which is
   * what makes this a statement about COST rather than about membership
   * ({@link match} owns that one).
   *
   * It exists because a set can hold a file it does not want to hold the bytes
   * of. olai's is hypertext: a saved page is megabytes, nothing in the set
   * reads it, and the reader who opens one is served by a read of its own. A
   * codec with no such kind omits this and pays nothing.
   */
  readonly byName?: (path: string) => Result.Result<F, E> | null
  /** The whole set, in path order, each file decoded or failed. */
  readonly validate: (
    files: ReadonlyMap<string, Result.Result<F, E>>,
  ) => Result.Result<S, E>
  /**
   * What "the directory itself could not be read" looks like in the caller's
   * own error vocabulary.
   *
   * The store has TWO kinds of error and used to have one channel for them.
   * A set the codec refuses is an `E` and travels — it is what a banner over
   * the last-good tree is drawn from. A {@link PlatformFailure} — EACCES, a
   * mount that vanished, ENOSPC — was neither: it was written to the log and
   * dropped, so the outline froze at the last good revision and every reader
   * went on seeing a page that had quietly stopped being true.
   *
   * The channel is still ONE channel, and it is still typed `E`, because the
   * store cannot know how a caller says things. This is where a caller says
   * this one: the store hands over the failure it has, the codec hands back
   * something its own surfaces already render. It self-clears exactly like a
   * validation failure does — the next probe that publishes clears the errors
   * ref — so "the directory came back" needs nothing written for it here.
   */
  readonly unreadable: (failure: PlatformFailure) => E
}
