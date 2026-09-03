/**
 * THE SUBSCRIPTION'S OWN END — the cases `./watch.ts` is still accountable
 * for, after the timers went to padi.
 *
 * The pacing is NOT here, and that is the point of the file. Kolu's helper
 * (`watchAgentStates`) carries a test of its own against a real daemon; what
 * THIS suite drives by hand are the breaths that remain ours: batches
 * translate into `KoluEvent`s and are folded into the ring, the beat is
 * stamped per received batch, a knob edit re-asks padi exactly when the
 * wire's question moved, and a dead run is said once rather than retried
 * with a timer of our own.
 *
 * ## The drive: one queue per subscription
 *
 * The face is structural — kolu's helper is handed a `padi` whose
 * `watchStates` member returns a `Stream.fromQueue`, and a test pushes
 * BATCHES into that queue. That is exactly the honesty the fake-padi
 * process holds at socket scale: padi's wire answers in batches, the
 * member's leading frame may be empty, and the count a nag carries is the
 * daemon's own — so the assertions here are about OUR folds over padi's
 * facts, never about re-computed time.
 */

import { describe, expect, it } from "bun:test"
import { Effect, Fiber, Queue, Stream } from "effect"

import { koluHalf } from "./index.ts"
import type { PadiSurfaceClient } from "./link.ts"
import { makeMirror } from "./mirror.ts"
import { type Dial, SPEAKS } from "./link.ts"
import { DEFAULT_WATCH, makeWatch, WATCH_LANES, type WatchConfig } from "./watch.ts"
import type { FleetTerminal, KoluEvent } from "./wire/index.ts"
import { UNOWNED } from "./wire/index.ts"

import type { PadiStateEvent, PadiWatchStatesInput } from "@kolu/padi-client/surface"

/** One timed wait, small and honest: kolu's helper subscribes through an
 *  effect runtime, so landing on "the callback has run" is a breath wide. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A KNOB SET at test scale — the intervals are padi's pacing, which this
 *  drive never waits for; what matters is WHAT ASKS, not how long. */
const tiny = (extra?: Partial<WatchConfig>): WatchConfig => ({
  heldForMs: 60_000,
  nagMs: { ms: 600_000 },
  heartbeatMs: 60_000,
  ...extra,
})

/** A FLEET ROW, wire-shaped — the draw facts the frozen event joins. */
const row = (id: string, agentState: string | null, label = ""): FleetTerminal => {
  const word = agentState ?? "idle"
  const held = agentState === "awaiting_user" || agentState === "waiting"
  const bucket = agentState === null
    ? "idle"
    : held
    ? agentState === "waiting" ? "waiting" : "awaiting"
    : "working"
  return {
    id,
    pip: {
      variant: held ? "waiting" : "busy",
      glyph: "claude-code",
      active: agentState !== null,
      asking: held,
      bytesLive: true,
      hasAgent: agentState !== null,
      sleeping: false,
      alert: false,
      alertLabel: "",
    },
    bucket,
    agentState,
    label,
    labelColor: "",
    subline: { text: word, fromAgent: true },
    pr: null,
    recencyAt: null,
    repo: null,
    themeName: null,
    owner: UNOWNED,
  }
}

const EPOCH = 1_700_000_000_000
const HELD_SINCE = 1_699_999_000_000

/** ONE `PadiStateEvent`, as the daemon would stamp it: a ms-epoch clock,
 *  the bucket as the state, the reminder accounting on nags. */
const ev = (
  kind: "snapshot" | "transition" | "nag",
  terminal: string,
  options?: { state?: string; at?: number; since?: number; nag?: { index: number; left?: number } },
): PadiStateEvent => ({
  seq: 1,
  id: terminal,
  kind,
  state: options?.state ?? "awaiting",
  since: options?.since ?? HELD_SINCE,
  at: options?.at ?? EPOCH,
  ...(options?.nag === undefined ? {} : { nag: options.nag }),
}) as never

/**
 * THE FAR END: a `padi` whose `watchStates` answers every subscription
 * with frames from ONE queue the test holds. `asks` records the inputs the
 * watch actually named — the tests about "did the question move" are
 * counters here, never about time.
 */
const faceWith = (queue: Queue.Queue<ReadonlyArray<PadiStateEvent>>, asks?: Array<PadiWatchStatesInput>) => ({
  surface: {
    watchStates: {
      get: (input: PadiWatchStatesInput) => {
        asks?.push(input)
        return Stream.fromQueue(queue)
      },
    },
  },
}) as unknown as PadiSurfaceClient

/** The events and beats the sink hands us, two collectors for the ring's
 *  own two breaths. `sets` keeps ids for order questions. */
const collected = () => {
  const events: Array<KoluEvent> = []
  const beats: Array<{ at: string; everyMs: number }> = []
  const said: Array<string> = []
  const ring = new Map<string, KoluEvent>()
  return {
    events,
    beats,
    said,
    ring: () => new Map(ring),
    sink: {
      emit: (event: KoluEvent) => {
        events.push(event)
        ring.set(event.id, event)
      },
      evict: (id: string) => {
        ring.delete(id)
      },
      beat: (at: string, everyMs: number) => {
        beats.push({ at, everyMs })
      },
    },
  }
}

describe("the subscription watcher", () => {
  it("a leading frame translates, frozen — both report kinds fold onto the one the wire keeps", async () => {
    const seen = collected()
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.reconfigure(tiny())
    watch.attach(faceWith(queue))
    await sleep(30)

    watch.observe("t1", row("t1", "awaiting_user", "the terminal door"))
    await Effect.runPromise(Queue.offer(queue, [
      ev("snapshot", "t1"),
      ev("nag", "t2", { state: "waiting", nag: { index: 1 } }),
    ]))
    await sleep(30)

    const fired = seen.events
    expect(fired.length).toBe(2)
    // SNAPSHOT folds onto "transition" — a first report of an episode,
    // whether the watch was present for the edge.
    expect(fired[0]?.kind).toBe("transition")
    expect(fired[0]?.row?.terminal).toBe("t1")
    expect(fired[0]?.row?.state).toBe("awaiting")
    expect(fired[0]?.row?.agentState).toBe("awaiting_user")
    expect(fired[0]?.row?.label).toBe("the terminal door")
    // The FROZEN draw: live flags stamped out — a row hours old must not
    // flash motion for a moment that passed.
    expect(fired[0]?.row?.pip?.active).toBe(false)
    expect(fired[0]?.row?.pip?.bytesLive).toBe(false)
    // The daemon's own observation clock, relayed as the ISO the wire keeps.
    expect(fired[0]?.row?.since).toBe(new Date(HELD_SINCE).toISOString())
    // THE ACCOUNTING, verbatim — the cap is padi's sentence, never ours.
    expect(fired[1]?.kind).toBe("nag")
    expect(fired[1]?.nag).toEqual({ index: 1 })

    // ...and it is the KIND that decides it carries accounting at all: a
    // first report with a count riding it drops the count at the fold, so
    // no reader downstream ever spells a "reminder" of a first saying.
    await Effect.runPromise(Queue.offer(queue, [
      ev("transition", "t3", { nag: { index: 5, left: 0 } }),
    ]))
    await sleep(30)
    expect(seen.events.at(-1)?.nag).toBeUndefined()
    watch.stop()
  })

  it("an event about a terminal the mirror never published still draws — a quiet synthesized pip", async () => {
    const seen = collected()
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.attach(faceWith(queue))
    await sleep(30)

    await Effect.runPromise(Queue.offer(queue, [ev("transition", "never-seen")]))
    await sleep(30)

    const fired = seen.events[0]
    expect(fired?.row?.terminal).toBe("never-seen")
    expect(fired?.row?.agentState).toBe("awaiting")
    expect(fired?.row?.pip?.glyph).toBe("terminal")
    expect(fired?.row?.pip?.active).toBe(false)
    expect(fired?.row?.pip?.bytesLive).toBe(false)
    expect(fired?.row?.pip?.hasAgent).toBe(true)
    watch.stop()
  })

  it("the beat is stamped PER RECEIVED BATCH — and an empty leading frame is a stamp too", async () => {
    const seen = collected()
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.reconfigure(tiny({ heartbeatMs: 30_000 }))
    watch.attach(faceWith(queue))
    await sleep(30)

    // "Nothing currently matches" is a FRAME — the member's own answer to
    // "is it live". The pill must still pace on it.
    await Effect.runPromise(Queue.offer(queue, []))
    await sleep(30)
    expect(seen.beats.length).toBe(1)
    expect(seen.beats[0]?.at).toBe(new Date(EPOCH).toISOString())
    expect(seen.beats[0]?.everyMs).toBe(30_000)
    expect(seen.events.length).toBe(0)

    await Effect.runPromise(Queue.offer(queue, [ev("transition", "t1", { at: EPOCH + 500 })]))
    await sleep(30)
    // STAMPED AT RECEIPT — one clock, ours. Liveness is "when did the
    // subscription last answer", and the daemon's `at` rides the content
    // (the event), not the pulse.
    expect(seen.beats.length).toBe(2)
    expect(seen.beats[1]?.at).toBe(new Date(EPOCH).toISOString())
    watch.stop()
  })

  it("the count a nag carries is folded verbatim — three rounds, index and left", async () => {
    const seen = collected()
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.observe("t1", row("t1", "waiting", "parked reviewer"))
    watch.attach(faceWith(queue))
    await sleep(30)

    await Effect.runPromise(Queue.offer(queue, [ev("snapshot", "t1", { state: "waiting" })]))
    await sleep(30)
    for (const nag of [{ index: 1, left: 2 }, { index: 2, left: 1 }, { index: 3, left: 0 }]) {
      await Effect.runPromise(Queue.offer(queue, [ev("nag", "t1", { state: "waiting", nag })]))
      await sleep(15)
    }

    const nags = seen.events.filter((event) => event.kind === "nag")
    expect(seen.events.filter((event) => event.kind === "transition").length).toBe(1)
    expect(nags.length).toBe(3)
    expect(nags.map((event) => event.nag)).toEqual([{ index: 1, left: 2 }, { index: 2, left: 1 }, { index: 3, left: 0 }])
    // A beat per round's batch, counted — the pill's read while it nags.
    expect(seen.beats.length).toBe(4)
    watch.stop()
  })

  it("reconfigure re-asks padi ONLY when a wire knob moved — an echoed edit changes nothing", async () => {
    const seen = collected()
    const asks: Array<PadiWatchStatesInput> = []
    const queues: Array<Queue.Queue<ReadonlyArray<PadiStateEvent>>> = []
    const face = {
      surface: {
        watchStates: {
          get: (input: PadiWatchStatesInput) => {
            asks.push(input)
            const queue = Effect.runSync(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
            queues.push(queue)
            return Stream.fromQueue(queue)
          },
        },
      },
    } as unknown as PadiSurfaceClient

    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.reconfigure(tiny({ nagMs: { ms: 600_000, count: 3 } }))
    watch.attach(face)
    await sleep(30)
    expect(asks.length).toBe(1)
    expect(asks[0]).toEqual({ heldForMs: 60_000, nagMs: 600_000, nagCount: 3 })

    // AN ECHO: the vault re-derives on every keystroke; the question did
    // not move.
    watch.reconfigure(tiny({ nagMs: { ms: 600_000, count: 3 } }))
    await sleep(30)
    expect(asks.length).toBe(1)

    // THE HEARTBEAT IS NOT ON THE WIRE — its move costs the stamped window
    // of future batches and nothing padi-side: no new subscription.
    watch.reconfigure(tiny({ nagMs: { ms: 600_000, count: 3 }, heartbeatMs: 1_800_000 }))
    await sleep(30)
    expect(asks.length).toBe(1)

    // A MOVED QUESTION: the debounce is padi's knob, so the subscription
    // ends and is re-specified.
    watch.reconfigure(tiny({ heldForMs: 0, nagMs: { ms: 600_000, count: 3 }, heartbeatMs: 1_800_000 }))
    await sleep(30)
    expect(asks.length).toBe(2)
    expect(asks[1]).toEqual({ heldForMs: 0, nagMs: 600_000, nagCount: 3 })
    const old = seen.events.length
    // A LATE batch from the predecessor's queue is stamped with the new
    // question's arrival, never ingrafted — the token guards it: frames
    // published by the dead run appear in NEITHER collector.
    await Effect.runPromise(Queue.offer(queues[0]!, [ev("transition", "ghost")]))
    await sleep(30)
    expect(seen.events.length).toBe(old)
    watch.stop()
  })

  it("attach(null) sunders the run; a re-attach re-asks with the question in force", async () => {
    const seen = collected()
    const asks: Array<PadiWatchStatesInput> = []
    const queues: Array<Queue.Queue<ReadonlyArray<PadiStateEvent>>> = []
    const makeFace = () => ({
      surface: {
        watchStates: {
          get: (input: PadiWatchStatesInput) => {
            asks.push(input)
            const queue = Effect.runSync(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
            queues.push(queue)
            return Stream.fromQueue(queue)
          },
        },
      },
    } as unknown as PadiSurfaceClient)
    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.reconfigure(tiny())
    watch.attach(makeFace())
    await sleep(30)
    expect(asks.length).toBe(1)

    // DETACHED — the link's own drop pushes this. Nothing under a dead
    // face counts as the fleet asking for attention.
    watch.attach(null)
    await sleep(30)
    const ghost = queues[0]!
    await Effect.runPromise(Queue.offer(ghost, [ev("transition", "during-the-flap")]))
    await sleep(30)
    expect(seen.events.length).toBe(0)

    // And back. The re-lead is padi's fresh snapshot — the ring ingrafts it
    // without any memory of the flap, daemon-side `since` carrying the hold.
    watch.attach(makeFace())
    await sleep(30)
    expect(asks.length).toBe(2)
    const fresh = queues[1]!
    await Effect.runPromise(Queue.offer(fresh, [ev("snapshot", "t1")]))
    await sleep(30)
    expect(seen.events.length).toBe(1)
    expect(seen.events[0]?.row?.terminal).toBe("t1")

    // ONE RING PER EPISODE, per question: the fence says t1's episode again
    // on the NEXT flap, and olai does not — it said that ring once.
    await Effect.runPromise(Queue.offer(fresh, [ev("snapshot", "t1")]))
    await sleep(30)
    expect(seen.events.length).toBe(1)
    // ...but an episode whose daemon `since` moved on is a NEW holding, and
    // a knob edit is a NEW question whose leading frame re-reports what
    // stands: neither is a retelling.
    await Effect.runPromise(Queue.offer(fresh, [ev("snapshot", "t1", { since: HELD_SINCE + 60_000 })]))
    await sleep(30)
    expect(seen.events.length).toBe(2)
    watch.reconfigure(tiny({ heldForMs: 0 }))
    await sleep(30)
    const third = queues[2]!
    await Effect.runPromise(Queue.offer(third, [ev("snapshot", "t1")]))
    await sleep(30)
    expect(seen.events.length).toBe(3)
    watch.stop()
  })

  it("the ring caps and evicts — a batch of 208 arrivals is the same breaths the timers used to give", async () => {
    const seen = collected()
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.attach(faceWith(queue))
    await sleep(30)
    await Effect.runPromise(Queue.offer(
      queue,
      Array.from({ length: 208 }, (_, i) => ev("transition", `t${i + 1}`, { at: EPOCH + i })),
    ))
    await sleep(50)

    const live = watch.events()
    expect(live.size).toBe(200)
    // The OLDEST EIGHT are out; the view a subscriber rebuilt from deltas
    // alone agrees — `readAll` cannot name what the wire evicted.
    expect(seen.ring().size).toBe(200)
    expect(live.has(seen.events[0]!.id)).toBe(false)
    expect(live.has(seen.events.at(-1)!.id)).toBe(true)
    // The BEAT counts BATCHES, not events: one frame, one stamp.
    expect(seen.beats.length).toBe(1)
    watch.stop()
  })

  it("a run whose fence REJECTS is said once, to the owner — no interval of ours ever re-fires it", async () => {
    const seen = collected()
    const warned: Array<string> = []
    const watch = makeWatch(seen.sink, {
      now: () => EPOCH,
      say: (line) => seen.said.push(line),
      warn: (line) => warned.push(line),
    })
    watch.reconfigure(tiny())
    const refusing = {
      surface: {
        watchStates: { get: () => Stream.fail(new Error("boom") as never) },
      },
    } as unknown as PadiSurfaceClient
    watch.attach(refusing)
    await sleep(120)
    // ONE LINE, on the OWNER's channel — a rejecting `done` is the shape
    // the framework's own table says a consumer must hear, and the pill's
    // amber cannot tell it from a quiet capped fleet on purpose. The
    // kill-the-dial half is the PR's stated deferral.
    expect(warned.filter((line) => line.includes("subscription ended")).length).toBe(1)
    expect(seen.events.length).toBe(0)
    watch.stop()
  })
})

  it("the caches are BOUNDED like the ring — an evicted row falls onto the synthesized arm, which already has its own answer", async () => {
    const seen = collected()
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
    const watch = makeWatch(seen.sink, { now: () => EPOCH })
    watch.attach(faceWith(queue))
    await sleep(30)
    // Fill past the lane bound: every id observed once, in order — the
    // oldest goes first (insertion order: a re-set is a long-standing
    // lane, and living longer is the bias both caches want).
    for (let i = 0; i < WATCH_LANES; i += 1) watch.observe(`lane-${i}`, row(`lane-${i}`, "working"))
    watch.observe("lane-late", row("lane-late", "working"))
    // The FIRST lane's facts are gone — and its event still draws: not
    // `undefined` facts, the synthesized quiet arm the margin already spells.
    await Effect.runPromise(Queue.offer(queue, [ev("transition", "lane-0")]))
    await sleep(30)
    const fired = seen.events[0]
    expect(fired?.row?.agentState).toBe("awaiting")
    expect(fired?.row?.pip?.glyph).toBe("terminal")
    expect(fired?.row?.pip?.hasAgent).toBe(true)
    watch.stop()
  })

describe("the ring through the half", () => {
  it("a linkless face never beats — folding, not counting: the tap is the subscription's stamp, and a no-padi machine has none", () => {
    const beats: Array<number> = []
    koluHalf<never>({
      options: null,
      fleet: () => undefined,
      events: () => undefined,
      pulse: () => undefined,
      claimants: () => [],
      config: () => ({ config: DEFAULT_WATCH, malformed: [] }),
      beating: (everyMs) => {
        beats.push(everyMs)
      },
      say: () => {},
      warn: () => {},
    })
    // NO BOOT BEAT. The old watcher pulsed once from its own constructor;
    // the pill on a machine with no padi reads the link cell's amber,
    // which is where the no-padi machine is already drawn.
    expect(beats).toEqual([])
  })

  it("wires the dial's edges into attach/detach — the subscription is a link-long thing", async () => {
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
    /** A face BOTH readers can stand on — the attention feeds, quiet, beside
     *  the watch's own stream member (`padi.surface.…`, the Dial's own
     *  shape). */
    const face = {
      padi: {
        surface: {
          terminalAttach: { get: () => Stream.never },
          urgency: {
            get: () => Stream.concat(
              Stream.make({ awaitingIds: [], finishedIds: [], workingIds: [], lingerIds: [] }),
              Stream.never,
            ),
          },
          activity: { get: () => Stream.concat(Stream.make([] as ReadonlyArray<string>), Stream.never) },
          terminals: { keys: () => Stream.concat(Stream.make([]), Stream.never), get: () => Stream.never },
          watchStates: { get: (_input: unknown) => Stream.fromQueue(queue) },
          screen: { text: () => Effect.succeed("") },
        },
      },
    }
    let closed: (() => void) | undefined
    const dial: Dial = () =>
      Effect.succeed({
        client: face,
        identity: { stateRoot: "/run/padi", surfaceVersion: SPEAKS },
        startedAt: 0,
        onClose: (cb: () => void) => {
          closed = cb
        },
        dispose: () => {},
      } as never)
    const edges: Array<PadiSurfaceClient | null> = []
    const mirror = makeMirror(
      {
        link: () => {},
        upsert: () => {},
        remove: () => {},
        clearedRow: () => {},
        face: (theFace) => {
          edges.push(theFace)
        },
        say: () => {},
      },
      { env: {}, now: () => new Date(EPOCH).toISOString(), dial },
    )
    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await sleep(60)
    // THE CONNECT EDGE: the live face, handed over whole.
    expect(edges.length).toBe(1)
    expect(edges[0]).not.toBe(null)
    // THE DROP EDGE: the link ends, and the watch's face goes with it — the
    // subscription's own "a live run for a dead padi cannot sit around".
    closed!()
    await sleep(60)
    expect(edges.at(-1)).toBe(null)
    await Effect.runPromise(Fiber.interrupt(fiber))
  })
})
