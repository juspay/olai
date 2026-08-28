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
 * error-scope decision (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/architecture.live-store.md, resolved
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

/**
 * The last verdict, and what has moved since it — what makes the next
 * validation a patch rather than a rebuild ({@link Codec.validate}).
 *
 * The two lists are the probe's own stamp diff ({@link ./probe.ts}), spanning
 * every look at the disk since the value below was published rather than the
 * last one alone: a probe whose set the codec refused published nothing, and
 * the files it re-decoded are still what changed for whoever holds `value`.
 * They are the same lists a snapshot carries for the consumer that publishes
 * per file, arrived at from the same place, so a codec reading them is trusting
 * exactly what the wire already trusts.
 *
 * A path may appear in BOTH — deleted out of band and written back by the same
 * commit — so a reader applies the removals first and the changes after.
 */
export interface Since<S> {
  /** What {@link Codec.validate} answered with, as published. */
  readonly value: S
  /** Re-decoded since then, and therefore possibly different. */
  readonly changed: ReadonlyArray<string>
  /** Gone from the listing since then. */
  readonly removed: ReadonlyArray<string>
}

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
  /**
   * The whole set, each file decoded or failed.
   *
   * WHAT CAME BEFORE is the second argument, and it is an OFFER rather than an
   * instruction: the value this codec last answered with, and every path that
   * has moved since. A codec that can answer incrementally — swap one file's
   * entries in its indexes and leave the rest standing — takes it; one that
   * cannot ignores it and validates the map, and both are correct. Absent means
   * there is nothing to build on: the first load, or a store whose last verdict
   * was a refusal.
   *
   * The store is what can know this and the codec is what can use it. Nothing
   * here looks inside `S`, so what "incrementally" means is entirely the
   * codec's business ({@link ../../format/src/patch.ts} is olai's, and it holds
   * itself to the from-scratch answer with a property test).
   *
   * NO ORDER IS PROMISED, and the correction is one this package owed: it used
   * to say "in path order", which was true of the map a PROBE builds — the
   * walk is depth-first through sorted entries — and never true of the one the
   * write gate builds, which is the last probe's map with the written files
   * swapped in, so a path that did not exist before sits at the end of it. A
   * codec that reads this map in order and publishes what it read would have
   * published two different orders for one directory depending on which of the
   * two called it, which is exactly what olai's did until #208. A codec whose
   * answer has an order imposes that order itself.
   */
  readonly validate: (
    files: ReadonlyMap<string, Result.Result<F, E>>,
    since?: Since<S>,
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
  /**
   * IS THIS WRITE ADMISSIBLE against a set you have already refused?
   *
   * The write gate validates the set a commit WOULD make before it renames
   * anything, and until this member existed a refusal there was the end of it:
   * one file the codec would not accept froze every write to the directory,
   * whatever it touched. That is a whole-set answer to a per-file question, and
   * it is the store that was asking it — the codec had said "this set is not
   * one I can publish", which is true and is not the same sentence.
   *
   * So the store asks the second question here, and only the codec can answer:
   * `refusal` is what {@link validate} just handed back, `paths` are the files
   * THIS write puts down, and the answer is whether the refusal has anything to
   * do with them. `true` lets the bytes land — the set is still refused, the
   * last good snapshot still stands, and the errors channel still carries the
   * refusal — which is exactly what a READ of a broken directory already gets.
   *
   * ABSENT MEANS NO, which is every codec's behaviour before this existed and
   * stays the behaviour of one that omits it. The store looks inside neither
   * `E` nor the files: it hands over what it has and spends the boolean.
   *
   * WHAT IT DOES NOT DECIDE is whether the write is SAFE to make from the base
   * the caller planned against — that is the store's own bookkeeping, and it is
   * checked before this is asked ({@link ./store.ts}'s `commit`). A codec is
   * never handed a question it has no way to answer.
   */
  readonly admits?: (refusal: E, paths: ReadonlyArray<string>) => boolean
  /**
   * One FILE could not be read — EACCES on a `.md`, not the directory itself.
   *
   * Optional because a codec that has no per-file hole (every unread file
   * poisons the set) omits it and the probe fails the whole look, which is
   * {@link unreadable}'s sentence. olai's implements it: a `.md` that will
   * not open is a hole the rest of the set renders around, and the refusal
   * travels on that file's entry rather than as a banner over the directory.
   *
   * Absent, the probe's existing behaviour is unchanged.
   */
  readonly unread?: (failure: PlatformFailure) => Result.Result<F, E>
}
