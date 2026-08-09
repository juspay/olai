/**
 * One directory, as the probe is allowed to see it.
 *
 * Three questions and no more: what is under the root right now (with a stamp
 * per file), what is in one of those files, and "something down there moved".
 * The services are resolved ONCE, when the store is built, so everything above
 * this file is `Effect<_, PlatformFailure>` with nothing left in its
 * requirements — a `refresh` a consumer holds should not ask them for a file
 * system.
 *
 * Two edges are handled here rather than upstairs, because both are facts about
 * disks rather than about stores:
 *
 *   - Paths coming out are root-relative and spelled with `/`. `readDirectory`
 *     yields the platform's separator, and every `file:line` a consumer prints
 *     is in `/`, so the conversion happens at this edge — through the same Path
 *     service the bytes come from, not through an ambient `process.platform`.
 *   - A file that has VANISHED between two syscalls is not an error. A probe
 *     races every writer on the machine; "it was listed, then it was not there"
 *     is the normal outcome of a `git checkout`, and the next probe is what
 *     settles it. Every other failure is real and propagates.
 */

import { Effect, FileSystem, Option, Path, type PlatformError, Stream } from "effect"

import { PlatformFailure } from "./errors.ts"

/** What "this file did not change" is decided on: mtime and size, the two the
 *  kernel already knows. Coarse — a same-second rewrite of the same length
 *  slips through — and cheap, which is the trade the design took (resolved
 *  2026-08-09): a content hash reads every file on every probe to catch a case
 *  a settle delay and a backstop already cover. */
export interface Stamp {
  readonly mtime: number
  readonly size: number
}

export const sameStamp = (a: Stamp, b: Stamp): boolean =>
  a.mtime === b.mtime && a.size === b.size

export interface Disk {
  /** Every matching file under the root, in path order, with its stamp. */
  readonly listing: (
    match: (path: string) => boolean,
  ) => Effect.Effect<ReadonlyMap<string, Stamp>, PlatformFailure>
  /** One file's text, or `null` if it is no longer there. */
  readonly read: (path: string) => Effect.Effect<string | null, PlatformFailure>
  /** "Something under the root moved." The event's own payload is DROPPED
   *  here, at the edge, so nothing above can be tempted to believe it: the
   *  pinned watcher discards null filenames of its own accord, inotify
   *  overflows under bursts and FSEvents coalesces under git-sized loads. An
   *  event means "probe soon" and the probe is what decides what happened. */
  readonly watch: Stream.Stream<void, PlatformFailure>
}

export const make = (
  root: string,
): Effect.Effect<Disk, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path_ = yield* Path.Path

    const absolute = (path: string): string =>
      path_.join(root, ...path.split("/"))

    const listing = (match: (path: string) => boolean) =>
      Effect.gen(function*() {
        const entries = yield* fs.readDirectory(root, { recursive: true }).pipe(
          Effect.mapError((cause) => new PlatformFailure({ path: root, cause })),
        )

        const matched = [...entries]
          .sort()
          .map((entry) => entry.split(path_.sep).join("/"))
          .filter(match)

        // Concurrently, because this is latency in front of every update:
        // nothing is published until the last stat is back. Bounded so a large
        // directory does not open every descriptor at once, and
        // `Effect.forEach` preserves input order, so the map is built in the
        // sorted order the codec's `validate` then sees.
        const stamped = yield* Effect.forEach(
          matched,
          (path) =>
            fs.stat(absolute(path)).pipe(
              // A directory that happens to match the codec's rule is not a
              // file of the set; neither is a socket someone left lying about.
              Effect.map((info) =>
                info.type === "File" ? [path, stampOf(info)] as const : null
              ),
              Effect.catchIf(vanished, () => Effect.succeed(null)),
              Effect.mapError((cause) => new PlatformFailure({ path, cause })),
            ),
          { concurrency: 16 },
        )

        return new Map(stamped.filter(isPresent))
      })

    const read = (path: string) =>
      fs.readFileString(absolute(path)).pipe(
        Effect.map((contents): string | null => contents),
        Effect.catchIf(vanished, () => Effect.succeed(null)),
        Effect.mapError((cause) => new PlatformFailure({ path, cause })),
      )

    const watch = fs.watch(root, { recursive: true }).pipe(
      Stream.map(() => undefined),
      Stream.mapError((cause) => new PlatformFailure({ path: root, cause })),
    )

    return { listing, read, watch }
  })

const stampOf = (info: FileSystem.File.Info): Stamp => ({
  mtime: Option.match(info.mtime, {
    onNone: () => 0,
    onSome: (at) => at.getTime(),
  }),
  size: Number(info.size),
})

/** The file was there when the directory was listed and is not there now. */
const vanished = (error: PlatformError.PlatformError): boolean =>
  error.reason._tag === "NotFound"

const isPresent = <A>(entry: A | null): entry is A => entry !== null
