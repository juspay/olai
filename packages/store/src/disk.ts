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
 * Three edges are handled here rather than upstairs, because all three are
 * facts about disks rather than about stores:
 *
 *   - Paths coming out are root-relative and spelled with `/`, whatever the
 *     platform's separator is. The walk joins bare entry names with `/` and
 *     converts back through the Path service only to touch the disk, so
 *     everything above — a codec's `match`, a `file:line` a consumer prints —
 *     reads the same everywhere, with no ambient `process.platform` anywhere.
 *   - The walk PRUNES. See {@link pruned}: a served directory is a working
 *     tree, and the probe must not be at its most expensive exactly when git
 *     is busy.
 *   - A file that has VANISHED between two syscalls is not an error. A probe
 *     races every writer on the machine; "it was listed, then it was not there"
 *     is the normal outcome of a `git checkout`, and the next probe is what
 *     settles it. Every other failure is real and propagates.
 *
 * Writing is two verbs rather than one, and the split is the whole safety
 * property: {@link Disk.stage} puts bytes on disk beside their destination
 * without anybody being able to read them there, and {@link Disk.publish}
 * renames one over the other in a single syscall. A reader — the probe, an
 * editor, `git status` — sees the old file or the new one and never a partial
 * write. Same directory, because a rename across file systems is a copy.
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
  /** Write `contents` to a temp file BESIDE `path`, and answer with the temp's
   *  own root-relative path. Nothing about `path` has changed yet. The name is
   *  a dot-file with no `.jsonl` or `.md` suffix, so no codec claims it and the
   *  listing walks straight past it. */
  readonly stage: (
    path: string,
    contents: string,
  ) => Effect.Effect<string, PlatformFailure>
  /** Rename a staged file over its destination. One syscall: a reader sees the
   *  old bytes or the new ones. */
  readonly publish: (
    staged: string,
    path: string,
  ) => Effect.Effect<void, PlatformFailure>
  /** Best-effort removal of a staged file that will never be published. A miss
   *  is not a failure — the point is to leave no litter, not to prove it. */
  readonly discard: (staged: string) => Effect.Effect<void>
  /** Absolute, platform-spelled — for a consumer that has to hand a path to
   *  something outside this process (the post-publish hook shelling out to
   *  git). Nothing inside the store uses it. */
  readonly resolve: (path: string) => string
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

    /** One directory's entries, as root-relative `/`-spelled paths. */
    const entriesOf = (directory: string) => {
      const read = fs.readDirectory(absolute(directory)).pipe(
        Effect.map((entries) =>
          entries
            .map((entry) => (directory === "" ? entry : `${directory}/${entry}`))
            .sort()
        ),
      )
      return (
        // A SUBdirectory that went away mid-walk contributes nothing, for the
        // same reason a file that did: the next probe settles it. The ROOT is
        // not that case — if it is not there, there is no set to be had and
        // the caller has to hear so rather than be told the directory is
        // empty.
        directory === ""
          ? read
          : Effect.catchIf(read, vanished, () => Effect.succeed<Array<string>>([]))
      ).pipe(
        Effect.mapError((cause) =>
          new PlatformFailure({ path: directory === "" ? root : directory, cause })
        ),
      )
    }

    const listing = (match: (path: string) => boolean) =>
      Effect.gen(function*() {
        // Walked a directory at a time rather than with one recursive read,
        // because the walk has to be able to STOP. A served directory is
        // somebody's working tree: `.git` alone is tens of thousands of
        // entries that no `match` can ever claim, it is written to by every
        // git command, and the watcher fires on all of it — so an unpruned
        // probe would do its most expensive work precisely when git is busy.
        // `match` cannot help; it is asked about files, and by then the cost
        // has been paid.
        const stamps = new Map<string, Stamp>()

        const descend = (directory: string): Effect.Effect<void, PlatformFailure> =>
          Effect.gen(function*() {
            const entries = yield* entriesOf(directory)

            // One stat per entry, concurrently, because this is latency in
            // front of every update: nothing is published until the last is
            // back. Bounded so a large directory does not open every
            // descriptor at once, and `Effect.forEach` preserves input order,
            // so the map is built in the sorted order `validate` then sees.
            const found = yield* Effect.forEach(
              entries,
              (path) =>
                fs.stat(absolute(path)).pipe(
                  Effect.catchIf(vanished, () => Effect.succeed(null)),
                  Effect.map((info) => [path, info] as const),
                  Effect.mapError((cause) => new PlatformFailure({ path, cause })),
                ),
              { concurrency: 16 },
            )

            // Depth-first, in sorted order, so the map reads down the tree the
            // way a listing of it does — which is the order `files` promises
            // and the sidebar shows.
            for (const [path, info] of found) {
              if (info === null) continue
              if (info.type === "Directory") {
                if (!pruned(path)) yield* descend(path)
                continue
              }
              // A file the codec does not claim is not in the set; neither is a
              // socket someone left lying about.
              if (info.type === "File" && match(path)) stamps.set(path, stampOf(info))
            }
          })

        yield* descend("")
        return stamps
      })

    const read = (path: string) =>
      fs.readFileString(absolute(path)).pipe(
        Effect.catchIf(vanished, () => Effect.succeed(null)),
        Effect.mapError((cause) => new PlatformFailure({ path, cause })),
      )

    const watch = fs.watch(root, { recursive: true }).pipe(
      Stream.map(() => undefined),
      Stream.mapError((cause) => new PlatformFailure({ path: root, cause })),
    )

    let staged = 0
    const stage = (path: string, contents: string) =>
      Effect.gen(function*() {
        const cut = path.lastIndexOf("/")
        const directory = cut === -1 ? "" : path.slice(0, cut)
        // A file the set has never held — the first `Archive.jsonl` — may name
        // a directory that is not there. Making it is part of writing it.
        if (directory !== "") yield* fs.makeDirectory(absolute(directory), { recursive: true })
        // Unique per call as well as per process: one commit stages several
        // files, and two commits can be queued behind the same permit.
        const temp = `${directory === "" ? "" : `${directory}/`}.olai-${process.pid}-${staged++}.tmp`
        yield* fs.writeFileString(absolute(temp), contents)
        return temp
      }).pipe(Effect.mapError((cause) => new PlatformFailure({ path, cause })))

    const publish = (from: string, to: string) =>
      fs.rename(absolute(from), absolute(to)).pipe(
        Effect.mapError((cause) => new PlatformFailure({ path: to, cause })),
      )

    const discard = (path: string) => Effect.ignore(fs.remove(absolute(path)))

    return { listing, read, watch, stage, publish, discard, resolve: absolute }
  })

/** Directories the walk does not enter.
 *
 *  A served directory is somebody's working tree, and the two things reliably
 *  under one are `.git` and `node_modules` — enormous, machine-owned, and
 *  incapable of holding a file any codec would claim. Dot-directories in
 *  general are the same bargain: whoever put one there did not mean it as
 *  content. (Only SUBdirectories are judged, so serving `~/.notes` itself is
 *  unaffected.) A codec that ever wants one of these can be given a say; until
 *  then, one rule beats a knob nobody sets. */
const pruned = (path: string): boolean => {
  const name = path.slice(path.lastIndexOf("/") + 1)
  return name.startsWith(".") || name === "node_modules"
}

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
