/**
 * THE CI WATCH — one probe per server, however many tabs; one dial per live
 * run, and none at all the rest of the time.
 *
 * This is `@olai/kolu-client`'s `link.ts` pointed at the other appliance, and
 * the shape is deliberately the same: started ONCE by the runtime on the
 * runtime's own scope (the `ci` cell's `connect`, forked when the surface
 * BINDS rather than when a browser subscribes), so ten tabs on one outline
 * are ten subscriptions to one cell and zero extra sockets. There is no
 * refcount here and no per-reader anything.
 *
 * ## Absence is the STEADY STATE, and that is the difference from padi
 *
 * padi's socket belongs to a per-host daemon that is meant to be up, so a dial
 * that finds nothing is news worth a three-armed cell. odu's belongs to a RUN:
 * it appears at `odu run` and ends with the coordinator — which MAY outlive
 * the settle on purpose (`--linger`) — so for any given checkout absence is
 * the ordinary answer and the great majority of the time. `dialRun` is shaped for that — it answers `null` rather than rejecting
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
 * cheaply, on a fixed spacing, and only for the worktrees the VAULT named. A tick
 * costs one `connect(2)` per un-held worktree against a path that usually does
 * not exist; one whose run is live costs nothing at all, because it is held and
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
 *
 * ## The two notices a hold rings
 *
 * The same observations that move the chip's ink are also the two transitions a
 * scoped conversation is woken with ({@link RunNotice}), and the watch is the
 * one place that can say them honestly: nothing ELSE rings olai's doorbell —
 * there is no second reader of odu, so a run's ink and a run's wake can never
 * disagree, which is the whole economy of the rule.
 *
 * First-red is said ONCE PER HOLD, and a hold IS one run (one socket's life):
 * the moment any frame carries a red cell. A run that was already red when olai
 * first dialed it says it on the first frame — the same acceptance the fleet
 * watcher makes of a terminal held when olai booted: pre-existence is not a
 * pardon. Settle is said when THE RUN says it: the frame carrying every node
 * terminal is the run's OWN settlement — the fold odu's coordinator runs over
 * the very cell this hold follows, and the moment odu's ledger stamps
 * `finishedAt`. It is NOT said at the socket's death, which was this watch's
 * founding approximation: exact before odu grew `--linger`, and wrong after —
 * a lingering coordinator holds the socket open PAST the settle on purpose,
 * so one node can be re-run, and a settle read off the socket was said when
 * the coordinator happened to END (a cancel, or the idle reap ~30 minutes
 * later), never when the run did. The socket's death keeps ONE reading: a run
 * that never settled on this hold DIED (`@odu/run-client`'s `deadRun`,
 * juspay/odu#98, is the same reading made first-class), and its account rings
 * where the hold ends. Each settle carries the ids of every node this hold
 * EVER saw red, which is the watch's own record — the same provenance the
 * chip's last-verdict rule states: a node that failed and went green on a
 * rerun is a fact the hold observed, not an inference anybody ran afterwards.
 *
 * An UNBOARDED run rings nothing, and it is silent by the same authority the
 * cell saves: both emission sites sit behind the `wanted` guard the frame
 * writes already keep, so a lane the vault dropped is quiet on every channel
 * at once.
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
import { type Worktree, worktreeAt } from "./resolve.ts"
import { type CiRun, type RunCell, tallyOf } from "./wire/index.ts"

/**
 * How long between sweeps.
 *
 * Long enough that a laptop with a dozen worktrees is not opening a dozen sockets
 * a second; short enough that starting `odu run` lights the chip up while you
 * are still looking at the window. The same trade `link.ts`'s `REDIAL` makes,
 * and the same answer — five seconds is the wrong side of "did it notice?" for
 * a run whose first node finishes in ten.
 */
const SWEEP = Duration.seconds(3)

/**
 * ONE NODE THAT NAMES A WORKTREE, as the vault walk hands it over —
 * {@link Worktree} plus the two strings a log line names it with.
 *
 * What crosses is the worktree's strings and no record: the walk over the vault belongs
 * to whoever holds the vault (`olai-plugin-odu`'s `worktrees.ts`), which is the
 * boundary this package's header draws and `@olai/kolu-client`'s `Claimant`
 * draws one appliance over.
 *
 * NAMED FOR WHAT IT IS rather than for what a board calls it. These records
 * are lanes on the orchestrator's board, and "lane" is that board's PROCESS
 * vocabulary — a dispatched piece of work — where olai's own vocabulary has
 * nodes, properties and declared types and no opinion about why somebody wrote
 * one down (the human's review of #433). A vault that keeps no lanes at all and
 * writes `worktree` on a bookmark gets exactly this face.
 */
export interface WorktreeNode extends Worktree {
  /** The node that carries the property — so a log line names something a
   *  reader can find, rather than a path. */
  readonly node: string
  readonly title: string
}

/** Where a dial goes, injectable for `Dial`'s reason one package over: a fake
 *  coordinator over a real unix socket is how this is exercised without a CI
 *  run on the machine running the suite. */
export type DialRun = typeof dialRun

/**
 * ONE TRANSITION A HOLD OBSERVED — the whole of what the appliance tells its
 * owner about a run, in two kinds.
 *
 * It is an IN-PROCESS notice and never a wire shape: the observations belong
 * to the same process that holds the socket ({@link Watch}), so no schema
 * guards this the way `@olai/kolu-client`'s `KoluEvent` is guarded — that one
 * crosses padi's socket, this one does not.
 *
 * THE ROW RIDES WHOLE in both kinds, and it is the chip's own row: the
 * classification (verdict, counts, which nodes are red) is a fold over the
 * cells BOTH sides already run, and shipping the answers beside the cells
 * would put a question and what answers it on one notice with nothing holding
 * them together — `wire/index.ts`'s own rule about `tallyOf` and `verdictOf`,
 * one payload over.
 */
export type RunNotice =
  | {
    /**
     * THE MOMENT A RUN FIRST WENT RED — once per hold, and a hold is one
     *  run: never once per red node, and never again for a rerun's second
     *  red spell while the socket lives. `cell` is the FIRST red cell in the
     *  run's own scheduling order on the frame that reddened. */
    readonly kind: "first-red"
    /** The row AS OF THE FRAME THAT REDDENED — live, with the counts so far. */
    readonly run: CiRun
    readonly cell: RunCell
  }
  | {
    /**
     * THE RUN SETTLED — on the RUN's word, never on the socket's: the frame
     *  whose every node is terminal is the settlement (the fold odu's own
     *  `checkSettled` runs over the same cell; the moment the ledger stamps
     *  `finishedAt`). Rung on THAT frame, however long the coordinator
     *  outlives it: with `--linger` the socket stays serving on purpose, so
     *  this notice's `run.live` is `true` — the row's `live` is the socket's
     *  truth and the truth here is that it's still up. The settle arrives
     *  with `live: false` only in the OTHER case: the socket died before any
     *  settling frame, which is what a coordinator killed mid-run says.
     *
     *  Once per settlement: a lingering coordinator's rerun un-settles the
     *  run and the drain after it rings again — and its own later end rings
     *  nothing, whether it settled the hold (already said) or outlived one.
     *  The verdict word (`ok` / `red` / `ended`) is the owning plugin's fold
     *  of the row, exactly as the chip's is.
     */
    readonly kind: "settled"
    readonly run: CiRun
    /** Every cell id this hold EVER observed red — the wake's record-truth
     *  for "failed earlier, went green on a rerun": observed, not inferred. */
    readonly reddened: ReadonlyArray<string>
  }

/** What the watcher is handed. */
export interface WatchDeps {
  /** The rows moved — the WHOLE set, every time, because the cell carries the
   *  whole set and its `equals` is what makes a repeat publish nothing. */
  readonly publish: (runs: ReadonlyArray<CiRun>) => void
  /** A transition worth waking somebody about — {@link RunNotice}. Sink,
   *  fire-and-forget, for `kolu-client`'s `rang` reason: the caller is a hold
   *  fiber with nowhere to put a failure, and the owner wires it onto its own
   *  catch. */
  readonly rang: (notice: RunNotice) => void
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
  /** A vault revision landed: these are the worktrees now. Cheap and
   *  idempotent — it stores the set and lets the next sweep act on it, rather
   *  than dialing on a keystroke. */
  readonly reclaim: (worktrees: Iterable<WorktreeNode>) => void
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

/** One worktree value that resolved to a place worth asking about. */
interface Watched {
  readonly id: string
  readonly at: string
  readonly title: string
}

export const makeWatch = (deps: WatchDeps): Watch => {
  const dial = deps.dial ?? dialRun
  /** What the board says, keyed by the `worktree` value verbatim. Replaced
   *  wholesale per revision: the vault is the authority on which worktrees are
   *  named, and a merge would keep one somebody deleted. */
  let wanted = new Map<string, Watched>()
  /** The rows, in the order they were first seen. A `Map` rather than an array
   *  because every reader of it is a lookup by the board's own value, and the
   *  publish is one `[...values()]`. */
  const rows = new Map<string, CiRun>()
  /**
   * The worktrees currently held open — the fiber holding each, AND THE PLACE IT
   * IS HOLDING.
   *
   * The key is the board's `worktree` value, and that value alone does not
   * decide a checkout: the same string under a node whose `pr-url` names a
   * different repository resolves somewhere else (`./resolve.ts`). So a key in
   * here is a key the sweep does not dial ONLY while the place still matches;
   * a value dropped and re-added with a different repository before the next
   * tick would otherwise be answered forever by a hold on the old socket,
   * writing the old `at` into the row (grok's review of #433, the case beside
   * the one `e6d96e7b` fixed — same key, stale closure).
   */
  const held = new Map<string, { readonly at: string; readonly fiber: Fiber.Fiber<void, never> }>()

  const publish = (): void => deps.publish([...rows.values()])

  const reclaim = (worktrees: Iterable<WorktreeNode>): void => {
    const next = new Map<string, Watched>()
    for (const named of worktrees) {
      const at = worktreeAt(named, deps.reposRoot)
      // A value this rule cannot place is not a value with a face. See
      // `./resolve.ts` on why that is a refusal rather than a guess.
      if (at === undefined) continue
      // FIRST WRITER WINS among nodes naming one worktree, which is the same
      // rule the vault keeps for a duplicate id: two nodes on one checkout is
      // one run, and the second claim is the mistake.
      if (!next.has(named.value)) {
        next.set(named.value, { id: named.value, at, title: named.title })
      }
    }
    wanted = next
    // A row the vault no longer names goes with it — including a settled one.
    // The verdict was ABOUT that node, and keeping it after the row that named it
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
  const hold = (watched: Watched): Effect.Effect<void> =>
    Effect.gen(function*() {
      const socket = runSocketPath(watched.at)
      const dialed: DialedRun | null = yield* Effect.promise(() => dial(socket))
      // NOTHING IS SERVING, which is the ordinary answer and is not news. The
      // key leaves `held` in the finalizer below and the next sweep asks
      // again.
      if (dialed === null) return
      deps.say(`olai: odu run live at ${socket} (${watched.title})`)
      /** The two cells' last frames, held apart and joined per publish — the
       *  header moves twice per run on its own clock and the pipeline moves on
       *  every node transition, so merging them on arrival would re-answer one
       *  question with the other's cadence. */
      let state: PipelineState = EMPTY_STATE
      let header: RunHeader = EMPTY_HEADER
      /**
       * THE HOLD'S OWN RECORD of red: which node ids ANY frame so far carried
       *  in the red column. First-red is the set going from empty to not —
       *  one record, not a set plus a boolean beside it. Per hold and
       *  discarded with it, so a NEW run in this checkout starts the counting
       *  over — once per run is once per socket's life, and that is the only
       *  unit odu has for it.
       */
      const reddened = new Set<string>()
      /**
       * THE HOLD'S OWN READ OF THE RUN'S SETTLEMENT — a crossing, not a level.
       *
       * THE RUN SAYS IT, over the same socket it pushed the frames on: a frame
       * whose every node is terminal IS the settlement — the same fold odu's
       * coordinator runs its `checkSettled` and its agent face's
       * `wait_for_settle` on, and the moment odu's ledger stamps
       * `finishedAt`. Reading the SOCKET's death for it instead was this
       * watcher's founding approximation, exact until odu grew `--linger`:
       * then the coordinator holds the socket open ON PURPOSE past the settle,
       * so one node can be re-run — and a settle read off the socket arrived
       * when the coordinator happened to END (a cancel, or the idle reap,
       * ~30 minutes on), never when the run did.
       *
       * Folded over the ROW's cells — the complement of the two non-terminal
       * words is `tallyOf`'s to state, exactly as the chip counts it, so the
       * ink and the wake cannot disagree about WHEN: they never could about
       * WHAT. A run that has not yet published a node (`total === 0`) has not
       * settled — an empty frame is a run starting, not one ending.
       *
       * A CROSSING, so a lingering coordinator's rerun is a NEW settlement:
       * the frame that un-settles the run re-arms it, and the drain after a
       * re-run rings again — odu's own `onSettledEach` reads each drain the
       * same way.
       */
      let wasSettled = false
      /**
       * THE BOARD IS THE AUTHORITY, checked on every write and not only on the
       * sweep's clock.
       *
       * Two things write `rows`: this fiber, per frame the coordinator pushes,
       * and {@link reclaim}, per vault revision — and they run on separate
       * stacks with no order between them. Without this guard a frame landing
       * in the window between a worktree being deleted and the next sweep
       * interrupting its hold would put the row back, and the face would keep
       * reporting on work nobody is tracking for up to a sweep.
       *
       * So the drop is authoritative the moment the board says so, and the
       * interrupt below is cleanup rather than the enforcement.
       *
       * It compares the PLACE and not just the key, for the reason {@link held}
       * gives: one `worktree` string can name two checkouts across a re-add,
       * and a hold on the old one may not write a row about the new.
       *
       * Named `apply` — one frame becoming a row, and the transitions the
       * frame CARRIES (first-red, settle) said on it. Some holds end with a
       * word the frames never said: that one lives where the hold ends.
       */
      const apply = (): void => {
        if (wanted.get(watched.id)?.at !== watched.at) return
        const row = runOf(watched, state, header)
        rows.set(watched.id, row)
        publish()
        let first: RunCell | undefined
        const seen = reddened.size > 0
        for (const cell of row.cells) {
          if (!cell.red) continue
          reddened.add(cell.id)
          first ??= cell
        }
        // FIRST-RED, the moment any frame carries one — the chip's ink and
        // the wake read the same frame the same way, so the two can never
        // disagree about what going red means.
        if (first !== undefined && !seen) {
          deps.rang({ kind: "first-red", run: row, cell: first })
        }
        const tally = tallyOf(row.cells)
        const settling = tally.total > 0 && tally.settled === tally.total
        if (settling && !wasSettled) {
          wasSettled = true
          deps.rang({ kind: "settled", run: row, reddened: [...reddened] })
        }
        // NOT an else: a run that settled and then took a rerun is live
        // again on the very next frame, and the drain after it must ring
        // again. The level is re-read per frame; only the RING is edge-keyed.
        if (!settling) wasSettled = false
      }
      // Published BEFORE the first frame: a coordinator that is up but has not
      // stamped a header yet is a run in `unstarted`, and drawing nothing for
      // it would make the chip appear late by however long provisioning takes.
      apply()
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
                apply()
              }),
          ),
          Stream.runForEach(
            dialed.client.surface.header.get(undefined),
            (frame) =>
              Effect.sync(() => {
                header = frame
                apply()
              }),
          ),
        ).pipe(
          // A subscription that DIES is how the coordinator says goodbye —
          // settled and torn down, or killed mid-run — so the failure is the
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
      // came out green" is the thing a settled row most wants to say.
      // ...and the same authority on the way out: a worktree the vault dropped
      // while its run was still going has no row to stamp.
      const last = rows.get(watched.id)
      if (last !== undefined && wanted.get(watched.id)?.at === watched.at) {
        const went = wentOf(last)
        rows.set(watched.id, went)
        publish()
        // THE SOCKET'S DEATH SAYS ONE THING NOW: the run DIED. A coordinator
        // that settled on a frame already rang it there — its end (torn down
        // at settle, or a lingering run later cancelled or idle-reaped) is not
        // a second settlement. Ringing here at all is for the hold that never
        // saw a settle: a coordinator killed mid-run, whose row's verdict is
        // the owner's fold as ever — `ended` for a run that decided nothing.
        // What this hold adds, either way, is the one thing the row alone
        // cannot still say — every node it ever saw red, so a flaked node
        // that went green on a rerun is a fact and not a secret.
        if (!wasSettled) {
          deps.rang({ kind: "settled", run: went, reddened: [...reddened] })
        }
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
            `olai: odu dial failed at ${runSocketPath(watched.at)}: ${
              String(Cause.squash(cause))
            } — treating it as no run`,
          )
        })
      ),
      // ...and it takes back only its OWN entry: a sweep that found this hold
      // pointing at a place the board has moved off replaces it, and a
      // finalizer that deleted by key alone would take the replacement out.
      Effect.ensuring(Effect.sync(() => {
        if (held.get(watched.id)?.at === watched.at) held.delete(watched.id)
      })),
    )

  /** ONE TICK: dial every wanted worktree that is not already held — and drop
   *  the hold on any the vault no longer names. Exposed on the interface
   *  above, which is where the reason lives. */
  const sweep = Effect.gen(function*() {
    for (const watched of wanted.values()) {
      const holding = held.get(watched.id)
      if (holding !== undefined) {
        // Held, and still holding the place the board names — nothing to do:
        // the coordinator pushes.
        if (holding.at === watched.at) continue
        // Held, but somewhere else. The key was re-used by a node naming a
        // different repository, so the hold is on a socket nobody is asking
        // about. Interrupt it BEFORE forking, and await that: its finalizer
        // runs on the interrupt, so the entry is clear by the time the
        // replacement claims it.
        held.delete(watched.id)
        yield* Fiber.interrupt(holding.fiber)
      }
      // Recorded BEFORE the fork, so two ticks cannot both claim one worktree: the
      // fiber's own `ensuring` is what takes it back out.
      const fiber = yield* Effect.forkScoped(hold(watched))
      held.set(watched.id, { at: watched.at, fiber })
    }
    // A worktree the vault dropped while its run was still going: the row is
    // already gone (`reclaim`), and this is the socket following it.
    for (const [key, holding] of [...held]) {
      if (!wanted.has(key)) {
        held.delete(key)
        yield* Fiber.interrupt(holding.fiber)
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
