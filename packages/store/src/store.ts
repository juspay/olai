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
 * The write gate — `commit({baseRev, changes})`, writer-serialized against the
 * same probe, failing with `StaleWrite` when the store has moved past
 * `baseRev` — arrives with the ops layer. It is deliberately not here yet:
 * nothing writes.
 */

import { Duration, Effect, Latch, Result, Schedule, Semaphore, Stream, SubscriptionRef } from "effect"
import type { FileSystem, Path, Scope } from "effect"

import type { Codec } from "./codec.ts"
import * as Disk from "./disk.ts"
import type { PlatformFailure } from "./errors.ts"
import * as Probe from "./probe.ts"

/** Monotonic per store. A snapshot's revision is what a later write will name
 *  as the base it edited (the write gate's optimistic concurrency), and what
 *  proves to a consumer that two frames are different reads of the disk. */
export type Rev = number

export interface Snapshot<S> {
  readonly rev: Rev
  readonly value: S
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

    const publish = (files: Probe.Decoded<F, E>) => {
      const outcome = options.codec.validate(files)
      return Result.isFailure(outcome)
        ? SubscriptionRef.set(errors, outcome.failure)
        : SubscriptionRef.update(snapshot, (previous) => ({
          rev: (previous?.rev ?? 0) + 1,
          value: outcome.success,
        })).pipe(Effect.andThen(clearErrors))
    }

    // ONE update fiber's worth of work, whoever asks for it: the probe mutates
    // the stamp table it diffs against, so two of these interleaved would each
    // see the other's reads as its own cache.
    const gate = yield* Semaphore.make(1)
    const refresh = gate.withPermit(
      Effect.flatMap(probe.run, (files) => files === null ? Effect.void : publish(files)),
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

    return { snapshot, errors, refresh }
  })
