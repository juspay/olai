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
 * Four edges are handled here rather than upstairs, because all four are
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
 *   - The walk also ARMS. A recursive watch does not follow a directory made
 *     after it (see {@link Disk.watch}), and the walk is already the only
 *     thing in here that looks at directories — so it tells the watcher about
 *     the ones it has never seen. The two jobs share one descent because they
 *     would otherwise be the same walk done twice, disagreeing about what is
 *     pruned.
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

import {
  Effect,
  Exit,
  FileSystem,
  Option,
  Path,
  Queue,
  Scope,
  Stream,
} from "effect"

import { PlatformFailure, ROOT_ITSELF, vanished } from "./errors.ts"

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
   *  a dot-file ending in `.tmp`, which no kind of served file is named for
   *  (`@olai/format`'s registry), so no codec claims it and the listing walks
   *  straight past it. */
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
  /**
   * "Something under the root moved." The event's own payload is DROPPED
   * here, at the edge, so nothing above can be tempted to believe it: the
   * pinned watcher discards null filenames of its own accord, inotify
   * overflows under bursts and FSEvents coalesces under git-sized loads. An
   * event means "probe soon" and the probe is what decides what happened.
   *
   * It is not one watcher but one PER DIRECTORY THE ROOT'S CANNOT REACH, and
   * that is a fact about the pinned runtime rather than about watching. See
   * the arming block in {@link make}: a recursive watch registers the tree it
   * is armed on and never follows a directory created afterwards, so the walk
   * arms those as it finds them and their events arrive here beside the
   * root's. Nothing above needs to know — an event still means "probe soon",
   * and it is the probe that turns one into the other.
   */
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
          new PlatformFailure({ path: directory === "" ? ROOT_ITSELF : directory, cause })
        ),
      )
    }

    // ── the watcher, and the tree it cannot see on its own ──────────────
    //
    // `fs.watch(root, { recursive: true })` registers the tree AS IT STANDS
    // when it is armed, and the pinned runtime never follows a directory made
    // afterwards: the `mkdir` is reported, and then every file that lands
    // inside the new directory is silent. Both halves are measured
    // (docs/brainstorming/watcher-fd-cost.md), and the second one is a real
    // minute of nothing happening — make a folder in a served vault, put a
    // note in it, and the page waits for the backstop. It is fixed upstream in
    // a version this repo does not pin, which makes it this package's problem.
    //
    // The WALK is what closes it, because the walk is already the only thing
    // in here that looks at directories: while somebody is watching, one it
    // enters that nothing covers yet gets a watcher of its own. Three
    // orderings carry the whole of the correctness:
    //
    //   - a directory's watcher is STARTED before its entries are listed, so a
    //     file landing in it either wakes the new watcher or is in the listing
    //     that follows — the argument the store's boot makes about the root,
    //     one level down. Started, not proven armed: `cover` returns when the
    //     watching fiber is FORKED, and the subscription that reaches
    //     `fs.watch` happens on that fiber afterwards. A file landing in the
    //     gap between the two can miss both, and that one is the backstop's;
    //   - the tree under a new directory needs no special case. Its own
    //     subdirectories are `mkdir`s, reported by the watcher just armed on
    //     their parent, and the walk that follows arms them in turn;
    //   - the FIRST walk with a watcher live only RECORDS what it finds,
    //     because that tree is the one the root's recursive watch already
    //     holds and arming a second watcher over every directory of it would
    //     double a descriptor cost the runtime already charges too much for.
    //     In practice that walk is the store's boot `refresh`, forked right
    //     behind the watcher — so the window a directory can be born into and
    //     be MISTAKEN for one of the covered is one LISTING wide, which on a
    //     large tree is the longer of the two delays this file has. The `wake`
    //     offered at arm time does not shorten it; what it buys is the other
    //     case, where boot's walk beat the watcher into being and the seeding
    //     would otherwise wait on whatever event came next. Either way, a
    //     window is what the backstop owns.
    //
    // A directory that leaves the tree gives its watcher up, and that is
    // hygiene rather than a second fix: the pinned runtime registers a watch
    // BY PATH, process-wide and for good, so a path that has been watched once
    // and is then removed and made again is a handle on an inode nobody can
    // reach — measured, and no spelling of the same path gets a live one back.
    // Nothing in here can close that, so the backstop keeps it, exactly as it
    // kept the whole of this before. What releasing buys is that the set stays
    // the size of the tree rather than of every directory the tree ever had.
    let covering: Covering | null = null

    /** Arm a watcher on a directory the root's own does not reach — nothing
     *  while nothing is watching, which is what keeps `watch: false` free, and
     *  nothing left behind by one that could not be armed, so the next walk is
     *  free to try again. */
    const cover = (directory: string): Effect.Effect<void> =>
      Effect.suspend(() => {
        const live = covering
        if (live === null || live.covered.has(directory)) return Effect.void
        if (!live.seeded) {
          live.covered.set(directory, null)
          return Effect.void
        }
        return Effect.gen(function*() {
          const scope = yield* Scope.fork(live.scope)
          live.covered.set(directory, scope)
          yield* Stream.runForEach(
            fs.watch(absolute(directory), { recursive: true }),
            () => Queue.offer(live.wake, undefined),
          ).pipe(
            // However it ends, the path stops counting as covered, so the NEXT
            // walk arms it again rather than the map remembering a watcher
            // nobody has. That matters for the one failure this change makes
            // more likely and not less: a new directory now costs descriptors,
            // so a transient EMFILE is exactly the arm that should be retried,
            // and a map entry left behind is a directory never watched again
            // for the life of the process. Guarded on identity, because a path
            // that left and came back has a newer scope in the map and this
            // fibre must not take it out. (The scope itself is released with
            // the watch stream rather than here — closing it from the fibre
            // living in it is not worth the reasoning, and it is empty.)
            Effect.onExit(() =>
              Effect.sync(() => {
                if (live.covered.get(directory) === scope) live.covered.delete(directory)
              })
            ),
            // Failing is not news. Losing one of these costs latency and
            // nothing else — the set on screen still converges, at the
            // backstop's sixty seconds rather than at a settle delay — which
            // is the trade the store already makes for the root's watcher,
            // made again one level down. The usual way to lose one is a
            // directory that was there when the walk read its parent and is
            // not there now, and the walk that notices drops it anyway.
            Effect.ignore,
            Effect.forkIn(scope),
          )
        })
      })

    /** What the walk found, made into what the watcher covers: a directory
     *  that is no longer there gives its watcher up, and the first walk to
     *  reach here is the seeding one described above. */
    const reconcile = (visited: ReadonlySet<string>): Effect.Effect<void> =>
      Effect.suspend(() => {
        const live = covering
        if (live === null) return Effect.void
        const gone: Array<Scope.Closeable> = []
        for (const [directory, scope] of live.covered) {
          if (visited.has(directory)) continue
          live.covered.delete(directory)
          if (scope !== null) gone.push(scope)
        }
        live.seeded = true
        return Effect.forEach(gone, (scope) => Scope.close(scope, Exit.void), {
          discard: true,
        })
      })

    const watch = Stream.unwrap(Effect.gen(function*() {
      // One pending wake is as many as there can be: every event on this
      // stream says the same word, and the settle delay upstairs would
      // collapse a queue of them into one probe anyway.
      const wake = yield* Queue.make<void>({ capacity: 1, strategy: "sliding" })
      const live: Covering = {
        covered: new Map(),
        wake,
        // The stream's own scope, so every watcher the walk arms is released
        // when this one is — including on the store's retry after a watcher
        // failed, which starts the whole arrangement again from empty.
        scope: yield* Effect.scope,
        seeded: false,
      }
      covering = live
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (covering === live) covering = null
        })
      )
      // Ask for the seeding walk now, so what it records is the tree this
      // watcher was armed on rather than whatever is there a minute later.
      yield* Queue.offer(wake, undefined)

      return Stream.merge(
        Stream.map(fs.watch(root, { recursive: true }), () => undefined),
        Stream.fromQueue(wake),
      ).pipe(
        Stream.mapError((cause) => new PlatformFailure({ path: ROOT_ITSELF, cause })),
      )
    }))

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
        /** Every directory this walk entered — what the watcher's own set is
         *  reconciled against once the walk has come back whole. */
        const visited = new Set<string>()

        const descend = (directory: string): Effect.Effect<void, PlatformFailure> =>
          Effect.gen(function*() {
            visited.add(directory)
            // Started before the entries are read, so a file landing here in
            // between wakes the new watcher rather than falling into the gap.
            // Best-effort-before — {@link cover} says how far that reaches.
            yield* cover(directory)
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
            // way a listing of it does. It is the walk's order and nothing
            // above is entitled to it ({@link Codec.validate} used to say
            // otherwise): a set whose own answer has an order puts its files in
            // it for itself, because the write gate assembles a map this walk
            // never produced.
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
        // Only on a walk that came back whole: one that failed has half a tree
        // in `visited`, and reconciling against it would disarm the half it
        // never reached.
        yield* reconcile(visited)
        return stamps
      })

    const read = (path: string) =>
      fs.readFileString(absolute(path)).pipe(
        Effect.catchIf(vanished, () => Effect.succeed(null)),
        Effect.mapError((cause) => new PlatformFailure({ path, cause })),
      )

    let staged = 0
    const stage = (path: string, contents: string) =>
      Effect.gen(function*() {
        const cut = path.lastIndexOf("/")
        const directory = cut === -1 ? "" : path.slice(0, cut)
        // A file the set has never held — the first `Archive.olai` — may name
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

/**
 * What one live watcher needs the walk to keep current for it.
 *
 * `covered` is every directory something is watching, mapped to the watcher
 * the walk armed on it — or `null` for one the root's own recursive watch
 * already holds, which is every directory the seeding walk found. `seeded` is
 * false only until that walk comes back. See the arming block in {@link make};
 * this exists as a type rather than four `let`s so that "there is a watcher"
 * and "there is not" is ONE thing to test.
 */
interface Covering {
  readonly covered: Map<string, Scope.Closeable | null>
  /** Where an armed watcher's events go, to be merged into {@link Disk.watch}
   *  beside the root's own. */
  readonly wake: Queue.Queue<void>
  /** The watch stream's scope: every armed watcher is forked into a child of
   *  it, so they all end when the stream does. */
  readonly scope: Scope.Scope
  seeded: boolean
}

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
