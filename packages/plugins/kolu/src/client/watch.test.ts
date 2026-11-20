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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const tiny = (extra?: Partial<WatchConfig>): WatchConfig => ({
  heldForMs: 60_000,
  nagMs: { ms: 600_000 },
  heartbeatMs: 60_000,
  ...extra,
})

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
      beat: (receivedAt: string, everyMs: number) => {
        beats.push({ at: receivedAt, everyMs })
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
    expect(fired[0]?.kind).toBe("transition")
    expect(fired[0]?.row?.terminal).toBe("t1")
    expect(fired[0]?.row?.state).toBe("awaiting")
    expect(fired[0]?.row?.agentState).toBe("awaiting_user")
    expect(fired[0]?.row?.label).toBe("the terminal door")
    expect(fired[0]?.row?.pip?.active).toBe(false)
    expect(fired[0]?.row?.pip?.bytesLive).toBe(false)
    expect(fired[0]?.row?.since).toBe(new Date(HELD_SINCE).toISOString())
    expect(fired[1]?.kind).toBe("nag")
    expect(fired[1]?.nag).toEqual({ index: 1 })

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

    await Effect.runPromise(Queue.offer(queue, []))
    await sleep(30)
    expect(seen.beats.length).toBe(1)
    expect(seen.beats[0]?.at).toBe(new Date(EPOCH).toISOString())
    expect(seen.beats[0]?.everyMs).toBe(30_000)
    expect(seen.events.length).toBe(0)

    await Effect.runPromise(Queue.offer(queue, [ev("transition", "t1", { at: EPOCH + 500 })]))
    await sleep(30)
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

    watch.reconfigure(tiny({ nagMs: { ms: 600_000, count: 3 } }))
    await sleep(30)
    expect(asks.length).toBe(1)

    watch.reconfigure(tiny({ nagMs: { ms: 600_000, count: 3 }, heartbeatMs: 1_800_000 }))
    await sleep(30)
    expect(asks.length).toBe(1)

    watch.reconfigure(tiny({ heldForMs: 0, nagMs: { ms: 600_000, count: 3 }, heartbeatMs: 1_800_000 }))
    await sleep(30)
    expect(asks.length).toBe(2)
    expect(asks[1]).toEqual({ heldForMs: 0, nagMs: 600_000, nagCount: 3 })
    const old = seen.events.length
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

    watch.attach(null)
    await sleep(30)
    const ghost = queues[0]!
    await Effect.runPromise(Queue.offer(ghost, [ev("transition", "during-the-flap")]))
    await sleep(30)
    expect(seen.events.length).toBe(0)

    watch.attach(makeFace())
    await sleep(30)
    expect(asks.length).toBe(2)
    const fresh = queues[1]!
    await Effect.runPromise(Queue.offer(fresh, [ev("snapshot", "t1")]))
    await sleep(30)
    expect(seen.events.length).toBe(1)
    expect(seen.events[0]?.row?.terminal).toBe("t1")

    await Effect.runPromise(Queue.offer(fresh, [ev("snapshot", "t1")]))
    await sleep(30)
    expect(seen.events.length).toBe(1)
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
    expect(seen.ring().size).toBe(200)
    expect(live.has(seen.events[0]!.id)).toBe(false)
    expect(live.has(seen.events.at(-1)!.id)).toBe(true)
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
    for (let i = 0; i < WATCH_LANES; i += 1) watch.observe(`lane-${i}`, row(`lane-${i}`, "working"))
    watch.observe("lane-late", row("lane-late", "working"))
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
    expect(beats).toEqual([])
  })

  it("wires the dial's edges into attach/detach — the subscription is a link-long thing", async () => {
    const queue = await Effect.runPromise(Queue.unbounded<ReadonlyArray<PadiStateEvent>>())
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
    expect(edges.length).toBe(1)
    expect(edges[0]).not.toBe(null)
    closed!()
    await sleep(60)
    expect(edges.at(-1)).toBe(null)
    await Effect.runPromise(Fiber.interrupt(fiber))
  })
})
