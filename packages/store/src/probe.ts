/**
 * The probe: the only source of truth about what is on disk.
 *
 * Re-list the tree, re-stat everything, diff against the stamp table, re-read
 * and re-decode ONLY what the stamps say changed. Nothing here is told what
 * happened — not by a watcher event, not by a write the store itself made — so
 * the probe is idempotent, and the state it produces converges on disk truth
 * after any disturbance whether every event lied or none arrived.
 *
 * The two halves of "what changed" are the two things a store can skip:
 *
 *   - a file whose stamp is unchanged keeps its cached `decode` result, so a
 *     directory of a hundred outlines re-parses the one that was saved;
 *   - a listing identical to the last one produces `null`, so the caller does
 *     not re-validate, does not mint a revision, and does not wake a browser to
 *     tell it nothing happened. That is what makes a backstop every sixty
 *     seconds free.
 *
 * A decode FAILURE is cached exactly like a success: the same bytes fail the
 * same way, and re-deriving that on every probe would make a broken file the
 * most expensive one in the directory.
 */

import { Effect, Ref, type Result } from "effect"

import type { Codec } from "./codec.ts"
import { type Disk, sameStamp, type Stamp } from "./disk.ts"
import type { PlatformFailure } from "./errors.ts"

/** Each file of the set as the codec last saw it. `null` from a probe means
 *  "identical to the previous one" — not "empty". */
export type Decoded<F, E> = ReadonlyMap<string, Result.Result<F, E>>

export interface Probe<F, E> {
  readonly run: Effect.Effect<Decoded<F, E> | null, PlatformFailure>
}

interface Cached<F, E> {
  readonly stamp: Stamp
  readonly decoded: Result.Result<F, E>
}

export const make = <F, S, E>(
  disk: Disk,
  codec: Codec<F, S, E>,
): Effect.Effect<Probe<F, E>> =>
  Effect.map(
    // `null`, not an empty map: an empty directory is a real answer that must
    // be published once, and only "has never been probed" may be indistinct
    // from it.
    Ref.make<ReadonlyMap<string, Cached<F, E>> | null>(null),
    (cache) => ({
      run: Effect.gen(function*() {
        const previous = yield* Ref.get(cache)
        const stamps = yield* disk.listing(codec.match)

        const stale = [...stamps].filter(([path, stamp]) => {
          const cached = previous?.get(path)
          return cached === undefined || !sameStamp(cached.stamp, stamp)
        })
        // Nothing new and nothing gone — so nothing the codec could say has
        // changed. The size check is what catches a DELETION, which leaves no
        // stale entry behind to be noticed by. Asked here, off the one diff,
        // rather than by a second walk that would have to agree with it.
        const settled = previous !== null && stale.length === 0 &&
          previous.size === stamps.size
        if (settled) return null

        const reread = new Map(
          yield* Effect.forEach(
            stale,
            ([path]) =>
              Effect.map(disk.read(path), (contents) => [path, contents] as const),
            { concurrency: 16 },
          ),
        )

        const next = new Map<string, Cached<F, E>>()
        for (const [path, stamp] of stamps) {
          const contents = reread.get(path)
          if (contents === undefined) {
            // Unchanged: keep what it decoded to, and the stamp that says so.
            const cached = previous?.get(path)
            if (cached !== undefined) next.set(path, { stamp, decoded: cached.decoded })
            continue
          }
          // Read back as gone — it was deleted between the stat and the read.
          // Leaving it out is what the next probe would conclude anyway.
          if (contents === null) continue
          next.set(path, { stamp, decoded: codec.decode(path, contents) })
        }

        yield* Ref.set(cache, next)
        return new Map([...next].map(([path, { decoded }]) => [path, decoded]))
      }),
    }),
  )

