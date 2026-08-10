/**
 * @olai/store — a directory of files, kept as one validated snapshot for as
 * long as the scope is open.
 *
 * The store is generic on purpose: it takes a caller-supplied codec
 * ({@link ./codec.ts}) and never looks inside a file. It knows about paths,
 * bytes, stamps, revisions and last-good state; the codec knows about content.
 * There is not one olai type in here.
 *
 * The sync loop, and its one rule — the probe decides, nothing else:
 *
 *   1. TRIGGER: a watcher event, a `refresh`, or the periodic backstop. None of
 *      them says what changed; all three say "look".
 *   2. COALESCE: a settle delay after the first trigger of a burst, so a
 *      `git pull` of forty files is one probe rather than forty.
 *   3. PROBE: re-list, re-stat, re-decode only what the stamps say moved
 *      ({@link ./probe.ts}). Identical listing → the loop stops here, and
 *      nothing downstream learns that a probe happened at all.
 *   4. VALIDATE the whole set, and PUBLISH: valid → a new revision on the
 *      snapshot and the errors cleared; invalid → the last good snapshot is
 *      LEFT WHERE IT IS and the errors published beside it. A broken file must
 *      not blank a page that was reading fine a second ago.
 *
 * The two `SubscriptionRef`s are independent because last-good data and
 * what-is-wrong-now are two independent facts, and they map onto surface's
 * stream and cell. `SubscriptionRef.changes` is current-value-then-updates,
 * which is already surface's snapshot-then-deltas contract, so a consumer
 * written against the load-once store this grew out of needed no change.
 *
 * The WRITE GATE is `commit`, and it is the same loop run deliberately rather
 * than on a trigger. It takes the same permit the probe does — so a write and
 * a `git pull` cannot interleave over the stamp table — and inside it the
 * order is fixed:
 *
 *   PROBE (so a change that arrived out of band is seen, and the revision it
 *   produces is what the write is judged against) → the optimistic-concurrency
 *   check against `baseRev` → apply the changes to the last decode and
 *   VALIDATE the whole set → stage every file beside its destination →
 *   RENAME them all → re-probe and publish → the caller's post-publish hook.
 *
 * Validation before any rename is what makes a refused write cost nothing: the
 * bytes are on disk under names nothing reads, or they are not there at all.
 * The hook is the caller's Effect, run inside the gate: it is how the git
 * commit rides along without this package ever learning what git is.
 */

import {
  Duration,
  Effect,
  Latch,
  Ref,
  Result,
  Schedule,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect"
import type { FileSystem, Path, Scope } from "effect"

import type { Codec } from "./codec.ts"
import * as Disk from "./disk.ts"
import { type PlatformFailure, StaleWrite } from "./errors.ts"
import * as Probe from "./probe.ts"

/** Monotonic per store. A snapshot's revision is what a later write will name
 *  as the base it edited (the write gate's optimistic concurrency), and what
 *  proves to a consumer that two frames are different reads of the disk. */
export type Rev = number

export interface Snapshot<S> {
  readonly rev: Rev
  readonly value: S
  /**
   * Which files MOVED to make this revision — re-decoded, and gone.
   *
   * The whole value is here beside it, so this is not how a consumer learns
   * what the set says; it is how one that publishes PER FILE learns which
   * files to publish. The probe computes it as its stamp diff either way
   * ({@link ./probe.ts}), and a consumer re-deriving it by comparing two
   * snapshots would be the same walk done twice, one of them worse informed.
   *
   * It spans every probe since the LAST PUBLISHED revision, not just the one
   * that produced this snapshot: a probe whose set the codec refuses publishes
   * nothing, and the files it re-decoded are still what changed when a later
   * probe finally validates. The first revision names every file, because that
   * is what did move for a consumer holding nothing.
   */
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

/** One file's new contents. There is no delete: a set shrinks when a file
 *  leaves the disk, which is a probe diff like any other, and an op that wants
 *  a file emptied writes it empty. */
export interface Change {
  /** Root-relative, `/`-spelled — the same spelling a snapshot's paths use. */
  readonly path: string
  readonly contents: string
}

export interface Write {
  /** The revision the caller derived this edit from. A store that has moved
   *  past it refuses with {@link StaleWrite}. */
  readonly baseRev: Rev
  readonly changes: ReadonlyArray<Change>
  /**
   * Run once the new snapshot is published, still inside the gate — so no
   * second commit can interleave with it, and a caller that shells out to git
   * commits exactly the tree this write produced.
   *
   * Typed as unfailing on purpose: the write is already on disk and already
   * visible, so there is nothing here that could undo it. A hook whose own
   * work can fail owns that failure — logs it, records it, reports it beside
   * the result — rather than turning a successful write into a failed one.
   */
  readonly afterPublish?: Effect.Effect<void>
}

export interface Store<S, E> {
  /** Last good load, or `null` when there has never been one — which, once the
   *  store is live, means only "the directory was already invalid at boot". */
  readonly snapshot: SubscriptionRef.SubscriptionRef<Snapshot<S> | null>
  /** What is wrong right now, or `null`. Independent of the snapshot by
   *  design: a broken set leaves the last good tree on screen under a banner. */
  readonly errors: SubscriptionRef.SubscriptionRef<E | null>
  /** Probe NOW, and do not return until the result has been published. The
   *  caller's own writes reach the browser through this rather than through the
   *  watcher, which would make the delay a race with the file system. */
  readonly refresh: Effect.Effect<void, PlatformFailure>
  /**
   * The one way in. Writer-serialized against the probe, optimistic on
   * `baseRev`, all-or-none across files.
   *
   * TWO channels, and the split says who is at fault. `StaleWrite` is the
   * caller's cue to re-derive and ask again, so it is a failure; a set the
   * codec REFUSES is an answer — the write was well-formed and the tree it
   * would make is not — so it comes back as `Result.fail` with the codec's own
   * errors, and the caller renders them rather than retrying.
   */
  readonly commit: (
    write: Write,
  ) => Effect.Effect<Result.Result<Rev, E>, StaleWrite | PlatformFailure>
  /** Absolute, platform-spelled — what a post-publish hook hands to something
   *  outside this process. */
  readonly resolve: (path: string) => string
}

export interface Options<F, S, E> {
  readonly root: string
  readonly codec: Codec<F, S, E>
  /** How long to wait after a trigger before probing. One editor save is a
   *  handful of events and one `git pull` is hundreds; the delay is what turns
   *  either into a single probe. Long enough to swallow a burst, short enough
   *  that a save feels immediate. */
  readonly settle?: Duration.Input
  /** How often to probe with no trigger at all. Watchman's experience is that
   *  a watcher is a latency optimisation and never a guarantee — a dropped
   *  inotify queue, a network mount, a container boundary — so the slow
   *  unconditional sweep stays. It costs one listing when nothing has changed
   *  (resolved 2026-08-09). */
  readonly backstop?: Duration.Input
  /** Watch the tree. On by default; off is for tests that want the probe to
   *  run exactly when they say it does. */
  readonly watch?: boolean
}

/** What a snapshot's {@link Snapshot.changed} / {@link Snapshot.removed} are
 *  accumulated in between publishes. Sets rather than lists because a file
 *  saved three times before a valid probe is one changed file. */
interface Moved {
  readonly changed: ReadonlySet<string>
  readonly removed: ReadonlySet<string>
}

const NOTHING_MOVED: Moved = { changed: new Set(), removed: new Set() }

/** Fold one probe's diff into what is owed to the next revision. A path only
 *  ever lands in ONE of the two: a file that was deleted and put back is
 *  changed, and one that was edited and then deleted is removed — which is what
 *  a consumer holding the last published revision has to be told in each case. */
const absorb = (
  before: Moved,
  // Iterated, never indexed — which is the whole of what this needs to know
  // about a probe, and why it takes no type parameter for what a file decoded
  // to.
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

const DEFAULT_SETTLE = Duration.millis(75)
const DEFAULT_BACKSTOP = Duration.seconds(60)
/** How long to wait before re-establishing a watcher that failed. The backstop
 *  covers the gap, so this is about recovering liveness, not correctness. */
const WATCH_RETRY = Duration.seconds(5)

/**
 * Read the tree, publish it, and keep it current until the scope closes.
 *
 * Everything forked here is forked into the caller's scope, so shutting the
 * store down is closing that scope: no teardown function is handed out for
 * someone to forget. A boot that cannot read the directory fails the whole
 * effect — there is no last-good to fall back to, and serving a directory that
 * is not there is not a degraded mode, it is a mistake.
 */
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

    // A `SubscriptionRef` emits on every write, equal or not — and every
    // emission here is a frame the server sends to every open browser. A valid
    // probe clearing errors that were already clear is the common case, so it
    // is the one that must not broadcast.
    const clearErrors = Effect.flatMap(
      SubscriptionRef.get(errors),
      (current) => current === null ? Effect.void : SubscriptionRef.set(errors, null),
    )

    // What has moved since the last PUBLISHED revision. It is a ref rather than
    // a field of the probe because the probe answers about one look at the disk
    // and this is about the gap between two revisions — which is only ever more
    // than one probe wide when the codec refused what one of them found.
    const moved = yield* Ref.make(NOTHING_MOVED)

    /** Validate, then move the two refs to match — and say which way it went,
     *  because the write gate has to branch on it and re-reading the refs to
     *  find out would be the same question asked twice. */
    const publish = (
      found: Probe.Found<F, E>,
    ): Effect.Effect<Result.Result<Snapshot<S>, E>> =>
      Effect.gen(function*() {
        const since = yield* Ref.updateAndGet(moved, (before) => absorb(before, found))
        const outcome = options.codec.validate(found.files)
        if (Result.isFailure(outcome)) {
          // The snapshot stays where it is, so what moved is still owed to
          // whoever reads the next one: `since` is kept rather than cleared.
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
        yield* clearErrors
        // `updateAndGet` on a `Snapshot<S> | null` ref types as nullable; the
        // updater above never returns null, so this is the type catching up
        // with the value rather than a case to handle.
        return Result.succeed(next as Snapshot<S>)
      })

    // ONE update fiber's worth of work, whoever asks for it: the probe mutates
    // the stamp table it diffs against, so two of these interleaved would each
    // see the other's reads as its own cache.
    const gate = yield* Semaphore.make(1)
    /** One probe-and-publish cycle, with no permit of its own — every caller
     *  below already holds it. */
    const cycle = Effect.flatMap(
      probe.run,
      (found) => found === null ? Effect.void : Effect.asVoid(publish(found)),
    )
    const refresh = gate.withPermit(cycle)

    const commit = (write: Write) =>
      gate.withPermit(
        Effect.gen(function*() {
          // FIRST, and before anything is compared: a change that arrived out
          // of band — a `git pull`, an editor — has to be part of the revision
          // this write is judged against, or the write would be judged against
          // a tree that is no longer there.
          yield* cycle

          const current = yield* SubscriptionRef.get(snapshot)
          if (current === null || current.rev !== write.baseRev) {
            return yield* new StaleWrite({
              baseRev: write.baseRev,
              currentRev: current?.rev ?? 0,
            })
          }

          // The set this write WOULD make: what the probe last decoded, with
          // the changed files swapped in. Decoding here rather than after the
          // rename is what makes a refusal free.
          const candidate = new Map(yield* probe.current)
          for (const change of write.changes) {
            candidate.set(change.path, options.codec.decode(change.path, change.contents))
          }
          const judged = options.codec.validate(candidate)
          if (Result.isFailure(judged)) return Result.fail(judged.failure)

          // Every file staged before any is renamed: a write that cannot be
          // written at all must fail with the destinations untouched.
          const staged: Array<{ readonly from: string; readonly to: string }> = []
          yield* Effect.onError(
            Effect.forEach(write.changes, (change) =>
              Effect.map(disk.stage(change.path, change.contents), (temp) => {
                staged.push({ from: temp, to: change.path })
              })),
            () => Effect.forEach(staged, ({ from }) => disk.discard(from)),
          )
          for (const { from, to } of staged) yield* disk.publish(from, to)

          // Our own bytes may land in the same second at the same length as
          // the ones they replaced, which is precisely what mtime+size stamps
          // cannot see — so the changed files are re-read because we say so,
          // not because a stat noticed.
          yield* probe.forget(write.changes.map((change) => change.path))
          const reread = yield* probe.run
          const published = reread === null
            ? Result.succeed(current)
            : yield* publish(reread)
          if (Result.isFailure(published)) {
            // Written, and the set it produced does not validate — which the
            // check above ruled out unless something else moved the tree in
            // the moments since. The bytes are on disk and the error is on the
            // error channel; the caller hears the same "no" it would have.
            return Result.fail(published.failure)
          }

          if (write.afterPublish !== undefined) yield* write.afterPublish
          return Result.succeed(published.success.rev)
        }),
      )

    // WHEN to look and HOW to look are kept apart: every trigger does exactly
    // one thing, which is open this latch, and one loop does the looking. A
    // trigger that probed on its own behalf would be a second place for the
    // settle delay to be forgotten.
    const dirty = yield* Latch.make(false)

    if (options.watch !== false) {
      // Retried rather than fatal: losing the watcher costs latency, and the
      // backstop is what keeps that from costing correctness.
      yield* Stream.runForEach(disk.watch, () => dirty.open).pipe(
        Effect.retry(Schedule.spaced(WATCH_RETRY)),
        Effect.forkScoped({ startImmediately: true }),
      )
    }

    yield* Effect.forever(
      Effect.andThen(Effect.sleep(options.backstop ?? DEFAULT_BACKSTOP), dirty.open),
    ).pipe(Effect.forkScoped)

    // Close the latch AFTER the settle delay, so every trigger that arrived
    // during it is absorbed into this probe; anything arriving after it re-opens
    // and gets its own.
    yield* Effect.forever(
      Effect.gen(function*() {
        yield* dirty.await
        yield* Effect.sleep(options.settle ?? DEFAULT_SETTLE)
        yield* dirty.close
        // A probe that failed keeps the last good snapshot and says so in the
        // log. Killing this fiber would leave a page live and permanently
        // stale, which is the one failure mode a live store must not have; the
        // next trigger, or the backstop, tries again.
        yield* Effect.catchCause(
          refresh,
          (cause) => Effect.logWarning("olai store: probe failed", cause),
        )
      }),
    ).pipe(Effect.forkScoped)

    // LAST, and that order is the point: the watcher is armed first, so the
    // only changes it can miss are ones that happened before it — and this
    // probe is what reads those. Boot the other way around and a save landing
    // between the read and the watch is invisible until the backstop.
    yield* refresh

    return { snapshot, errors, refresh, commit, resolve: disk.resolve }
  })
