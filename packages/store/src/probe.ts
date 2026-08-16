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
 * A third thing is skipped one step earlier, and it is not about what changed:
 * a file the codec decodes from its NAME ({@link Codec.byName}) is stamped and
 * diffed like every other, and never opened.
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

/**
 * What one probe found, and what MOVED to make it that.
 *
 * The diff is not a second walk over the result: it is the stamp comparison the
 * probe already does, kept instead of thrown away. `changed` is what was
 * re-decoded (a new file included, since a file with no stamp is stale by
 * definition) and `removed` is what the listing no longer holds — the same
 * size-check deletion the `settled` test below is asked off.
 *
 * It is PATH talk, not content talk, which is what keeps it in a package that
 * knows nothing about outlines: a consumer that publishes per file learns which
 * files to publish without re-deriving it from a value it was handed whole.
 */
export interface Found<F, E> {
  readonly files: Decoded<F, E>
  /** Re-decoded this probe, in listing order. */
  readonly changed: ReadonlyArray<string>
  /** Gone from the listing since the last probe. */
  readonly removed: ReadonlyArray<string>
}

export interface Probe<F, E> {
  readonly run: Effect.Effect<Found<F, E> | null, PlatformFailure>
  /** What the last probe decoded, without going near the disk — empty before
   *  the first one. The write gate needs it: a commit validates the set it
   *  WOULD produce, which is this map with the changed files swapped in, and
   *  asking the disk again for the files it is not touching would be a second
   *  read of the same bytes with a race in between. */
  readonly current: Effect.Effect<Decoded<F, E>>
  /** Whether the last probe FOUND this file — membership, answered without
   *  copying the table {@link current} would hand over. It is what makes an
   *  on-demand read of one file ({@link Store.body}) a read of the SET rather
   *  than of the disk: a path nothing listed is not a file of this store,
   *  whether it was pruned, never claimed by the codec, or spelled to climb out
   *  of the root altogether. */
  readonly holds: (path: string) => Effect.Effect<boolean>
  /** Forget these files' stamps, so the next {@link run} re-reads them
   *  whatever the file system says about mtime and size.
   *
   *  This is what makes a commit's own write visible. Stamps are mtime+size
   *  (a deliberately coarse, cheap comparison — see {@link ./disk.ts}), and a
   *  write that lands in the same second at the same length is exactly the
   *  case they cannot see. For a change that arrived from OUTSIDE that is the
   *  accepted trade; for one this process just made it is not, because a
   *  browser waiting on the frame would never get it. */
  readonly forget: (paths: Iterable<string>) => Effect.Effect<void>
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
      current: Effect.map(
        Ref.get(cache),
        (cached) =>
          new Map(
            [...(cached ?? [])].map(([path, { decoded }]) => [path, decoded]),
          ),
      ),

      holds: (path: string) =>
        Effect.map(Ref.get(cache), (cached) => cached?.has(path) === true),

      forget: (paths: Iterable<string>) =>
        Ref.update(cache, (cached) => {
          if (cached === null) return null
          const kept = new Map(cached)
          for (const path of paths) kept.delete(path)
          return kept
        }),

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

        // ONE answer per stale file: what it decodes to, or `null` for one that
        // was deleted between the stat and the read.
        const fresh = new Map<string, Result.Result<F, E> | null>()
        // The ones the codec answers for by NAME are answered first and never
        // reach the disk at all — not at boot, not when they change
        // ({@link Codec.byName}). Taken out of the list BEFORE the reads rather
        // than resolved inside them: they need no file opened, so they should
        // not be waiting on a permit from a pool that is there to bound how
        // many files are open at once.
        const opening: Array<string> = []
        for (const [path] of stale) {
          const named = codec.byName?.(path) ?? null
          if (named === null) opening.push(path)
          else fresh.set(path, named)
        }
        for (
          const [path, contents] of yield* Effect.forEach(
            opening,
            (path) => Effect.map(disk.read(path), (contents) => [path, contents] as const),
            { concurrency: 16 },
          )
        ) {
          fresh.set(path, contents === null ? null : codec.decode(path, contents))
        }

        const next = new Map<string, Cached<F, E>>()
        const changed: Array<string> = []
        for (const [path, stamp] of stamps) {
          const decoded = fresh.get(path)
          if (decoded === undefined) {
            // Not stale: keep what it decoded to, and the stamp that says so.
            const cached = previous?.get(path)
            if (cached !== undefined) next.set(path, { stamp, decoded: cached.decoded })
            continue
          }
          // Read back as gone — it was deleted between the stat and the read.
          // Leaving it out is what the next probe would conclude anyway, and it
          // is a REMOVAL rather than a change, which the loop below sees.
          if (decoded === null) continue
          next.set(path, { stamp, decoded })
          changed.push(path)
        }
        // Off the same map the decode loop just built, so "gone" cannot mean
        // one thing here and another there: anything the last probe held that
        // this one does not is removed, whether the listing lost it or the read
        // did.
        const removed: Array<string> = []
        for (const path of previous?.keys() ?? []) {
          if (!next.has(path)) removed.push(path)
        }

        yield* Ref.set(cache, next)
        return {
          files: new Map([...next].map(([path, { decoded }]) => [path, decoded])),
          changed,
          removed,
        }
      }),
    }),
  )

