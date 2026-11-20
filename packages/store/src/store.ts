import {
  Clock,
  Duration,
  Effect,
  Exit,
  Latch,
  Ref,
  Result,
  Schedule,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect"
import type { FileSystem, Path, Scope } from "effect"

import type { Codec, Since } from "./codec.ts"
import * as Disk from "./disk.ts"
import { PlatformFailure, StaleWrite } from "./errors.ts"
import * as Probe from "./probe.ts"
import * as Vintage from "./vintage.ts"

export type Rev = number

export interface Snapshot<S> {
  readonly rev: Rev
  readonly value: S
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

export interface Change {
  readonly path: string
  readonly contents: string | null
}

export interface Write {
  readonly baseRev: Rev
  readonly changes: ReadonlyArray<Change>
}

export interface Aged<S> {
  readonly vintage: Vintage.Vintage
  readonly snapshot: Snapshot<S> | null
}

export interface Store<S, E> {
  readonly read: (freshness: Vintage.Freshness) => Effect.Effect<Aged<S>>
  readonly reads: Stream.Stream<Aged<S>>
  readonly errors: SubscriptionRef.SubscriptionRef<E | null>
  readonly refresh: (freshness: Vintage.Freshness) => Effect.Effect<void, PlatformFailure>
  readonly commit: (
    write: Write,
  ) => Effect.Effect<Result.Result<Rev, E>, StaleWrite | PlatformFailure>
  readonly body: (path: string) => Effect.Effect<string | null, PlatformFailure>
  readonly drifted: (
    paths: Iterable<string>,
  ) => Effect.Effect<ReadonlyArray<string>, PlatformFailure>
  readonly resolve: (path: string) => string
}

export interface Options<F, S, E> {
  readonly root: string
  readonly codec: Codec<F, S, E>
  readonly settle?: Duration.Input
  readonly backstop?: Duration.Input
  readonly watch?: boolean
}

interface Moved {
  readonly changed: ReadonlySet<string>
  readonly removed: ReadonlySet<string>
}

const NOTHING_MOVED: Moved = { changed: new Set(), removed: new Set() }

const absorb = (
  before: Moved,
  found: {
    readonly changed: Iterable<string>
    readonly removed: Iterable<string>
  },
): Moved => {
  const changed = new Set(before.changed)
  const removed = new Set(before.removed)
  for (const path of found.changed) {
    changed.add(path)
    removed.delete(path)
  }
  for (const path of found.removed) {
    removed.add(path)
    changed.delete(path)
  }
  return { changed, removed }
}

interface Judged<F, S, E> {
  readonly files: Probe.Decoded<F, E>
  readonly outcome: Result.Result<S, E>
}

const sinceOf = <S>(
  held: Snapshot<S> | null,
  moved: Moved,
  also: ReadonlyArray<string> = [],
): Since<S> | undefined =>
  held === null ? undefined : {
    value: held.value,
    changed: [...moved.changed, ...also],
    removed: [...moved.removed],
  }

const DEFAULT_SETTLE = Duration.millis(75)
const DEFAULT_BACKSTOP = Duration.seconds(60)
const WATCH_RETRY = Duration.seconds(5)

export const make = <F, S, E>(
  options: Options<F, S, E>,
): Effect.Effect<
  Store<S, E>,
  PlatformFailure,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> =>
  Effect.gen(function*() {
    const disk = yield* Disk.make(options.root)
    const probe = yield* Probe.make(disk, options.codec)

    const snapshot = yield* SubscriptionRef.make<Snapshot<S> | null>(null)
    const errors = yield* SubscriptionRef.make<E | null>(null)

    const standing = yield* Effect.map(
      Clock.currentTimeMillis,
      (at) => Vintage.nothingProved(at),
    ).pipe(Effect.flatMap(Ref.make))

    const proved = (stamps: ReadonlyMap<string, Disk.Stamp>) =>
      Effect.flatMap(
        Clock.currentTimeMillis,
        (at) => Ref.set(standing, { provedAt: at, stamps }),
      )

    const provedUnchanged = Effect.flatMap(
      Clock.currentTimeMillis,
      (at) => Ref.update(standing, (before) => ({ ...before, provedAt: at })),
    )

    const said = yield* Ref.make<string | null>(null)

    const sayUnreadable = (failure: PlatformFailure) =>
      Effect.flatMap(Ref.get(said), (before) =>
        before === failure.message ? Effect.void : Effect.andThen(
          Ref.set(said, failure.message),
          SubscriptionRef.set(errors, options.codec.unreadable(failure)),
        ))

    const clearErrors = Effect.andThen(
      Ref.set(said, null),
      Effect.flatMap(
        SubscriptionRef.get(errors),
        (current) => current === null ? Effect.void : SubscriptionRef.set(errors, null),
      ),
    )

    const moved = yield* Ref.make(NOTHING_MOVED)

    const publish = (
      found: Probe.Found<F, E>,
      already?: Judged<F, S, E>,
    ): Effect.Effect<Result.Result<Snapshot<S>, E>> =>
      Effect.gen(function*() {
        const since = yield* Ref.updateAndGet(moved, (before) => absorb(before, found))
        const held = yield* SubscriptionRef.get(snapshot)
        const outcome = already !== undefined &&
            Probe.identicalDecodedInOrder(already.files, found.files)
          ? already.outcome
          : options.codec.validate(found.files, sinceOf(held, since))
        if (Result.isFailure(outcome)) {
          yield* Ref.set(said, null)
          yield* SubscriptionRef.set(errors, outcome.failure)
          return Result.fail(outcome.failure)
        }
        const next = yield* SubscriptionRef.updateAndGet(snapshot, (previous) => ({
          rev: (previous?.rev ?? 0) + 1,
          value: outcome.success,
          changed: [...since.changed],
          removed: [...since.removed],
        }))
        yield* Ref.set(moved, NOTHING_MOVED)
        yield* proved(found.stamps)
        yield* clearErrors
        return Result.succeed(next as Snapshot<S>)
      })

    const gate = yield* Semaphore.make(1)
    const cycle = Effect.tapError(
      Effect.flatMap(
        probe.run(),
        (found) => found === null ? provedUnchanged : Effect.asVoid(publish(found)),
      ),
      sayUnreadable,
    )
    const cycled = gate.withPermit(cycle)

    const refresh = (freshness: Vintage.Freshness) =>
      freshness === "cheap" ? cycled : gate.withPermit(
        Effect.gen(function*() {
          yield* probe.forgetStamps((yield* probe.current).keys())
          yield* probe.revalidate
          yield* cycle
        }),
      )

    const commit = (write: Write) =>
      gate.withPermit(
        Effect.gen(function*() {
          const paths = write.changes.map((change) => change.path)

          const writes: Array<{ readonly path: string; readonly contents: string }> = []
          const removals: Array<string> = []
          for (const change of write.changes) {
            if (change.contents === null) removals.push(change.path)
            else writes.push({ path: change.path, contents: change.contents })
          }

          yield* cycle

          const drifted = yield* probe.drifted(paths)
          if (drifted.length > 0) {
            yield* probe.forgetStamps(drifted)
            yield* cycle
          }

          const current = yield* SubscriptionRef.get(snapshot)
          if (current === null || drifted.length > 0 || current.rev !== write.baseRev) {
            return yield* new StaleWrite({
              baseRev: write.baseRev,
              currentRev: current?.rev ?? 0,
            })
          }

          const candidate = new Map(yield* probe.current)
          const promised = new Map<string, Probe.Promised<F, E>>()
          for (const path of removals) candidate.delete(path)
          for (const change of writes) {
            const promise = probe.decode(change.path, change.contents)
            if (Result.isFailure(promise.decoded)) {
              return Result.fail(promise.decoded.failure)
            }
            candidate.set(change.path, promise.decoded)
            promised.set(change.path, promise)
          }
          const outstanding = yield* Ref.get(moved)
          const judged: Judged<F, S, E> = {
            files: candidate,
            outcome: options.codec.validate(
              candidate,
              sinceOf(current, outstanding, write.changes.map((change) => change.path)),
            ),
          }
          const refused = Result.isFailure(judged.outcome) ? judged.outcome.failure : null
          const stopped = options.codec.stopping === undefined
            ? refused
            : options.codec.stopping({
              candidateOutcome: judged.outcome,
              writtenPaths: paths,
              standingValue: current.value,
            })
          if (stopped !== null) return Result.fail(stopped)
          if (refused !== null) {
            const basePathsMoved = paths.some(
              (path) => outstanding.changed.has(path) || outstanding.removed.has(path),
            )
            const alreadyBroken = (yield* SubscriptionRef.get(errors)) !== null
            const landingIntoABrokenDirectory = alreadyBroken && !basePathsMoved
            if (!landingIntoABrokenDirectory) return Result.fail(refused)
          }

          const staged: Array<{ readonly from: string; readonly to: string }> = []
          yield* Effect.onExit(
            Effect.forEach(writes, (change) =>
              Effect.map(disk.stage(change.path, change.contents), (temp) => {
                staged.push({ from: temp, to: change.path })
              })),
            (exit) =>
              Exit.isSuccess(exit)
                ? Effect.void
                : Effect.forEach(staged, ({ from }) => disk.discard(from)),
          )
          for (const { from, to } of staged) yield* disk.publish(from, to)
          for (const path of removals) yield* disk.remove(path)

          yield* probe.forgetStamps(writes.map((change) => change.path))
          const reread = yield* probe.run(promised)
          if (reread === null) yield* provedUnchanged
          const published = reread === null
            ? Result.succeed(current)
            : yield* publish(reread, judged)
          if (Result.isFailure(published)) {
            if (refused !== null) return Result.succeed(current.rev)
            return Result.fail(published.failure)
          }
          return Result.succeed(published.success.rev)
        }),
      )

    const dirty = yield* Latch.make(false)

    if (options.watch !== false) {
      yield* Stream.runForEach(disk.watch, () => dirty.open).pipe(
        Effect.retry(Schedule.spaced(WATCH_RETRY)),
        Effect.forkScoped({ startImmediately: true }),
      )
    }

    yield* Effect.forever(
      Effect.andThen(Effect.sleep(options.backstop ?? DEFAULT_BACKSTOP), dirty.open),
    ).pipe(Effect.forkScoped)

    yield* Effect.forever(
      Effect.gen(function*() {
        yield* dirty.await
        yield* Effect.sleep(options.settle ?? DEFAULT_SETTLE)
        yield* dirty.close
        yield* Effect.catchCause(
          cycled,
          (cause) => Effect.logWarning("olai store: probe failed", cause),
        )
      }),
    ).pipe(Effect.forkScoped)

    yield* cycled

    const body = (path: string) => Effect.flatMap(
      gate.withPermit(probe.holds(path)),
      found => found ? disk.read(path) : Effect.succeed(null),
    )

    const read = (freshness: Vintage.Freshness): Effect.Effect<Aged<S>> =>
      Effect.gen(function*() {
        const held = yield* Ref.get(standing)
        const value = yield* SubscriptionRef.get(snapshot)
        const proof = freshness === "cheap"
          ? Vintage.HELD
          : yield* Vintage.check(disk, options.codec.match, held)
        const now = yield* Clock.currentTimeMillis
        if (proof._tag === "Confirmed") {
          yield* Ref.update(standing, (latest) =>
            latest === held ? { ...held, provedAt: now } : latest)
        }
        return { vintage: Vintage.vintageOf(held, now, proof), snapshot: value }
      })

    const reads = Stream.mapEffect(
      SubscriptionRef.changes(snapshot),
      (value) =>
        Effect.map(
          Effect.zip(Ref.get(standing), Clock.currentTimeMillis),
          ([held, now]) => ({
            vintage: Vintage.vintageOf(held, now, Vintage.HELD),
            snapshot: value,
          }),
        ),
    )

    return {
      read,
      reads,
      errors,
      refresh,
      commit,
      body,
      drifted: probe.drifted,
      resolve: disk.resolve,
    }
  })
