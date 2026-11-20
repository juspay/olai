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

export interface Stamp {
  readonly mtime: number
  readonly size: number
}

export const sameStamp = (a: Stamp, b: Stamp): boolean =>
  a.mtime === b.mtime && a.size === b.size

export interface Disk {
  readonly listing: (
    match: (path: string) => boolean,
  ) => Effect.Effect<ReadonlyMap<string, Stamp>, PlatformFailure>
  readonly survey: (
    match: (path: string) => boolean,
  ) => Effect.Effect<ReadonlyMap<string, Stamp>, PlatformFailure>
  readonly read: (path: string) => Effect.Effect<string | null, PlatformFailure>
  readonly stage: (
    path: string,
    contents: string,
  ) => Effect.Effect<string, PlatformFailure>
  readonly publish: (
    staged: string,
    path: string,
  ) => Effect.Effect<void, PlatformFailure>
  readonly discard: (staged: string) => Effect.Effect<void>
  /** The caller (the gate) puts it AFTER the last publish. */
  readonly remove: (path: string) => Effect.Effect<void, PlatformFailure>
  readonly resolve: (path: string) => string
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

    const entriesOf = (directory: string) => {
      const read = fs.readDirectory(absolute(directory)).pipe(
        Effect.map((entries) =>
          entries
            .map((entry) => (directory === "" ? entry : `${directory}/${entry}`))
            .sort()
        ),
      )
      return (
        directory === ""
          ? read
          : Effect.catchIf(read, vanished, () => Effect.succeed<Array<string>>([]))
      ).pipe(
        Effect.mapError((cause) =>
          new PlatformFailure({ path: directory === "" ? ROOT_ITSELF : directory, cause })
        ),
      )
    }

    let covering: Covering | null = null

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
            // Guarded on identity, because a path that left and came back has a
            // newer scope in the map and this fibre must not take it out.
            Effect.onExit(() =>
              Effect.sync(() => {
                if (live.covered.get(directory) === scope) live.covered.delete(directory)
              })
            ),
            Effect.ignore,
            Effect.forkIn(scope),
          )
        })
      })

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
      const wake = yield* Queue.make<void>({ capacity: 1, strategy: "sliding" })
      const live: Covering = {
        covered: new Map(),
        wake,
        scope: yield* Effect.scope,
        seeded: false,
      }
      covering = live
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (covering === live) covering = null
        })
      )
      yield* Queue.offer(wake, undefined)

      return Stream.merge(
        Stream.map(fs.watch(root, { recursive: true }), () => undefined),
        Stream.fromQueue(wake),
      ).pipe(
        Stream.mapError((cause) => new PlatformFailure({ path: ROOT_ITSELF, cause })),
      )
    }))

    const walk = (match: (path: string) => boolean, arming: boolean) =>
      Effect.gen(function*() {
        const stamps = new Map<string, Stamp>()
        const visited = new Set<string>()

        const descend = (directory: string): Effect.Effect<void, PlatformFailure> =>
          Effect.gen(function*() {
            visited.add(directory)
            // Started before the entries are read.
            if (arming) yield* cover(directory)
            const entries = yield* entriesOf(directory)

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

            for (const [path, info] of found) {
              if (info === null) continue
              if (info.type === "Directory") {
                if (!pruned(path)) yield* descend(path)
                continue
              }
              if (info.type === "File" && match(path)) stamps.set(path, stampOf(info))
            }
          })

        yield* descend("")
        // Only on a walk that came back whole.
        if (arming) yield* reconcile(visited)
        return stamps
      })

    const listing = (match: (path: string) => boolean) => walk(match, true)
    const survey = (match: (path: string) => boolean) => walk(match, false)

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
        if (directory !== "") yield* fs.makeDirectory(absolute(directory), { recursive: true })
        const temp = `${directory === "" ? "" : `${directory}/`}.olai-${process.pid}-${staged++}.tmp`
        yield* fs.writeFileString(absolute(temp), contents)
        return temp
      }).pipe(Effect.mapError((cause) => new PlatformFailure({ path, cause })))

    const publish = (from: string, to: string) =>
      fs.rename(absolute(from), absolute(to)).pipe(
        Effect.mapError((cause) => new PlatformFailure({ path: to, cause })),
      )

    const discard = (path: string) => Effect.ignore(fs.remove(absolute(path)))

    const remove = (path: string) =>
      fs.remove(absolute(path), { force: true }).pipe(
        Effect.mapError((cause) => new PlatformFailure({ path, cause })),
      )

    return { listing, survey, read, watch, stage, publish, discard, remove, resolve: absolute }
  })

interface Covering {
  readonly covered: Map<string, Scope.Closeable | null>
  readonly wake: Queue.Queue<void>
  readonly scope: Scope.Scope
  seeded: boolean
}

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
