/**
 * THE CI WATCH at its bench — what ONE sweep does with what the board just
 * said.
 *
 * The dial is injected ({@link WatchDeps.dial}), so every case here is about
 * the watcher's own rules rather than about odu: that a checkout with no run
 * is silence and not an error, that a dial which RAISES is also survivable,
 * that a held run is not re-dialled every tick, and that a run whose socket
 * goes leaves its last reading behind rather than a hole.
 *
 * `watch.sweep` is driven directly (see its own doc) — the alternative was
 * waiting three real seconds per case for a timer that is not what any of them
 * is about.
 */

import { EMPTY_HEADER, EMPTY_STATE, pendingNode } from "@odu/run-client/surface"
import type { PipelineState, RunHeader } from "@odu/run-client/surface"
import { Effect, Stream } from "effect"
import { expect, test } from "bun:test"

import { type DialRun, type Lane, makeWatch, type WatchDeps } from "./runs.ts"
import type { CiRun } from "./wire/index.ts"

const ROOT = "/home/x/code"

const lane = (over: Partial<Lane> = {}): Lane => ({
  id: "lane-a",
  title: "the seam",
  worktree: ".worktrees/a",
  prUrl: "https://github.com/juspay/odu/pull/94",
  ...over,
})

/** A coordinator that serves the two cells and then, optionally, ENDS them —
 *  which is what a settling run does to a client. */
const coordinator = (
  state: PipelineState,
  header: RunHeader,
  ends: Promise<void> | null,
): DialRun =>
async () => ({
  client: {
    surface: {
      // A stream that emits the frame and then either stays open forever (a
      // live run) or completes when `ends` resolves (the socket going).
      nodes: { get: () => held(state, ends) },
      header: { get: () => held(header, ends) },
    },
  },
  close: async () => {},
}) as never

const held = <A>(frame: A, ends: Promise<void> | null): Stream.Stream<A> =>
  ends === null
    ? Stream.concat(Stream.make(frame), Stream.never)
    : Stream.concat(
      Stream.make(frame),
      Stream.fromEffect(Effect.promise(() => ends)).pipe(Stream.drain),
    )

interface Bench {
  readonly published: Array<ReadonlyArray<CiRun>>
  readonly warned: Array<string>
  readonly deps: WatchDeps
}

const bench = (dial: DialRun): Bench => {
  const published: Array<ReadonlyArray<CiRun>> = []
  const warned: Array<string> = []
  return {
    published,
    warned,
    deps: {
      publish: (runs) => published.push(runs),
      say: () => {},
      warn: (line) => warned.push(line),
      reposRoot: ROOT,
      dial,
    },
  }
}

/** Sweep once and let whatever it forked get as far as it is going to get. A
 *  real millisecond rather than a test clock: what is being awaited is a
 *  resolved promise and a stream's first pull, not a timer. */
const settle = Effect.sleep(5)

const state = (): PipelineState => ({
  ...EMPTY_STATE,
  name: "ci",
  sha7: "8f8fe56",
  order: ["e2e@p"],
  nodes: { "e2e@p": { ...pendingNode({ id: "e2e@p", name: "e2e", command: "just e2e", needs: [] }), status: "ok" } },
})

const header = (): RunHeader => ({ ...EMPTY_HEADER, startedAt: 1_000 })

test("a checkout with no run publishes NOTHING, and that is not an error", () => {
  // The steady state of every checkout on the machine. `dialRun` answers
  // `null` for it, and the whole of the watcher's response is silence.
  const it = bench(async () => null)
  const watch = makeWatch(it.deps)
  watch.reclaim([lane()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(it.published).toEqual([])
      expect(it.warned).toEqual([])
      expect(watch.rows()).toEqual([])
      // ...and it asks again on the next tick, because "has a run started
      // yet" does not get less likely the longer it has been false.
      yield* watch.sweep
      yield* settle
      expect(it.published).toEqual([])
    })),
  )
})

test("a live run publishes a row keyed by the BOARD'S OWN value, resolved beside it", () => {
  const it = bench(coordinator(state(), header(), null))
  const watch = makeWatch(it.deps)
  watch.reclaim([lane()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      const row = watch.rows()[0]
      expect(row?.id).toBe(".worktrees/a")
      expect(row?.at).toBe("/home/x/code/odu/.worktrees/a")
      expect(row?.live).toBe(true)
      expect(row?.tally.ok).toBe(1)
    })),
  )
})

test("a held run is NOT re-dialled — the coordinator pushes, the sweep does not poll it", () => {
  let dials = 0
  const dial: DialRun = async (path) => {
    dials += 1
    return coordinator(state(), header(), null)(path)
  }
  const it = bench(dial)
  const watch = makeWatch(it.deps)
  watch.reclaim([lane()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      yield* watch.sweep
      yield* watch.sweep
      yield* settle
      expect(dials).toBe(1)
    })),
  )
})

test("a run whose socket GOES leaves its last reading behind, no longer live", () => {
  let settled = (): void => {}
  const ends = new Promise<void>((resolve) => {
    settled = () => resolve()
  })
  const it = bench(coordinator(state(), header(), ends))
  const watch = makeWatch(it.deps)
  watch.reclaim([lane()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(watch.rows()[0]?.live).toBe(true)
      settled()
      yield* settle
      const row = watch.rows()[0]
      // Never deleted: "there was a run and it came out green" is the thing a
      // settled lane most wants to say.
      expect(row?.live).toBe(false)
      expect(row?.verdict).toBe("ok")
      // ...and the lane is free to be dialled again, for the NEXT run in that
      // checkout.
      expect(it.warned).toEqual([])
    })),
  )
})

test("a dial that RAISES is one warning and then silence — it may never kill the sweep", () => {
  // A stale `.ci/odu.sock` that is not a socket, a permission. `dialRun`
  // raises for everything that is not absence, and a watcher that let that
  // escape would take the whole surface runtime down over one worktree.
  const it = bench(async () => {
    throw new Error("EACCES")
  })
  const watch = makeWatch(it.deps)
  watch.reclaim([lane()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(it.warned).toHaveLength(1)
      expect(it.warned[0]).toContain("EACCES")
      expect(it.warned[0]).toContain("treating it as no run")
      expect(watch.rows()).toEqual([])
    })),
  )
})

test("a lane this rule cannot place is never dialled at all", () => {
  // A relative worktree with no PR URL names no repository, so there is
  // nothing to ask about — `./resolve.ts` argues why that is a refusal rather
  // than a guess.
  let dials = 0
  const it = bench(async () => {
    dials += 1
    return null
  })
  const watch = makeWatch(it.deps)
  watch.reclaim([lane({ prUrl: undefined })])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(dials).toBe(0)
    })),
  )
})

test("a lane the board DROPS takes its row with it, settled verdict and all", () => {
  // The verdict was about that lane. Keeping it after the row that named it
  // was deleted would be a face reporting on work nobody is tracking.
  const it = bench(coordinator(state(), header(), null))
  const watch = makeWatch(it.deps)
  watch.reclaim([lane()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(watch.rows()).toHaveLength(1)
      watch.reclaim([])
      expect(watch.rows()).toEqual([])
      expect(it.published.at(-1)).toEqual([])
      // ...and the socket follows on the next tick.
      yield* watch.sweep
      yield* settle
      expect(watch.rows()).toEqual([])
    })),
  )
})

test("two lanes naming ONE checkout are one run — the second claim is the mistake", () => {
  let dials = 0
  const it = bench(async (path) => {
    dials += 1
    return coordinator(state(), header(), null)(path)
  })
  const watch = makeWatch(it.deps)
  watch.reclaim([lane(), lane({ id: "lane-b", title: "a second row" })])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(dials).toBe(1)
      expect(watch.rows()).toHaveLength(1)
    })),
  )
})
