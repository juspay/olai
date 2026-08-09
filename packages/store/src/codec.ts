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
 */

import type { Result } from "effect"

export interface Codec<F, S, E> {
  /** Which files under the root belong to the set. Paths are relative to the
   *  root and use `/`, so a codec's rules read the same on every platform. */
  readonly match: (path: string) => boolean
  readonly decode: (path: string, contents: string) => Result.Result<F, E>
  /** The whole set, in path order, each file decoded or failed. */
  readonly validate: (
    files: ReadonlyMap<string, Result.Result<F, E>>,
  ) => Result.Result<S, E>
}
