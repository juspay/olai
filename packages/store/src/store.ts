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
 *      ({@link ./probe.ts}). Identical listing → the loop stops here and
 *      publishes nothing, because there is nothing to publish — but it RECORDS
 *      that it looked and agreed ({@link ./vintage.ts}), which is the one fact
 *      the loop used to throw away and the one a stopped loop cannot produce.
 *   4. VALIDATE the whole set, and PUBLISH: valid → a new revision on the
 *      snapshot and the errors cleared; invalid → the last good snapshot is
 *      LEFT WHERE IT IS and the errors published beside it. A broken file must
 *      not blank a page that was reading fine a second ago.
 *
 * ONE thing does not travel that loop, and it is named where it lives
 * ({@link Store.body}): the bytes of a file the codec decodes from its NAME
 * ({@link Codec.byName}). The set holds such a file's path, the probe never
 * opens it, and a consumer that wants its content reads it on demand and keeps
 * nothing — which is how a store over a directory of megabyte files costs the
 * size of what it validates rather than the size of what it serves.
 *
 * A SECOND DOOR asks the loop's question by bytes rather than stamps, and it
 * is ask-only too: {@link Store.drifted} names the files (if any) whose disk
 * content has moved past the loaded set. Nothing in the loop consults it —
 * the stamp trade is the loop's to keep — so the one caller is the refusal
 * door of the write path, where a stale set is exactly the alternative
 * explanation for a codec's "no", and paying one file read per asked path is
 * already paid for by the refusal it answers.
 *
 * Last-good data and what-is-wrong-now are two independent facts, kept on two
 * independent refs and mapping onto surface's stream and cell.
 * `SubscriptionRef.changes` is current-value-then-updates, which is already
 * surface's snapshot-then-deltas contract, so a consumer written against the
 * load-once store this grew out of needed no change.
 *
 * A THIRD FACT joined them on 2026-08-25 and it is not an error channel: HOW
 * CURRENT an answer is ({@link ./vintage.ts}). It is not a ref, because a
 * healthy directory proves its currency every sixty seconds and pushing that
 * to every open browser would cost more than the whole backstop saves. It is
 * an answer, and it is the reason the set is no longer reachable as a ref of
 * its own: {@link Store.read} and {@link Store.reads} are the doors, and both
 * of them hand over the age beside the value. There is no third door, which
 * is what makes "no read without an age" a fact about this file rather than a
 * rule somebody enforces at review time.
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
 *   RENAME them all → re-probe and publish THAT VERDICT → the caller's
 *   post-publish hook.
 *
 * WHAT THAT VERDICT SAYS ABOUT THIS WRITE is a second question and it is the
 * codec's ({@link Codec.stopping}). The codec judges the whole set, because
 * that is what a set means; whether the judgement is ABOUT the files this
 * commit puts down is not something a set-shaped answer says on its own. A
 * codec that answers the second question lets a write to healthy files land
 * beside a file that will not validate — the same per-file degradation reads
 * have had since 2026-08-09, which writes never got — and, for a codec that
 * degrades per file rather than refusing, it is also the only place a write
 * that broke ITS OWN file can be turned back. A codec that does not answer it
 * refuses on a refusal and admits on a success, exactly as before.
 *
 * OVER A REFUSAL there is a second condition and it is this package's, not the
 * codec's: the directory has to have ALREADY not been loading — the errors
 * channel carrying a verdict from a PROBE rather than from this candidate —
 * because a write from a loading directory that produces a refused set caused
 * that refusal, whichever files the findings name (#439: a declaration that
 * newly fences values in files it does not write; a move of a `ref` variant
 * that strands values in a third file). A codec that degrades per file reaches
 * that clause only when the directory itself cannot be read, which is the one
 * refusal it has left.
 *
 * Validation before any rename is what makes a refused write cost nothing: the
 * bytes are on disk under names nothing reads, or they are not there at all.
 * And it is the ONLY validation the write pays for, because the verdict travels
 * with the set it is about ({@link Judged}) and the re-probe reads that same set
 * back — proved rather than assumed, and re-judged in full the moment it is not.
 * The hook is the caller's Effect, run inside the gate: it is how the git
 * commit rides along without this package ever learning what git is.
 */

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
}

/**
 * THE SET, AND HOW OLD IT IS — one value, because there is no door to the
 * first that does not hand over the second.
 *
 * That is the shape the 2026-08-25 debate signed and it is a type, not a
 * discipline: {@link Store} carries no naked snapshot ref any more, so a
 * consumer cannot obtain what the store holds while skipping how current it
 * is. Ignoring a field you were handed is a choice somebody made; being handed
 * the set alone was an arrangement nobody could have made differently.
 *
 * `snapshot` is `null` when there has never been a good load — which, once
 * the store is live, means only "the directory was already invalid at boot".
 * The vintage is there either way: a directory that never loaded has an age
 * too, and it is the most interesting one in the building.
 */
export interface Aged<S> {
  readonly vintage: Vintage.Vintage
  readonly snapshot: Snapshot<S> | null
}

export interface Store<S, E> {
  /**
   * READ THE SET, stating what you need to be able to assume about it.
   *
   * The class is the caller's ({@link Vintage.Freshness}); the MEANS are this
   * package's, and that division is the whole point. `cheap` is the standing
   * answer with the age it has earned, at the cost of one map read — the thing
   * that redraws sixty times a second pays nothing new for knowing how old its
   * data is. `verified` takes a look at the disk first, ON THIS FIBER, and the
   * answer says whether the tree still agrees.
   *
   * IT DOES NOT FAIL. A `verified` look that cannot be taken — the root will
   * not list — is not an exception to this door, it is one of the things it
   * exists to report: the vintage comes back `Unchecked` with the disk's own
   * words in it, over the set the store is still serving. Every arm of
   * {@link Vintage.Proof} is an answer, and a caller that has one has been told
   * the truth about what it is holding.
   */
  readonly read: (freshness: Vintage.Freshness) => Effect.Effect<Aged<S>>
  /**
   * EVERY PUBLISHED SET, each with the age it had when it was handed over:
   * current-value-then-updates, which is already surface's snapshot-then-deltas
   * contract.
   *
   * A frame here is a publish, so its age is nothing — that is not a reason to
   * leave the vintage off it. A consumer folding these into a page holds the
   * last one for as long as the next takes to arrive, and "the last frame I got
   * was at 14:02" is exactly the sentence that was missing while the server
   * served week-old truth to open tabs.
   */
  readonly reads: Stream.Stream<Aged<S>>
  /** What is wrong right now, or `null`. Independent of the set by design: a
   *  broken directory leaves the last good tree on screen under a banner. */
  readonly errors: SubscriptionRef.SubscriptionRef<E | null>
  /**
   * LOOK NOW, and do not return until what was found has been published.
   *
   * ONE look verb, and it takes the same class the read does — which is what
   * this package used to have two of. `refresh` probed on the stamp table and
   * `resync` forgot the table first, and the difference between them was
   * mtime-and-size arithmetic explained in a doc comment so that a caller could
   * choose correctly. That is a socket wearing its own wiring: the day the
   * stamp changes, every caller that learned the folklore has to be found.
   *
   * So the caller says how much it needs to be able to assume and this package
   * decides what that costs. `cheap` is the look the sync loop itself takes,
   * and it is right for a caller that has just written through this store or
   * simply wants the pending burst flushed. `verified` is for a look that has
   * to be believed against a tree something OUTSIDE this process rewrote — a
   * `git checkout`, an rsync, a harness putting a fixture back — where the
   * cheap look is entitled to see nothing, and this one takes whatever measures
   * are needed for that not to be true. Which measures those are is not the
   * caller's business and is not in this sentence.
   *
   * It is not the freshness door. Reading is {@link Store.read}, and a caller
   * that wants an answer it can trust asks for one rather than commanding a
   * probe and then reading — which is the same two-step this verb's own history
   * shows going wrong.
   */
  readonly refresh: (freshness: Vintage.Freshness) => Effect.Effect<void, PlatformFailure>
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
  /**
   * ONE FILE OF THE SET, read NOW and kept by nobody — `null` for a path the
   * last probe did not find.
   *
   * The read that is not the probe's, and the one place that is not a
   * contradiction: it does not decide what the set holds, it does not touch a
   * stamp, and nothing above stores what it returns. It exists for the file a
   * codec decodes from its name ({@link Codec.byName}) — the set holds that
   * file's PATH, and whoever actually wants its content asks here, once, and
   * lets it go.
   *
   * MEMBERSHIP IS STILL THE PROBE'S, and that is enforced here rather than
   * promised: the path is looked up in the last probe's own table before
   * anything is opened. So a caller cannot reach a file the walk pruned, a file
   * no codec claims, or a name spelled to climb out of the root — none of them
   * are in the table, and all of them answer `null`, which is the same answer a
   * caller already handles for a file that is gone. A path that arrived over a
   * wire names nothing on its own.
   *
   * What it CAN be is newer than the revision the asker had — the file may have
   * moved since — and that resolves itself, because a file that moved is a file
   * the probe is about to report as changed.
   */
  readonly body: (path: string) => Effect.Effect<string | null, PlatformFailure>
  /**
   * WHICH OF THESE FILES now reads as bytes the loaded set was not decoded
   * from.
   *
   * The stamp table is the loop's cheap answer, and coarse on purpose — a
   * same-length rewrite landing inside the stamp's own resolution is what
   * the loop is entitled to miss ({@link ./disk.ts}). A caller holding a
   * REFUSAL is the one with a reason the loop never has to pay for a
   * stronger look, and this is the stronger look: re-open exactly the paths
   * it names and compare BYTES, not stamps. It is how the ops layer tells a
   * write the codec judged against an out-of-date set from one it genuinely
   * has no room for ({@link ../../ops/src/ops.ts}'s `run`, the only caller).
   *
   * What comes back is the list a resync would re-answer. A path the probe
   * does not hold is skipped ({@link Store.body}'s membership rule), and so
   * is a file the set never read the bytes of: both are stated where the
   * check lives ({@link ./probe.ts}'s `drifted`).
   */
  readonly drifted: (
    paths: Iterable<string>,
  ) => Effect.Effect<ReadonlyArray<string>, PlatformFailure>
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

/**
 * What the codec said, and the exact set it said it about.
 *
 * ONE VALUE, because the two are only true together. The write gate reaches a
 * verdict before it renames anything — that is what makes a refused write free
 * — and spends it after the rename, on the probe's account of what is now on
 * disk; a verdict travelling those lines on its own would be a verdict a reader
 * has to check the provenance of, and {@link Probe.sameDecoded} could not check
 * at all. It is the argument `Derived` makes one package over about its own
 * nodes, made here about a judgement.
 */
interface Judged<F, S, E> {
  readonly files: Probe.Decoded<F, E>
  readonly outcome: Result.Result<S, E>
}

/**
 * What the codec last answered and what has moved since, in the shape it takes
 * it in ({@link Since}) — `undefined` when there is no last answer to build on,
 * which is a first load or a store whose every verdict so far has been a
 * refusal.
 *
 * `also` is the write gate's half: the paths a commit is about to put down are
 * not in the probe's diff yet, and they are the rest of what the published
 * revision differs from. One spelling for both callers, so the two cannot come
 * to disagree about what "since" means.
 */
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

    /**
     * WHEN THE SET ON THAT REF WAS LAST PROVED TO BE THE DISK'S, and the
     * stamps it was proved at ({@link Vintage.Standing}).
     *
     * A PLAIN `Ref`, and that is not an oversight. It is written on the two
     * events a `SubscriptionRef` must not be written on — a publish, which
     * already emits, and a probe that found the same tree and published
     * NOTHING — and the second of those is the whole point. That probe happens
     * every sixty seconds on a healthy directory; on a `SubscriptionRef` it
     * would be a byte-identical frame to every open browser, forever, which is
     * the exact cost the settled-`null` short circuit exists to avoid. So the
     * currency axis is polled by whoever asks a read, and pushed to nobody.
     *
     * It starts at the store's construction time with an empty table: nothing
     * has been proved about this tree yet, and a `verified` read taken before
     * the boot probe lands says so by diverging on everything it finds.
     */
    const standing = yield* Effect.map(
      Clock.currentTimeMillis,
      (at) => Vintage.nothingProved(at),
    ).pipe(Effect.flatMap(Ref.make))

    /** A look that PROVED the set: these are the stamps it was read at, and
     *  this is when. Both halves move together or neither does — a table
     *  without its instant is a claim with no shelf life, and an instant
     *  without its table is what a later check would have nothing to measure
     *  against. */
    const proved = (stamps: ReadonlyMap<string, Disk.Stamp>) =>
      Effect.flatMap(
        Clock.currentTimeMillis,
        (at) => Ref.set(standing, { at, stamps }),
      )

    /** A look that found the same tree: nothing to publish, and the stamps are
     *  the ones already held — so only the instant moves. This is the line the
     *  2026-08-25 incident was invisible through. */
    const settled = Effect.flatMap(
      Clock.currentTimeMillis,
      (at) => Ref.update(standing, (before) => ({ ...before, at })),
    )

    /**
     * WHAT IS ON THE ERRORS REF, when what is on it is an unreadable
     * directory — the failure's own words, or `null` for anything else.
     *
     * A `SubscriptionRef` emits on every write, equal or not, and every
     * emission here is a frame the server sends to every open browser. So both
     * writers below owe the same thing: say it when it changes, and say
     * nothing when it has not. A directory that stays unreadable is re-probed
     * by the backstop every sixty seconds and by every `commit` on its way in,
     * and without this each one would push a byte-identical frame to every
     * open tab, forever.
     *
     * Keyed on the failure's words rather than on `E`, which the store cannot
     * compare — it never looks inside one.
     */
    const said = yield* Ref.make<string | null>(null)

    const sayUnreadable = (failure: PlatformFailure) =>
      Effect.flatMap(Ref.get(said), (before) =>
        before === failure.message ? Effect.void : Effect.andThen(
          Ref.set(said, failure.message),
          SubscriptionRef.set(errors, options.codec.unreadable(failure)),
        ))

    // A valid probe clearing errors that were already clear is the common
    // case, so it is the one that must not broadcast. It forgets `said` either
    // way: that ref is about what is PUBLISHED, and a directory that broke,
    // came back and broke again the same way would otherwise be reported once
    // in its life.
    const clearErrors = Effect.andThen(
      Ref.set(said, null),
      Effect.flatMap(
        SubscriptionRef.get(errors),
        (current) => current === null ? Effect.void : SubscriptionRef.set(errors, null),
      ),
    )

    // What has moved since the last PUBLISHED revision. It is a ref rather than
    // a field of the probe because the probe answers about one look at the disk
    // and this is about the gap between two revisions — which is only ever more
    // than one probe wide when the codec refused what one of them found.
    const moved = yield* Ref.make(NOTHING_MOVED)

    /** Validate, then move the two refs to match — and say which way it went,
     *  because the write gate has to branch on it and re-reading the refs to
     *  find out would be the same question asked twice.
     *
     *  A verdict may be handed IN, and is spent rather than replaced when it is
     *  about the very files this probe found — which is what makes one write
     *  cost one validation ({@link Probe.sameDecoded}). */
    const publish = (
      found: Probe.Found<F, E>,
      already?: Judged<F, S, E>,
    ): Effect.Effect<Result.Result<Snapshot<S>, E>> =>
      Effect.gen(function*() {
        const since = yield* Ref.updateAndGet(moved, (before) => absorb(before, found))
        const held = yield* SubscriptionRef.get(snapshot)
        const outcome = already !== undefined &&
            Probe.sameDecoded(already.files, found.files)
          ? already.outcome
          // What the codec last answered, and everything that has moved since
          // — which is `since` exactly, because it is kept rather than cleared
          // when a verdict refuses ({@link Codec.Since}).
          : options.codec.validate(found.files, sinceOf(held, since))
        if (Result.isFailure(outcome)) {
          // The snapshot stays where it is, so what moved is still owed to
          // whoever reads the next one: `since` is kept rather than cleared.
          // What IS cleared is `said` — this write replaces whatever the
          // unreadable path last published, so it must not go on claiming to.
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
        // THE CURRENCY AXIS, moved with the value and never without it: this
        // revision was read off those stamps at this instant, and a later look
        // is measured against THEM rather than against whatever the probe's
        // live table has moved on to. Set here rather than by the caller
        // because the refusal above returns before it — a set the codec would
        // not take is a set that was never proved to be anybody's answer, and
        // its age has to go on growing.
        yield* proved(found.stamps)
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
    const cycle = Effect.tapError(
      Effect.flatMap(
        probe.run(),
        // A LISTING IDENTICAL TO THE LAST ONE IS NOT NOTHING, and taking it for
        // nothing is the bug this whole change is about. The probe publishes
        // no revision, correctly — there is none to publish — but it has just
        // PROVED that the set on the ref is what the disk holds, which was the
        // one fact the store looked at every sixty seconds and threw away.
        // Kept here, it is what makes a healthy loop's age small and a stopped
        // loop's age grow: the difference between the two used to be invisible
        // precisely because both of them published nothing.
        (found) => found === null ? settled : Effect.asVoid(publish(found)),
      ),
      // The store's OTHER kind of error, published on the channel the codec's
      // own refusals travel — one channel, two kinds ({@link Codec.unreadable},
      // which owns the argument). HERE rather than in the sync loop below,
      // because it is a fact about a PROBE and not about who asked for one: a
      // directory that cannot be read is the same news whether the backstop
      // found it, a caller's `refresh` did, or the write gate did on its way in.
      //
      // It still FAILS afterwards. Publishing is telling everybody; the typed
      // failure is answering the caller, and a `commit` that could not probe
      // must not go on to judge a write against a tree it never saw.
      sayUnreadable,
    )
    /** The loop's own look, and what every trigger in this file ends in. */
    const cycled = gate.withPermit(cycle)

    /**
     * THE ONE LOOK VERB ({@link Store.refresh}) — the class in, the means
     * decided here.
     *
     * `cheap` is the loop's look. `verified` is the loop's look with the stamp
     * table forgotten first, which is the only thing that can see an outside
     * rewrite of the same length in the same second — the case that used to
     * have its own public member and its own paragraph of mtime arithmetic for
     * a caller to read. The paragraph is still here; what changed is who it is
     * addressed to.
     *
     * The forget is inside the same permit the probe holds: a watcher-triggered
     * cycle interleaved between the forget and the look would re-cache exactly
     * the stamps that were just dropped.
     */
    const refresh = (freshness: Vintage.Freshness) =>
      freshness === "cheap" ? cycled : gate.withPermit(
        Effect.gen(function*() {
          yield* probe.forget((yield* probe.current).keys())
          yield* cycle
        }),
      )

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
          //
          // Each decode is kept as the PROMISE the re-probe is handed below —
          // these bytes, this value — which is what makes the set it finds the
          // same set as this one rather than an equal one, and so lets the
          // verdict reached here be the published one.
          //
          // ONE KIND OF WRITE CANNOT DO THAT, and it is a corner rather than a
          // case: a file the codec answers for BY NAME ({@link Codec.byName})
          // decodes here from its BYTES, because that is what a write has, and
          // comes back from the probe as whatever the name alone says — a
          // different value, so the verdict is not spent and the set is judged
          // twice. It is correct either way and it is unreachable in the tree
          // that has one: olai's only body-writing ops take a `.md`, and the
          // kind it answers for by name is `.html`. Naming it here rather than
          // guarding it, because the guard would have to decide what a gate
          // validates for a file the set holds no bytes of, and nothing is
          // asking.
          const candidate = new Map(yield* probe.current)
          const promised = new Map<string, Probe.Promised<F, E>>()
          for (const change of write.changes) {
            const promise = probe.decode(change.path, change.contents)
            // A WRITE MUST PRODUCE FILES THIS CODEC CAN READ, and this is the
            // one place that can say so.
            //
            // A set ABSORBS a file that will not decode — the survivors are
            // clean, so the directory loads with that file's errors carried
            // inside it and everything else stays live. That rule is right
            // about LOADING, where the alternative is one hand-edited line
            // taking a whole vault off the screen, and wrong about WRITING,
            // where the unreadable file is the one this write just made: the
            // caller would be told the write landed while the outline dropped
            // off every page, and the repair would be somebody's text editor.
            //
            // So the guarantee is stated where enough is known to make it — the
            // gate is the only thing that knows which files are THIS write's,
            // and the codec is the only thing that knows what reading one
            // means. Nothing here learns a rule: a decode already happened, and
            // its failure is a value that was being dropped.
            //
            // It is what closes the per-line rules at the write door, all of
            // them at once and for every verb: a `date` that is not a date, an
            // `id` that is not a slug, two marks on one record, a `repeat` the
            // grammar cannot read or one with no `date` under it. Each of those
            // used to need its own predicate at whichever ops each could reach,
            // which is three predicates the day there are three rules and a
            // silent landing wherever somebody forgot one.
            if (Result.isFailure(promise.decoded)) {
              return Result.fail(promise.decoded.failure)
            }
            candidate.set(change.path, promise.decoded)
            promised.set(change.path, promise)
          }
          // The verdict and the set it is about, made together and spent
          // together ({@link Judged}) — reached from the published one, which
          // this write's own changes and whatever an earlier probe left owed
          // are the whole difference from.
          const outstanding = yield* Ref.get(moved)
          const judged: Judged<F, S, E> = {
            files: candidate,
            outcome: options.codec.validate(
              candidate,
              sinceOf(current, outstanding, write.changes.map((change) => change.path)),
            ),
          }
          /**
           * WHAT STOPS THIS WRITE — asked of the verdict, per file.
           *
           * It used to be one line: a set the codec would not publish refused
           * the write, whatever the write touched. That is a whole-set answer
           * to a per-file question, and it is the store that was asking it —
           * one file failing to validate froze every write to the directory,
           * including the write that would have reported the problem.
           *
           * SO THE CODEC IS ASKED ({@link Codec.stopping}), over the OUTCOME
           * whichever arm it took. A codec that refuses the set is asked whether
           * the refusal is about these files; a codec that degrades per file
           * answers with a set and is asked whether these files are among the
           * ones it degraded. Both are the same question and it is the codec's
           * either way — this package knows what a path is and nothing about
           * what is wrong with one. Absent, the answer is the sentence that
           * stood before any of this: a refusal refuses, a success admits.
           */
          const paths = write.changes.map((change) => change.path)
          const refused = Result.isFailure(judged.outcome) ? judged.outcome.failure : null
          const stopped = options.codec.stopping === undefined
            ? refused
            : options.codec.stopping(judged.outcome, paths)
          if (stopped !== null) return Result.fail(stopped)
          /**
           * AND THE SECOND THING that has to be true for bytes to land over a
           * REFUSAL: the base this write was planned against has to still be the
           * truth for these files. That is this package's own bookkeeping, and
           * it is asked only here — a codec that ADMITTED the write has said
           * nothing about it.
           *
           * TWO THINGS, and the first is #439's: the directory has to ALREADY
           * not be loading. The errors channel has to be carrying a verdict
           * from a PROBE rather than from this candidate, because a write from
           * a loading directory that produces a refused set caused that refusal
           * — a declaration that newly fences values in files it does not
           * write, a move of a `ref` variant that strands values in a third
           * file — and `stopping` cannot see that, since it is handed the
           * candidate and not the history. It is this package's own
           * bookkeeping, like the second.
           *
           * `moved` is what the check reads. It holds every path re-decoded or
           * removed since the last PUBLISHED revision, which is empty whenever
           * the directory is healthy and is exactly the drift a caller planning
           * against the last good snapshot cannot see while it is not. Without
           * it, admitting writes over a frozen snapshot would lose one: op two
           * is planned off a snapshot op one never reached, and writes the file
           * back without op one's record in it. So a file that has moved since
           * the standing revision is refused — the freeze narrows to the files
           * it is really about rather than lifting.
           *
           * A SNAPSHOT THAT KEEPS MOVING never reaches this: the drift it
           * defends against is drift a FROZEN publication hides, and a codec
           * that degrades per file freezes only when the directory itself
           * cannot be read.
           */
          if (refused !== null) {
            const settled = paths.every(
              (path) => !outstanding.changed.has(path) && !outstanding.removed.has(path),
            )
            const alreadyBroken = (yield* SubscriptionRef.get(errors)) !== null
            if (!settled || !alreadyBroken) return Result.fail(refused)
          }

          // Every file staged before any is renamed: a write that cannot be
          // written at all must fail with the destinations untouched.
          // `onExit`, not `onError`: an interrupted fiber is not a failure,
          // and a tab close that drops the write mid-stage used to leave
          // `.olai-*.tmp` on the tree (the shared-scratch After's leftover).
          const staged: Array<{ readonly from: string; readonly to: string }> = []
          yield* Effect.onExit(
            Effect.forEach(write.changes, (change) =>
              Effect.map(disk.stage(change.path, change.contents), (temp) => {
                staged.push({ from: temp, to: change.path })
              })),
            (exit) =>
              Exit.isSuccess(exit)
                ? Effect.void
                : Effect.forEach(staged, ({ from }) => disk.discard(from)),
          )
          for (const { from, to } of staged) yield* disk.publish(from, to)

          // Our own bytes may land in the same second at the same length as
          // the ones they replaced, which is precisely what mtime+size stamps
          // cannot see — so the changed files are re-read because we say so,
          // not because a stat noticed.
          yield* probe.forget(write.changes.map((change) => change.path))
          // Handed the promises this write made, so what it reads back is the
          // set already judged rather than an equal one. The verdict rides
          // along too, still carrying that set — and if something else moved
          // the tree in the meantime the two no longer match and it is judged
          // again. This is the publish that used to be a second validation of
          // the set this gate had just approved.
          const reread = yield* probe.run(promised)
          // `null` here is a tree that did not move at all across the rename,
          // which is a set this gate has just proved is what the disk holds —
          // the same fact the loop's own settled probe records, recorded on
          // the same line so the two cannot come to disagree.
          if (reread === null) yield* settled
          const published = reread === null
            ? Result.succeed(current)
            : yield* publish(reread, judged)
          if (Result.isFailure(published)) {
            // ADMITTED, and the set is still refused — which is the arrangement
            // rather than a surprise: the write was never what was wrong with
            // this directory, the last good snapshot goes on standing, and the
            // refusal has just been republished on the errors channel by
            // `publish` itself. The caller hears yes, at the revision that is
            // actually being served, and the banner over it says the rest.
            if (refused !== null) return Result.succeed(current.rev)
            // Written, and the set it produced does not validate — which the
            // check above ruled out unless something else moved the tree in
            // the moments since. The bytes are on disk and the error is on the
            // error channel; the caller hears the same "no" it would have.
            return Result.fail(published.failure)
          }
          return Result.succeed(published.success.rev)
        }),
      )

    // WHEN to look and HOW to look are kept apart: every trigger does exactly
    // one thing, which is open this latch, and one loop does the looking. A
    // trigger that probed on its own behalf would be a second place for the
    // settle delay to be forgotten.
    const dirty = yield* Latch.make(false)

    if (options.watch !== false) {
      // Retried rather than fatal, and retried QUIETLY — which is a trade and
      // not an oversight. Losing the watcher costs latency and nothing else:
      // the backstop probes unconditionally, so the set on screen still
      // converges on the disk, just at sixty seconds instead of at seventy-five
      // milliseconds. Nothing a reader could do about it either, since the
      // recovery is already running. What a FAILED PROBE costs is different in
      // kind — the set stops converging at all — and that one is published
      // (below).
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
        // A probe that failed keeps the last good snapshot, and this fiber
        // goes on: killing it would leave every reader on a page that is live,
        // permanently stale and saying neither, which is the one failure mode
        // a live store must not have. The next trigger, or the backstop, tries
        // again.
        //
        // Catching it used to be the WHOLE of it, and that was the bug — the
        // reason went to the log, the outline froze at the last good revision,
        // and nothing on screen said so. It is published now, by `cycle`
        // itself: this catch is what keeps the loop alive, not what decides
        // whether anybody is told.
        //
        // `catchCause` rather than `catch`, because a defect here is a bug in
        // this package rather than news about somebody's directory: it belongs
        // in the log and nowhere else.
        yield* Effect.catchCause(
          cycled,
          (cause) => Effect.logWarning("olai store: probe failed", cause),
        )
      }),
    ).pipe(Effect.forkScoped)

    // LAST, and that order is the point: the watcher is armed first, so the
    // only changes it can miss are ones that happened before it — and this
    // probe is what reads those. Boot the other way around and a save landing
    // between the read and the watch is invisible until the backstop.
    //
    // The CHEAP look, because the stamp table it would forget is empty: a boot
    // reads every file whichever class is asked for.
    yield* cycled

    const body = (path: string) =>
      Effect.flatMap(
        probe.holds(path),
        (found) => found ? disk.read(path) : Effect.succeed(null),
      )

    /**
     * ONE READ ANSWERED — the standing set, and the vintage the caller's class
     * entitles it to.
     *
     * THE ORDER OF THE FIRST TWO LINES IS LOAD-BEARING. The proof is taken
     * before the value, so a publish landing between them makes the answer
     * NEWER than its vintage claims and never older. Both readings are atomic
     * on their own and there is no permit here to make them one — which is the
     * point — so the arrangement is to be wrong only in the direction that
     * cannot hurt: an age that overstates is a reader looking harder than it
     * needed to, and an age that understates is the lie this whole change
     * exists to make unspellable.
     *
     * THE `verified` ARM TAKES NO PERMIT and reaches nothing that could.
     * {@link Vintage.check} is handed the disk, the codec's `match` and the
     * standing record, and the module it lives in has no way to name the
     * semaphore at all. So a cycle wedged behind a permit — a commit that
     * cannot finish, a fiber that died holding it — cannot delay this call and
     * cannot make it answer `Confirmed`: the walk is the asker's own, and what
     * it finds is measured against stamps the wedged loop has not been able to
     * move.
     *
     * A CONFIRMED LOOK IS A PROOF, so it advances the standing instant — the
     * next `cheap` reader inherits an age this fiber earned honestly, and a
     * directory nobody is writing to does not have to re-walk itself per
     * question to look current. It does NOT touch the stamp table: the loop's
     * cache is the loop's, and a read that quietly re-cached what it saw would
     * be a second publisher with no permit, which is exactly the thing this
     * door promises not to be.
     */
    const read = (freshness: Vintage.Freshness): Effect.Effect<Aged<S>> =>
      Effect.gen(function*() {
        const held = yield* Ref.get(standing)
        const value = yield* SubscriptionRef.get(snapshot)
        const proof = freshness === "cheap"
          ? Vintage.HELD
          : yield* Vintage.check(disk, options.codec.match, held)
        const now = yield* Clock.currentTimeMillis
        if (proof._tag === "Confirmed") {
          // ONLY IF NOTHING PUBLISHED WHILE THE LOOK WAS RUNNING, and that is
          // the one place this door could have written a lie. A walk takes
          // real time; a publish landing inside it has already recorded its
          // own proof, with its own table, and a blind `set` here would put
          // THIS instant beside the OLDER stamps — a standing record claiming
          // recent proof of a revision that is no longer the one being served,
          // which every cheap read after it would inherit.
          //
          // Identity is the test because both writers mint a fresh record, and
          // it is the right test: what is being asked is not "is this equal"
          // but "is this still the record I looked against".
          yield* Ref.update(standing, (latest) =>
            latest === held ? { ...held, at: now } : latest)
        }
        return { vintage: Vintage.vintageOf(held, now, proof), snapshot: value }
      })

    /** Every published set, aged at the moment it is handed over. A frame is a
     *  publish, so its `Held` age is whatever the hop from `publish` to here
     *  cost — which is the truth about that frame and not a rounding of it. */
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
