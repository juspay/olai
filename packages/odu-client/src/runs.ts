/**
 * THE CI WATCH — one probe per server, however many tabs; one dial per live
 * run, and none at all the rest of the time.
 *
 * This is `@olai/kolu-client`'s `link.ts` pointed at the other appliance, and
 * the shape is deliberately the same: started ONCE by the runtime on the
 * runtime's own scope (the `ci` cell's `connect`, forked when the surface
 * BINDS rather than when a browser subscribes), so ten tabs on a lanes outline
 * are ten subscriptions to one cell and zero extra sockets. There is no
 * refcount here and no per-reader anything.
 *
 * ## Absence is the STEADY STATE, and that is the difference from padi
 *
 * padi's socket belongs to a per-host daemon that is meant to be up, so a dial
 * that finds nothing is news worth a three-armed cell. odu's belongs to a RUN:
 * it appears at `odu run` and is gone the moment the run settles, so for any
 * given checkout absence is the ordinary answer and the great majority of the
 * time. `dialRun` is shaped for that — it answers `null` rather than rejecting
 * — and this module spends the distinction rather than flattening it: `null`
 * is silence, and anything that RAISES is said once, at warning level, and
 * then treated as silence too. Nothing here can fail; an effect that failed
 * would end the sweep on the ordinary case of a machine with no CI running.
 *
 * ## Why a SWEEP and not a watch
 *
 * Nothing tells olai that a run has started. `.ci/odu.sock` appears in a
 * worktree the server may not even be serving, so there is no revision, no
 * inotify, and no event: the only way to learn is to ask. So the loop asks —
 * cheaply, on a fixed spacing, and only for worktrees the BOARD named. A tick
 * costs one `connect(2)` per un-held lane against a path that usually does not
 * exist; a lane whose run is live costs nothing at all, because it is held and
 * the coordinator PUSHES.
 *
 * A fixed spacing rather than a backoff, for `link.ts`'s reason: what is being
 * retried is "has a run started yet", which does not get less likely the
 * longer it has been false.
 *
 * ## One fiber per held run
 *
 * A dialed run is held open by its own child fiber until the socket dies —
 * two subscriptions (the `nodes` cell and the `header` cell) raced onto one
 * hold, because either ending means the coordinator is gone. odu publishes its
 * header TWICE per run (juspay/odu#84 — a claiming roster, then the resolved
 * lane→host map), so both are FOLLOWED rather than read once, and the row is
 * re-projected on every frame of either.
 *
 * When the hold ends the row is not deleted: it is stamped `live: false` with
 * whatever verdict its last frame supported, which is the "run gone → the last
 * verdict, or nothing" the plan asks for. See `../src/index.ts` on where that
 * verdict comes FROM, which is the one place this phase deliberately declines
 * to read odu's on-disk ledger.
 */

import { dialRun, type DialedRun, runSocketPath } from "@odu/run-client/dial"
import {
  EMPTY_HEADER,
  EMPTY_STATE,
  type PipelineState,
  type RunHeader,
} from "@odu/run-client/surface"
import { Cause, Duration, Effect, Fiber, Schedule, type Scope, Stream } from "effect"

import { runOf, wentOf } from "./project.ts"
import { type LanePath, worktreeAt } from "./resolve.ts"
import type { CiRun } from "./wire/index.ts"

/**
 * How long between sweeps.
 *
 * Long enough that a laptop with a dozen lanes is not opening a dozen sockets
 * a second; short enough that starting `odu run` lights the chip up while you
 * are still looking at the window. The same trade `link.ts`'s `REDIAL` makes,
 * and the same answer — five seconds is the wrong side of "did it notice?" for
 * a run whose first node finishes in ten.
 */
const SWEEP = Duration.seconds(3)

/** One lane, as the vault walk hands it over — {@link LanePath} plus the two
 *  strings a log line names it with. What crosses is FOUR STRINGS per lane and
 *  no record: the walk over the vault belongs to whoever holds the vault
 *  (`@olai/server`'s `lanes.ts`), which is the boundary this package's header
 *  draws and `@olai/kolu-client`'s `Claimant` draws one appliance over. */
export interface Lane extends LanePath {
  /** The node that carries the property — so a log line names something a
   *  reader can find, rather than a path. */
  readonly id: string
  readonly title: string
}

/** Where a dial goes, injectable for `Dial`'s reason one package over: a fake
 *  coordinator over a real unix socket is how this is exercised without a CI
 *  run on the machine running the suite. */
export type DialRun = typeof dialRun

/** What the watcher is handed. */
export interface WatchDeps {
  /** The rows moved — the WHOLE set, every time, because the cell carries the
   *  whole set and its `equals` is what makes a repeat publish nothing. */
  readonly publish: (runs: ReadonlyArray<CiRun>) => void
  /** Routine narration, at debug: on a machine with no CI running this is a
   *  line every few seconds and it is not news. */
  readonly say: (line: string) => void
  /** What the OWNER must read — a dial that failed for a reason that is NOT
   *  absence (a socket somebody is serving that refused us, a path a broken
   *  checkout left behind). Rare by construction, and the one thing here that
   *  a person can act on. */
  readonly warn: (line: string) => void
  /** Where checkouts live (`./resolve.ts`'s `reposRootIn`, answered once at
   *  the composition root). */
  readonly reposRoot: string
  readonly dial?: DialRun
}

/** The watcher, as the half above it drives it. */
export interface Watch {
  /** A vault revision landed: these are the lanes now. Cheap and idempotent —
   *  it stores the set and lets the next sweep act on it, rather than dialing
   *  on a keystroke. */
  readonly reclaim: (lanes: Iterable<Lane>) => void
  /** Run forever, on the caller's scope. */
  readonly run: Effect.Effect<never>
  /**
   * ONE TICK, exposed.
   *
   * {@link Watch.run} is this on a timer and nothing else, and the split is
   * for the bench: a suite that had to drive the loop would either wait real
   * seconds per case or install a clock, where what every case is actually
   * about is what ONE sweep does with what the board just said. It takes a
   * `Scope` because the holds are forked into it — which is the arrangement
   * itself under test, since a hold that died with its sweep would re-dial a
   * live run every tick.
   */
  readonly sweep: Effect.Effect<void, never, Scope.Scope>
  /** The rows as they stand — the cell's snapshot answer, so a browser
   *  arriving mid-run reads what the broadcast already ate. */
  readonly rows: () => ReadonlyArray<CiRun>
}

/** One lane that resolved to a place worth asking about. */
interface Watched {
  readonly id: string
  readonly at: string
  readonly title: string
}

export const makeWatch = (deps: WatchDeps): Watch => {
  const dial = deps.dial ?? dialRun
  /** What the board says, keyed by the `worktree` value verbatim. Replaced
   *  wholesale per revision: the board is the authority on which lanes exist,
   *  and a merge would keep a lane somebody deleted. */
  let wanted = new Map<string, Watched>()
  /** The rows, in the order they were first seen. A `Map` rather than an array
   *  because every reader of it is a lookup by the board's own value, and the
   *  publish is one `[...values()]`. */
  const rows = new Map<string, CiRun>()
  /** The lanes currently held open, and the fiber holding each. A key in here
   *  is a key the sweep does not dial. */
  const held = new Map<string, Fiber.Fiber<void, never>>()

  const publish = (): void => deps.publish([...rows.values()])

  const reclaim = (lanes: Iterable<Lane>): void => {
    const next = new Map<string, Watched>()
    for (const lane of lanes) {
      const at = worktreeAt(lane, deps.reposRoot)
      // A lane this rule cannot place is not a lane with a face. See
      // `./resolve.ts` on why that is a refusal rather than a guess.
      if (at === undefined) continue
      // FIRST WRITER WINS among lanes naming one worktree, which is the same
      // rule the vault keeps for a duplicate id: two lanes on one checkout is
      // one run, and the second claim is the mistake.
      if (!next.has(lane.worktree)) {
        next.set(lane.worktree, { id: lane.worktree, at, title: lane.title })
      }
    }
    wanted = next
    // A row whose lane is gone goes with it — including a settled one. The
    // verdict was ABOUT that lane, and keeping it after the row that named it
    // was deleted would be a face reporting on work nobody is tracking.
    let dropped = false
    for (const key of [...rows.keys()]) {
      if (!wanted.has(key)) {
        rows.delete(key)
        dropped = true
      }
    }
    if (dropped) publish()
  }

  /**
   * ONE HELD RUN, from the dial to the socket's death.
   *
   * It never fails, and the two ways it can end are the same to the caller:
   * the row stops being live and the key leaves `held`, so the next sweep is
   * free to find the NEXT run in that worktree.
   */
  const hold = (lane: Watched): Effect.Effect<void> =>
    Effect.gen(function*() {
      const socket = runSocketPath(lane.at)
      const dialed: DialedRun | null = yield* Effect.promise(() => dial(socket))
      // NOTHING IS SERVING, which is the ordinary answer and is not news. The
      // key leaves `held` in the finalizer below and the next sweep asks
      // again.
      if (dialed === null) return
      deps.say(`olai: odu run live at ${socket} (${lane.title})`)
      /** The two cells' last frames, held apart and joined per publish — the
       *  header moves twice per run on its own clock and the pipeline moves on
       *  every node transition, so merging them on arrival would re-answer one
       *  question with the other's cadence. */
      let state: PipelineState = EMPTY_STATE
      let header: RunHeader = EMPTY_HEADER
      const settle = (): void => {
        rows.set(lane.id, runOf(lane, state, header))
        publish()
      }
      // Published BEFORE the first frame: a coordinator that is up but has not
      // stamped a header yet is a run in `unstarted`, and drawing nothing for
      // it would make the chip appear late by however long provisioning takes.
      settle()
      yield* Effect.ensuring(
        // RACED, not sequenced: either subscription ending means the socket is
        // gone, and `Effect.all` with `concurrency: "unbounded"` and
        // `mode: "either"` would wait for both. The first to finish wins and
        // the other is interrupted with it, which is the hold `link.ts` keeps
        // between padi's socket close and its mirror's `done`.
        Effect.race(
          Stream.runForEach(
            dialed.client.surface.nodes.get(undefined),
            (frame) =>
              Effect.sync(() => {
                state = frame
                settle()
              }),
          ),
          Stream.runForEach(
            dialed.client.surface.header.get(undefined),
            (frame) =>
              Effect.sync(() => {
                header = frame
                settle()
              }),
          ),
        ).pipe(
          // A subscription that DIES is how a settling run says goodbye — the
          // coordinator drops the socket mid-stream — so the failure is the
          // ordinary path here rather than an error one. Said at debug for
          // that reason, and swallowed so the sweep survives it.
          Effect.catchCause((cause) =>
            Effect.sync(() =>
              deps.say(
                `olai: odu run at ${socket} ended (${String(Cause.squash(cause))})`,
              )
            )
          ),
        ),
        Effect.promise(() => dialed.close()),
      )
      // THE ROW SURVIVES THE SOCKET. Whatever the last frame supported is what
      // a reader sees now — never deleted, because "there was a run and it
      // came out green" is the thing a settled lane most wants to say.
      const last = rows.get(lane.id)
      if (last !== undefined) {
        rows.set(lane.id, wentOf(last))
        publish()
      }
    }).pipe(
      // EVERY WAY A DIAL CAN END. `catchCause` rather than `catch` for
      // `link.ts`'s reason: a dial can raise a DEFECT (a path that is not a
      // socket, a permission), and caught only on the error channel it would
      // kill the connector's fiber and fault the whole surface runtime — a
      // stale `.ci/odu.sock` in one worktree taking olai's server down.
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          deps.warn(
            `olai: odu dial failed at ${runSocketPath(lane.at)}: ${
              String(Cause.squash(cause))
            } — treating it as no run`,
          )
        })
      ),
      Effect.ensuring(Effect.sync(() => held.delete(lane.id))),
    )

  /** ONE TICK: dial every wanted lane that is not already held — and drop the
   *  hold on any lane the board no longer names. Exposed on the interface
   *  above, which is where the reason lives. */
  const sweep = Effect.gen(function*() {
    for (const lane of wanted.values()) {
      if (held.has(lane.id)) continue
      // Recorded BEFORE the fork, so two ticks cannot both claim one lane: the
      // fiber's own `ensuring` is what takes it back out.
      const fiber = yield* Effect.forkScoped(hold(lane))
      held.set(lane.id, fiber)
    }
    // A lane the board dropped while its run was still going: the row is
    // already gone (`reclaim`), and this is the socket following it.
    for (const [key, fiber] of [...held]) {
      if (!wanted.has(key)) {
        held.delete(key)
        yield* Fiber.interrupt(fiber)
      }
    }
  })

  return {
    reclaim,
    rows: () => [...rows.values()],
    sweep,
    // SCOPED HERE, once, so every hold forked inside outlives the tick that
    // dialed it and dies with the watcher. `Effect.repeat` re-runs `sweep` on
    // one fiber, so the scope is the watcher's whole life — and interrupting
    // `run` (the runtime shutting down) is what closes it, which is the same
    // teardown `@olai/kolu-client`'s link keeps for its socket.
    run: Effect.scoped(Effect.repeat(sweep, Schedule.spaced(SWEEP))) as Effect.Effect<never>,
  }
}
