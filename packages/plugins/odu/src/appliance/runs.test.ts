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

import { type DialRun, makeWatch, type RunNotice, type WatchDeps, type WorktreeNode } from "./runs.ts"
import { type CiRun, tallyOf, verdictOf } from "./wire/index.ts"

const ROOT = "/home/x/code"

const named = (over: Partial<WorktreeNode> = {}): WorktreeNode => ({
  node: "node-a",
  title: "the seam",
  value: ".worktrees/a",
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
  readonly noticed: Array<RunNotice>
  readonly deps: WatchDeps
}

const bench = (dial: DialRun): Bench => {
  const published: Array<ReadonlyArray<CiRun>> = []
  const warned: Array<string> = []
  const noticed: Array<RunNotice> = []
  return {
    published,
    warned,
    noticed,
    deps: {
      publish: (runs) => published.push(runs),
      rang: (notice) => noticed.push(notice),
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

/** A node of a run the bench drives — one status word flipped on a pending
 *  seed. `red` and the two paint fields ride odu's own table, which the
 *  projection folds per frame, so a seeded STATUSWORD is the whole input. */
const node = (id: string, name: string, status: PipelineState["nodes"][string]["status"]): PipelineState["nodes"][string] => ({
  ...pendingNode({ id, name, command: `just ${name}`, needs: [] }),
  status,
})

/** A run still GOING: one node running, nothing red. The mid-run weather of
 *  every healthy hold — and, ever since the settle is read off the frame
 *  rather than the socket, the fixture any case about something ELSE needs
 *  for a run that must not settle under it. */
const runningState = (): PipelineState => ({
  ...EMPTY_STATE,
  name: "ci",
  sha7: "8f8fe56",
  order: ["e2e@p"],
  nodes: { "e2e@p": node("e2e@p", "e2e", "running") },
})

/** A three-node run in one frame, one of them red. */
const redState = (): PipelineState => ({
  ...EMPTY_STATE,
  name: "ci",
  sha7: "8f8fe56",
  order: ["a@p", "b@p", "c@p"],
  nodes: {
    "a@p": node("a@p", "typecheck", "ok"),
    "b@p": node("b@p", "e2e", "failed"),
    "c@p": node("c@p", "fmt-check", "running"),
  },
})

/** The same three, now all settled ok — the state a rerun greens into. */
const greenState = (): PipelineState => ({
  ...redState(),
  nodes: {
    "a@p": node("a@p", "typecheck", "ok"),
    "b@p": node("b@p", "e2e", "ok"),
    "c@p": node("c@p", "fmt-check", "ok"),
  },
})

const header = (): RunHeader => ({ ...EMPTY_HEADER, startedAt: 1_000 })

test("a checkout with no run publishes NOTHING, and that is not an error", () => {
  // The steady state of every checkout on the machine. `dialRun` answers
  // `null` for it, and the whole of the watcher's response is silence.
  const it = bench(async () => null)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
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
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      const row = watch.rows()[0]
      expect(row?.id).toBe(".worktrees/a")
      expect(row?.at).toBe("/home/x/code/odu/.worktrees/a")
      expect(row?.live).toBe(true)
      expect(tallyOf(row?.cells ?? []).ok).toBe(1)
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
  watch.reclaim([named()])
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
  watch.reclaim([named()])
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
      expect(verdictOf(tallyOf(row?.cells ?? []))).toBe("ok")
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
  watch.reclaim([named()])
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
  // A relative worktree with no PR URL and no repo the walk handed over names
  // no repository, so there is nothing to ask about — `./resolve.ts` argues
  // why that is a refusal rather than a guess.
  let dials = 0
  const it = bench(async () => {
    dials += 1
    return null
  })
  const watch = makeWatch(it.deps)
  watch.reclaim([named({ prUrl: undefined })])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(dials).toBe(0)
    })),
  )
})

test("a relative worktree placed by repo rather than PR URL still rings its settle", () => {
  // THE SILENT SHAPE (2026-09-02): flake-shakeout lived in infra.olai, carried
  // a relative `odu-worktree`, and had no `pr-url`. Four sequential runs
  // posted statuses the merge gates read; the doorbell stayed quiet, because
  // this watcher never placed the checkout and so never held a socket. The
  // walk now hands the repo over from the row's file. Who spawned the run
  // is not a fact here — the socket is the socket.
  let closed = (): void => {}
  const ends = new Promise<void>((resolve) => {
    closed = () => resolve()
  })
  const it = bench(coordinator(state(), header(), ends))
  const watch = makeWatch(it.deps)
  watch.reclaim([named({
    value: ".worktrees/flake-shakeout",
    prUrl: undefined,
    repo: "olai",
  })])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(watch.rows()[0]?.id).toBe(".worktrees/flake-shakeout")
      expect(watch.rows()[0]?.at).toBe("/home/x/code/olai/.worktrees/flake-shakeout")
      closed()
      yield* settle
      expect(it.noticed.map((one) => one.kind)).toEqual(["settled"])
    })),
  )
})

test("a lane the board DROPS takes its row with it, settled verdict and all", () => {
  // The verdict was about that lane. Keeping it after the row that named it
  // was deleted would be a face reporting on work nobody is tracking.
  const it = bench(coordinator(state(), header(), null))
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
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

test("a frame arriving AFTER the board dropped a lane does not put its row back", () => {
  // Two writers, two stacks, no order between them: the sweep interrupts a
  // dropped lane's hold, but a frame the coordinator already pushed can land
  // first. Without the board being asked on every write, the row would come
  // back and the face would report on work nobody is tracking until the next
  // tick.
  let push = (): void => {}
  const frames = new Promise<void>((resolve) => {
    push = () => resolve()
  })
  const it = bench(async () => ({
    client: {
      surface: {
        // The first frame settles the row; the second arrives only when the
        // test says so — after the lane is gone.
        nodes: {
          get: () =>
            Stream.concat(
              Stream.make(state()),
              Stream.concat(
                Stream.fromEffect(Effect.promise(() => frames)).pipe(Stream.drain),
                Stream.concat(Stream.make(state()), Stream.never),
              ),
            ),
        },
        header: { get: () => Stream.concat(Stream.make(header()), Stream.never) },
      },
    },
    close: async () => {},
  }) as never)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(watch.rows()).toHaveLength(1)
      watch.reclaim([])
      expect(watch.rows()).toEqual([])
      push()
      yield* settle
      expect(watch.rows()).toEqual([])
    })),
  )
})

test("one worktree string re-added under a DIFFERENT repository is re-dialled", () => {
  // The key is the board's value, and that value alone does not decide a
  // checkout: the same string under a lane whose `pr-url` names another
  // repository resolves somewhere else. A hold keyed on the string alone would
  // answer the new lane forever from the old socket, with the old `at` in the
  // row (grok's review of #433).
  const dialled: Array<string> = []
  const it = bench(async (path = "") => {
    dialled.push(path)
    return coordinator(state(), header(), null)(path)
  })
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(watch.rows()[0]?.at).toBe("/home/x/code/odu/.worktrees/a")
      // Same `worktree`, different repository.
      watch.reclaim([named({ prUrl: "https://github.com/juspay/kolu/pull/1" })])
      yield* watch.sweep
      yield* settle
      expect(watch.rows()[0]?.at).toBe("/home/x/code/kolu/.worktrees/a")
      expect(dialled).toEqual([
        "/home/x/code/odu/.worktrees/a/.ci/odu.sock",
        "/home/x/code/kolu/.worktrees/a/.ci/odu.sock",
      ])
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
  watch.reclaim([named(), named({ node: "node-b", title: "a second row" })])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(dials).toBe(1)
      expect(watch.rows()).toHaveLength(1)
    })),
  )
})

// ── The two notices a hold rings ─────────────────────────────────────────

test("a frame carrying NO red says nothing", () => {
  // No red in the frame, and the run not settled either: BOTH kinds are
  // quiet on this one.
  const it = bench(coordinator(runningState(), header(), null))
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(it.noticed).toEqual([])
    })),
  )
})

test("the moment a frame carries red, FIRST-RED rings — once per run, never per red node", () => {
  // The second frame carries a SECOND red node and the notice does not fire
  // again: the chip's ink and the wake read the same rule, and a run has one
  // moment of going red.
  let push = (): void => {}
  const frames = new Promise<void>((resolve) => {
    push = () => resolve()
  })
  // The SECOND red arrives mid-run: a fourth node is still going, so the
  // frame reddens without settling — the one first-red is this case's whole
  // account either way.
  const secondRed = (): PipelineState => ({
    ...redState(),
    order: [...redState().order, "d@p"],
    nodes: {
      ...redState().nodes,
      "c@p": node("c@p", "fmt-check", "errored"),
      "d@p": node("d@p", "bench", "running"),
    },
  })
  const it = bench(async () => ({
    client: {
      surface: {
        nodes: {
          get: () =>
            Stream.concat(
              Stream.make(redState()),
              Stream.concat(
                Stream.fromEffect(Effect.promise(() => frames)).pipe(Stream.drain),
                Stream.concat(Stream.make(secondRed()), Stream.never),
              ),
            ),
        },
        header: { get: () => Stream.concat(Stream.make(header()), Stream.never) },
      },
    },
    close: async () => {},
  }) as never)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(it.noticed).toHaveLength(1)
      const first = it.noticed[0]
      expect(first?.kind).toBe("first-red")
      if (first?.kind !== "first-red") return
      // The first red node in the run's OWN order, and the row as of that
      // frame — live, with the counts the frame carried.
      expect(first.cell.id).toBe("b@p")
      expect(first.run.live).toBe(true)
      expect(tallyOf(first.run.cells).red).toBe(1)
      push()
      yield* settle
      expect(it.noticed).toHaveLength(1)
    })),
  )
})

test("a run ALREADY red when olai first dialed says so on the first frame", () => {
  // Pre-existence is not a pardon: the fleet watcher holds a terminal that
  // was awaiting when olai booted to the same rule.
  const it = bench(coordinator(redState(), header(), null))
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(it.noticed).toHaveLength(1)
      expect(it.noticed[0]?.kind).toBe("first-red")
    })),
  )
})

test("SETTLED rings on the frame that settles the run, carrying every node the hold EVER saw red", () => {
  // The run reddened and then — after a rerun — went green: the final frame
  // is clean, and the notice still names `b@p`, because that is the hold's
  // own record and not an inference anybody ran afterwards. And it rings ON
  // that frame: the socket is still serving (the coordinator tears down a
  // beat later, or lingers), and the run's own settlement is the signal.
  let push = (): void => {}
  const frames = new Promise<void>((resolve) => {
    push = () => resolve()
  })
  let settled = (): void => {}
  const ends = new Promise<void>((resolve) => {
    settled = () => resolve()
  })
  const it = bench(async () => ({
    client: {
      surface: {
        nodes: {
          get: () =>
            Stream.concat(
              Stream.make(redState()),
              Stream.concat(
                Stream.fromEffect(Effect.promise(() => frames)).pipe(Stream.drain),
                Stream.concat(
                  Stream.make(greenState()),
                  Stream.fromEffect(Effect.promise(() => ends)).pipe(Stream.drain),
                ),
              ),
            ),
        },
        header: { get: () => Stream.concat(Stream.make(header()), Stream.never) },
      },
    },
    close: async () => {},
  }) as never)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      push()
      yield* settle
      const settled_ = it.noticed.find((one) => one.kind === "settled")
      expect(settled_?.kind).toBe("settled")
      if (settled_?.kind !== "settled") return
      // Rung BEFORE the socket went: `live` is the socket's truth, and its
      // truth at the settlement is that the coordinator is still up.
      expect(settled_.run.live).toBe(true)
      expect(verdictOf(tallyOf(settled_.run.cells))).toBe("ok")
      expect(settled_.reddened).toEqual(["b@p"])
      settled()
      yield* settle
      // ...the socket's death after a settled run is its own silence: the
      // whole stream of notices for this run is first-red, settled.
      expect(it.noticed.map((one) => one.kind)).toEqual(["first-red", "settled"])
    })),
  )
})

/** Two-thirds home and the last node still going: the frame just before the
 *  settle — no red anywhere, so a case can say the ONLY thing its frames do
 *  is settle. */
const midwayState = (): PipelineState => ({
  ...redState(),
  nodes: {
    "a@p": node("a@p", "typecheck", "ok"),
    "b@p": node("b@p", "e2e", "ok"),
    "c@p": node("c@p", "fmt-check", "running"),
  },
})

test("a run that SETTLES while its coordinator keeps serving rings settled at the last node's frame", () => {
  // THE INCIDENT (2026-09-02): two green runs — juspay/odu#98 and olai#474's
  // run 4 — reached the chat as settled only when their coordinators were
  // CANCELLED, six to eleven minutes after the last node went green. Both
  // were `odu run --linger`: the coordinator keeps the socket open ON PURPOSE
  // after the run settles, so one node can be re-run. Read off the socket's
  // death, the settle is only ever said then — and the doorbell is silent
  // for a run that finished minutes ago.
  //
  // The coordinator below SETTLES and then keeps serving: the socket never
  // closes for the whole case. The settle must be said at the frame that
  // settles the run — not at a socket death that never comes.
  let push = (): void => {}
  const frames = new Promise<void>((resolve) => {
    push = () => resolve()
  })
  const it = bench(async () => ({
    client: {
      surface: {
        nodes: {
          get: () =>
            Stream.concat(
              Stream.make(midwayState()),
              Stream.concat(
                Stream.fromEffect(Effect.promise(() => frames)).pipe(Stream.drain),
                Stream.concat(Stream.make(greenState()), Stream.never),
              ),
            ),
        },
        header: { get: () => Stream.concat(Stream.make(header()), Stream.never) },
      },
    },
    close: async () => {},
  }) as never)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      expect(it.noticed).toEqual([])
      push()
      yield* settle
      const settled_ = it.noticed.find((one) => one.kind === "settled")
      expect(settled_?.kind).toBe("settled")
      if (settled_?.kind !== "settled") return
      // The verdict is the settling frame's own, and the socket is still UP:
      // the row's `live` is the socket's truth, and with linger its truth
      // outlives the settle.
      expect(verdictOf(tallyOf(settled_.run.cells))).toBe("ok")
      expect(settled_.run.live).toBe(true)
      expect(watch.rows()[0]?.live).toBe(true)
    })),
  )
})

test("a lingering coordinator that is later CANCELLED does not ring a second settle", () => {
  // The other half of the same ruling: the socket's going after the run has
  // ALREADY settled is not a settlement — the idle reap (~30 minutes on) and
  // `odu cancel` alike end the hold without a second account.
  let push = (): void => {}
  const frames = new Promise<void>((resolve) => {
    push = () => resolve()
  })
  let closed = (): void => {}
  const ends = new Promise<void>((resolve) => {
    closed = () => resolve()
  })
  const it = bench(async () => ({
    client: {
      surface: {
        nodes: {
          get: () =>
            Stream.concat(
              Stream.make(redState()),
              Stream.concat(
                Stream.fromEffect(Effect.promise(() => frames)).pipe(Stream.drain),
                Stream.concat(
                  Stream.make(greenState()),
                  Stream.fromEffect(Effect.promise(() => ends)).pipe(Stream.drain),
                ),
              ),
            ),
        },
        header: { get: () => Stream.concat(Stream.make(header()), Stream.never) },
      },
    },
    close: async () => {},
  }) as never)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      push()
      yield* settle
      expect(it.noticed.map((one) => one.kind)).toEqual(["first-red", "settled"])
      // The coordinator is cancelled (or idle-reaped): the row stops being
      // live, and that is ALL that happens.
      closed()
      yield* settle
      expect(watch.rows()[0]?.live).toBe(false)
      expect(it.noticed.map((one) => one.kind)).toEqual(["first-red", "settled"])
    })),
  )
})

test("a coordinator that dies MID-RUN rings the run's death where the hold ends, on a lane still boarded", () => {
  // The socket's death keeps the run's death: the hold never read a settling
  // frame, so its end says the one word the frames could not — once, with
  // `live: false`, and the verdict a mid-run row's own (`ended`, the words
  // say of a `null`). The lane stays on the board for the whole case: not
  // one reclaim's silence, and not a died reading confused with one.
  const it = bench(async () => ({
    client: {
      surface: {
        // Two running frames and the stream simply ENDS — the coordinator
        // was killed.
        nodes: {
          get: () => Stream.make(redState(), midwayState()),
        },
        header: { get: () => Stream.concat(Stream.make(header()), Stream.never) },
      },
    },
    close: async () => {},
  }) as never)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      // First the frame's word, then the socket's — two notices, in order.
      expect(it.noticed.map((one) => one.kind)).toEqual(["first-red", "settled"])
      const died = it.noticed[1]
      expect(died?.kind).toBe("settled")
      if (died?.kind !== "settled") return
      // The died reading: `live` already the socket's truth, the verdict a
      // mid-run row's own, and the hold's WHOLE red record riding the last
      // account — `b@p` went green before the kill, and that is not a secret.
      expect(died.run.live).toBe(false)
      expect(verdictOf(tallyOf(died.run.cells))).toBeNull()
      expect(died.reddened).toEqual(["b@p"])
      // The published row carries the same stamp once the hold is gone.
      expect(watch.rows()[0]?.live).toBe(false)
    })),
  )
})

test("a rerun re-arms the settle: the drain after it is a NEW settlement, rung once", () => {
  // linger's own economy: the run settled, a node is re-run through the
  // still-serving socket, and the run settles again. Two settlements, two
  // accounts — `reddened` is the hold's WHOLE record both times, so the
  // second one still names the node the first one was about.
  let drained = (): void => {}
  const drain1 = new Promise<void>((resolve) => {
    drained = () => resolve()
  })
  let reran = (): void => {}
  const drain2 = new Promise<void>((resolve) => {
    reran = () => resolve()
  })
  /** The first drain: settled and RED — b@p failed, everything else home. */
  const settledRed = (): PipelineState => ({
    ...redState(),
    nodes: {
      "a@p": node("a@p", "typecheck", "ok"),
      "b@p": node("b@p", "e2e", "failed"),
      "c@p": node("c@p", "fmt-check", "ok"),
    },
  })
  /** b@p re-running: the flip that UN-settles the run. */
  const rerunning = (): PipelineState => ({
    ...redState(),
    nodes: {
      "a@p": node("a@p", "typecheck", "ok"),
      "b@p": node("b@p", "e2e", "running"),
      "c@p": node("c@p", "fmt-check", "ok"),
    },
  })
  const it = bench(async () => ({
    client: {
      surface: {
        nodes: {
          get: () =>
            Stream.concat(
              Stream.make(redState()),
              Stream.concat(
                Stream.fromEffect(Effect.promise(() => drain1)).pipe(Stream.drain),
                Stream.concat(
                  Stream.make(settledRed()),
                  Stream.concat(
                    Stream.fromEffect(Effect.promise(() => drain2)).pipe(Stream.drain),
                    // Both frames ride the one release: un-settled, then drained
                    // again — the coordinator pushes them back to back too.
                    Stream.concat(Stream.make(rerunning()), Stream.make(greenState())),
                  ),
                ),
              ),
            ),
        },
        header: { get: () => Stream.concat(Stream.make(header()), Stream.never) },
      },
    },
    close: async () => {},
  }) as never)
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      yield* settle
      drained()
      yield* settle
      expect(it.noticed.map((one) => one.kind)).toEqual(["first-red", "settled"])
      const first = it.noticed[1]
      expect(first?.kind).toBe("settled")
      if (first?.kind !== "settled") return
      expect(verdictOf(tallyOf(first.run.cells))).toBe("red")
      reran()
      yield* settle
      const settles = it.noticed.filter((one) => one.kind === "settled")
      expect(settles).toHaveLength(2)
      const second = settles[1]
      expect(second?.kind).toBe("settled")
      if (second?.kind !== "settled") return
      expect(verdictOf(tallyOf(second.run.cells))).toBe("ok")
      expect(second.reddened).toEqual(["b@p"])
    })),
  )
})

test("a run the board DROPPED mid-run rings nothing — not even settled", () => {
  // The frame writes and both emission sites sit behind the same `wanted`
  // guard: a lane the vault dropped is quiet on every channel at once.
  const it = bench(coordinator(redState(), header(), null))
  const watch = makeWatch(it.deps)
  watch.reclaim([named()])
  return Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* watch.sweep
      // Unboard BEFORE the first frame lands: the hold is forked but has not
      // seen one, so even first-red is the vault's own silence.
      watch.reclaim([])
      yield* settle
      expect(it.noticed).toEqual([])
      expect(watch.rows()).toEqual([])
    })),
  )
})
