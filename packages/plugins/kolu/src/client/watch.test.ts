/**
 * THE ATTENTION WATCHER — the brief's five cases, and the timers.
 *
 * What is driven HERE are the semantics `./watch.ts` owns; what is proved
 * over `./mirror.test.ts`'s ground is the CHAIN: padi's attention words,
 * folded by the mirror, seen by the watcher the way the mirror publishes —
 * which is the defeat the brief plans the daemon's own watcher being named
 * for: nothing in `./watch.ts` can make a bell out of bytes.
 *
 * ## The clocks
 *
 * The hold clock is REAL but SMALL — the tests spell forty to ninety
 * milliseconds for sixty seconds — because this module takes a clock for
 * the WORDS only (`options.now`) and real timers for the pacing; small real
 * timers is the honest trade — an injected scheduler would prove the watch
 * obeys the clock it was given, rather than that the holds arm and die in
 * the order they were armed, which is the whole question. Bun's per-test
 * five seconds are plenty for each.
 */

import { describe, expect, it } from "bun:test"
import { Effect, Fiber, Stream } from "effect"

import { koluHalf } from "./index.ts"
import { type Dial, SPEAKS } from "./link.ts"
import { makeMirror } from "./mirror.ts"
import { DEFAULT_WATCH, makeWatch, type WatchConfig } from "./watch.ts"
import type { FleetTerminal, KoluEvent } from "./wire/index.ts"
import { UNOWNED } from "./wire/index.ts"

/** One timed wait, small and honest — see the header. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A KNOB SET shortened to test scale: a minute is 40 ms, ten is 110, half an
 *  hour is a breath's width of 400 — the HOLD windows only; the heartbeat
 *  stays parked at "far away" unless a case is about its cadence. */
const tiny = (extra?: Partial<WatchConfig>): WatchConfig => ({
  heldForMs: 40,
  nagMs: 110,
  heartbeatMs: 60_000,
  ...extra,
})

/** A FLEET ROW, wire-shaped: what the mirror's `rows().get(id)` holds and
 *  what `./watch.ts` reads. The four fields the watcher computes off, and a
 *  quiet working face for the rest. */
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

/**
 * The events and the ring, collected. `sets` is every event as it went;
 * `ring()` is the live view, eviction included — the two halves of "the
 * watcher's arrivals", as `./watch.ts`'s sink given a writer.
 */
const collected = () => {
  const sets: Array<string> = []
  /** The MIRROR's channel, not the watcher's: the sink lost its `say` with
   *  the ambiguous-mute sentence, and the one case below that drives the
   *  chain still has to give `makeMirror` somewhere to talk. */
  const said: Array<string> = []
  const sets_full: Array<KoluEvent> = []
  const ring = new Map<string, KoluEvent>()
  /** Every beat as it landed on the sink: the pill's recency, which LIVES
   *  here since the beat came out of the ring (see `./watch.ts`'s header). */
  const beats: Array<{ at: string; everyMs: number }> = []
  return {
    sets,
    said,
    say: (line: string) => said.push(line),
    events: sets_full,
    beats,
    ring: () => new Map(ring),
    sink: {
      emit: (event: KoluEvent) => {
        sets.push(event.id)
        sets_full.push(event)
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

describe("the attention watcher", () => {
  it("boots with a heartbeat and tells no other lies", () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => 1_700_000_000_000 })
    // THE BEAT IS IMMEDIATE — the pill stamps once at boot, and the RING
    // holds attention only: a feed opened one breath in answers "quiet"
    // with a pulse, never with a ring row.
    expect(seen.beats.length).toBe(1)
    expect(seen.beats[0]?.at).toBe(new Date(1_700_000_000_000).toISOString())
    expect(seen.beats[0]?.everyMs).toBe(DEFAULT_WATCH.heartbeatMs)
    expect(seen.events.filter((e) => e.kind === "heartbeat").length).toBe(0)
    watch.stop()
  })

  it("fires a `transition` only once the state has HELD past the window", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny())

    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(18)
    // WITHIN THE WINDOW: the terminal is waiting, but the rule is that it
    // has been so for long enough to say so — forty ms on a test clock.
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(0)

    await sleep(60)
    const fired = seen.events.filter((e) => e.kind === "transition")
    expect(fired.length).toBe(1)
    // The event says what it saw — `state` is the BUCKET, carried whole.
    expect(fired[0]?.row?.state).toBe("awaiting")
    expect(fired[0]?.row?.terminal).toBe("t1")
    // The FROZEN draw: live flags stamped out. See `./watch.ts`'s stamp —
    // a two-hour-old event must not flash LIVE.
    expect(fired[0]?.row?.pip?.active).toBe(false)
    expect(fired[0]?.row?.pip?.bytesLive).toBe(false)
    watch.stop()
  })

  it("does not fire at all if the state eases inside the window", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny())

    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(18)
    // The agent moved on — the window closed silently.
    watch.observe("t1", row("t1", "thinking"))
    await sleep(60)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(0)
    watch.stop()
  })

  it("answers a long hold with one transition, then `nag`s on the cadence", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny())

    watch.observe("t1", row("t1", "waiting"))
    await sleep(40 + 30)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)

    await sleep(110 + 50)
    // FIRST NAG: still waiting, one interval later.
    expect(seen.events.filter((e) => e.kind === "nag").length).toBe(1)
    expect(seen.events.at(-1)?.row?.state).toBe("waiting")

    await sleep(110 + 50)
    // THE NEXT ONE. The cadence is measured from the LAST thing said, never
    // from the first — see `fireNag`'s doc. Small real timers are
    // calibration, not arithmetic, so the count is a floor rather than an
    // equality: two full intervals beyond the transition, at least.
    expect(seen.events.filter((e) => e.kind === "nag").length).toBeGreaterThanOrEqual(2)
    watch.stop()
  })

  it("fires for a SECOND held bucket too — waiting → awaiting is a new hold", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny())

    watch.observe("t1", row("t1", "waiting"))
    await sleep(40 + 30)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)

    // The state CHANGED held buckets, mid-nag: the nag's craft is over and
    // a new debounce is on. Two buckets are spelled two ways for a reason.
    watch.observe("t1", { ...row("t1", "awaiting_user"), bucket: "awaiting" })
    await sleep(18)
    // The second window has not battened yet — one nag's worth of noise is
    // feared, not hoped: nothing has earned a second event YET.
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)
    await sleep(60)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(2)
    expect(seen.events.at(-1)?.row?.state).toBe("awaiting")
    watch.stop()
  })

  it("pulses on the heartbeat's cadence, not a keystroke's", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heartbeatMs: 200 }))

    // The test's arrival at t≈0 includes the DETAIL of the eat: the
    // reconfigure MOVES the heartbeat (200 ≠ default) — `rearmHeartbeat`'s
    // the-forward-fond eat is the answer it gives ON the eat. Then 120 ms
    // into the new 200-cycle: the two of them, and nothing else. An echoed
    // knob (what every vault keystroke hands the watch) leaves the
    // in-flight interval alone, so the next beat lands 80 ms hence — a
    // clear-then-re-arm would charge a full 200, and the count is where
    // that shows.
    await sleep(120)
    expect(seen.beats.length).toBe(2)
    watch.reconfigure(tiny({ heartbeatMs: 200 }))
    await sleep(90)
    expect(seen.beats.length).toBe(3)

    // Raising the knob answers with ONE beat — `reconfigure`'s echo
    // guard eats the keystroke (beats stay 3), but the moved knob
    // `rearmHeartbeat` restsamp at once AND lands a 4th one: the eat's
    // stamp says the new cadence NOW, so the door never has to read the
    // shorter one's margin off the previous `everyMs` for two whole
    // windows)
    watch.reconfigure(tiny({ heartbeatMs: 10_000 }))
    expect(seen.beats.length).toBe(4)
    expect(seen.beats[3]?.everyMs).toBe(10_000)
    await sleep(100)
    expect(seen.beats.length).toBe(4)
    // The ring holds the ATTENTION rows, and nothing else — the beat is
    // not a row, and never was one (see the header).
    expect(seen.events.filter((e) => e.kind === "heartbeat").length).toBe(0)
    watch.stop()
  })

  it("a LOWERED `held-for` re-arms the debounce without re-asking TIME", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    // Long window first, then the LOWERED edit while the hold is settled.
    // (A raised one sits out the difference — see `reconfigure`.)
    watch.reconfigure(tiny({ heldForMs: 400 }))
    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(30)
    watch.reconfigure(tiny({ heldForMs: 50 }))
    // The hold has 20 ms left under the new knob — a re-DATED hold (the
    // easy bug) would have answered at 480 ms, and nothing would have seen.
    await sleep(80)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)
    watch.stop()
  })

  it("removes a terminal's hold with the terminal", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny())

    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(20)
    watch.remove("t1")
    await sleep(80)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(0)
    watch.stop()
  })

  it("editing `held-for` mid-lodge does not touch a fired hold's nag pace", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heldForMs: 40, nagMs: 80 }))

    watch.observe("t1", row("t1", "waiting"))
    await sleep(190)
    // FIRED, the debounce spent; the first nag lands at emission+80.
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)
    expect(seen.events.filter((e) => e.kind === "nag").length).toBe(1)

    // A knob the nag does not care about must not push it out. A re-ARM by
    // now+nag would put the next one 80 ms from the edit; the cadence
    // keeps — measured from the last EMISSION through `armNag`.
    watch.reconfigure(tiny({ heldForMs: 400, nagMs: 80 }))
    await sleep(60)
    expect(seen.events.filter((e) => e.kind === "nag").length).toBeGreaterThanOrEqual(2)
    watch.stop()
  })

  it("a moved nag knob re-arms from the LAST EMISSION, not from the edit", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heldForMs: 40, nagMs: 200 }))

    watch.observe("t1", row("t1", "waiting"))
    await sleep(60)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)

    // The transition fired; the editor lowers `nag` 60 ms later, so the
    // next one lands at emission+100 — not EDIT+100, which is opus's
    // minute-long typing of one file, shelved at a hundredth the clock.
    await sleep(60)
    watch.reconfigure(tiny({ heldForMs: 40, nagMs: 100 }))
    await sleep(50)
    expect(seen.events.filter((e) => e.kind === "nag").length).toBeGreaterThanOrEqual(1)
    watch.stop()
  })

  it("the ring caps and evicts, in both directions", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heldForMs: 5, nagMs: 60_000 }))
    // 208 arrivals into a ring of 200, for the evict-on-eight-threshold the
    // assertions below count on. ( beats never REACH the ring now — the
    // fill is attention rows or nothing. )
    for (let i = 1; i <= 208; i += 1) {
      watch.observe(`t${i}`, row(`t${i}`, "waiting"))
    }
    await sleep(70)
    // The two halves of "the cap fired": the oldest ids are GONE from the
    // live ring (the deltas saw them drop) and the newest arrived.
    const live = watch.events()
    expect(live.size).toBe(200)
    const ghosted = seen.events.slice(0, 8).filter((e) => !live.has(e.id))
    expect(ghosted.length).toBe(8)
    expect(live.has(seen.events.at(-1)!.id)).toBe(true)
    // And the view a subscriber rebuilt from deltas alone agrees —
    // `readAll` cannot name what the wire evicted.
    expect(seen.ring().size).toBe(200)
    expect(seen.ring().has(seen.events.at(-1)!.id)).toBe(true)
    watch.stop()
  })

  it("stops cleanly — no timer outlives it", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heartbeatMs: 45 }))
    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(18)
    watch.stop()
    // What the ring SAYS at stop time, before any timer could count down.
    const atStop = seen.events.length
    await sleep(120)
    expect(seen.events.length).toBe(atStop)
  })
})

describe("a link drop is not a closing fleet", () => {
  it("the flap fires nothing — no transition the wire already said", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heldForMs: 40, nagMs: 110 }))
    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(70)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)
    const saidSince = seen.events.find((e) => e.kind === "transition")!.row!.since

    // THE FLAP: rows fall, the link says nothing, time alone talks. Through
    // the blind span, the nag arm would have fired — save no.
    watch.suspend("t1")
    await sleep(140)
    expect(seen.events.filter((e) => e.kind === "nag").length).toBe(0)

    // AND RESUME. A re-dated hold would answer at once; the hold's own
    // clock keeps ticking — the DEBT of the nag the blind span swallowed
    // folds especially: the row was waiting through the flap, so the
    // next said is fired on the row's return, by the same arithmetic the
    // soak's own `kolu watch` runs on a reconnect of its own daemon.
    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(40)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)
    const nags = seen.events.filter((e) => e.kind === "nag")
    expect(nags.length).toBe(1)
    // And the said hands the ORIGINAL `since` — the flap's lie is exactly
    // what it doesn't say.
    expect(nags[0]!.row!.since).toBe(saidSince)
    await sleep(120)
    // And the cadence resumes: the next one rides emission+110 from THAT
    // emission — its own.
    expect(seen.events.filter((e) => e.kind === "nag").length).toBeGreaterThanOrEqual(2)
    watch.stop()
  })

  it("a hold that crossed its window while the fleet was blind fires on its return", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heldForMs: 40, nagMs: 110 }))
    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(20)
    // Suspended INSIDE the debounce at 20 of 40; the blind span swallows
    // five times the window.
    watch.suspend("t1")
    await sleep(200)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(0)
    // On the resume the math reads left from `since + heldFor`: the debt
    // lands at once, once — not re-deferred the flap's length.
    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(30)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(1)
    watch.stop()
  })

  it("a preserved hold answers only to its own bucket — a different one is a renewed hold", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heldForMs: 40, nagMs: 110 }))
    watch.observe("t1", row("t1", "awaiting_user"))
    await sleep(70)
    const flappedAt = seen.events.filter((e) => e.kind === "transition").length
    expect(flappedAt).toBe(1)

    // The flap, and the id RETURNS in the OTHER held bucket: it is the rule
    // `observe` always holds — one hold closes, another opens with its own
    // since — and the flap changes nothing about it.
    watch.suspend("t1")
    await sleep(100)
    watch.observe("t1", row("t1", "waiting"))
    await sleep(70)
    expect(seen.events.filter((e) => e.kind === "transition").length).toBe(2)
    watch.stop()
  })
})

// ── Over the mirror's own records ─────────────────────────────────────────

/**
 * THE CHAIN: padi's record → the mirror's row → the watch's event.
 *
 * The unit cases above drive rows by hand; this one proves the wiring that
 * `koluHalf`'s four lines (`./index.ts`'s `upsert`) describe — the watch is
 * fed by the mirror's publications, same tick, same row — by standing both
 * on the same fake far end: a real `makeMirror` drive against `face = the
 * near side of padi`, exactly `./mirror.test.ts`'s idiom, and a flip from
 * the idle agent record to `awaiting_user` the watch then reports.
 */

const faceFlipping = (record1: object, record2: object) => ({
  padi: {
    surface: {
      terminalAttach: { get: () => Stream.never },
      urgency: {
        get: () =>
          Stream.concat(
            Stream.make({
              awaitingIds: [],
              finishedIds: [],
              workingIds: [],
              lingerIds: [],
            }),
            Stream.never,
          ),
      },
      activity: {
        get: () => Stream.concat(Stream.make([] as ReadonlyArray<string>), Stream.never),
      },
      terminals: {
        keys: () => Stream.concat(Stream.make(["t1"]), Stream.never),
        get: (_input: { key: string }) =>
          // TWO RECORDS — padi's `get` is a WATCH: the first frame is what
          // it remembers, every later frame is a move, and the mirror folds
          // each one as it lands.
          Stream.concat(
            Stream.concat(Stream.make(record1 as never), Stream.make(record2 as never)),
            Stream.never,
          ),
      },
      screen: { text: () => Effect.succeed("") },
    },
  },
})

const dialTo = (record1: object, record2: object): Dial =>
() =>
  Effect.succeed({
    client: faceFlipping(record1, record2),
    identity: { stateRoot: "/run/padi", surfaceVersion: SPEAKS },
    startedAt: 0,
    onClose: () => {},
    dispose: () => {},
  } as never)

describe("the watcher's chain through the mirror", () => {
  it("a flip to `awaiting_user` over the wire is one `transition`", async () => {
    const seen = collected()
    const watch = makeWatch(seen.sink, { now: () => Date.now() })
    watch.reconfigure(tiny({ heartbeatMs: 10_000 }))
    const mirror = makeMirror(
      {
        link: () => {},
        upsert: (id: string, row: FleetTerminal) => watch.observe(id, row),
        remove: (id: string) => watch.remove(id),
        clearedRow: (id: string) => watch.suspend(id),
        say: seen.say,
      },
      {
        env: {},
        now: () => new Date().toISOString(),
        dial: dialTo(
          {
            state: "active",
            agent: null,
            pr: { kind: "absent" },
            cwd: "/tmp/a",
            git: null,
            lastActivityAt: null,
          },
          {
            state: "active",
            agent: { kind: "claude-code", state: "awaiting_user", summary: null },
            pr: { kind: "absent" },
            cwd: "/tmp/b",
            git: null,
            lastActivityAt: null,
          },
        ),
      },
    )

    const fiber = Effect.runFork(Effect.scoped(mirror.run))
    await sleep(80)
    // The FIRST frame is the idle agent record — the debounce has not armed
    // (nothing has been said); the flip arrives INSIDE the first window.
    const fired = () => seen.events.filter((e) => e.kind === "transition")
    await sleep(80)
    expect(fired().length).toBe(1)
    expect(fired()[0]?.row?.state).toBe("awaiting")
    await Effect.runPromise(Fiber.interrupt(fiber))
    watch.stop()
  })
})

/**
 * THE BEAT'S SECOND READER — the tap `olai-plugin-kolu`'s doorbell hangs its
 * floor-under-silence on.
 *
 * The pill has always drawn the beat; what is new is that a conversation's
 * quiet is now measured in the SAME beats, through `KoluDeps.beating`. These
 * two cases are about that seam rather than about the watcher's pacing: that
 * the tap rides the beat the sink already publishes, and that it carries the
 * cadence IN FORCE rather than the one the process booted on — a doorbell told
 * "thirty minutes" while the vault now says one would report a silence half an
 * hour longer than the one it is actually about.
 *
 * WHY NOT A SECOND TIMER, which is the alternative this closes: a heartbeat
 * armed one package up would be a second cadence beside the `heartbeat` knob,
 * and the day the two disagreed there would be no way to say which one the
 * person who edited the vault had meant.
 */
describe("the beat's doorbell tap", () => {
  /** A LINKLESS half — no dial, no fleet, no surface. The watcher is built for
   *  every face (`./index.ts` says why), so the beat is the one thing that
   *  happens on a machine with no kolu at all, which is exactly the case a
   *  floor under silence has to survive. */
  const halfBeating = (knob: () => number, beats: Array<number>) =>
    koluHalf<never>({
      options: null,
      fleet: () => undefined,
      events: () => undefined,
      pulse: () => undefined,
      claimants: () => [],
      config: () => ({ config: { ...DEFAULT_WATCH, heartbeatMs: knob() }, malformed: [] }),
      beating: (everyMs) => {
        beats.push(everyMs)
      },
      say: () => {},
      warn: () => {},
    })

  it("beats once at boot, with the cadence the defaults name", () => {
    const beats: Array<number> = []
    const half = halfBeating(() => DEFAULT_WATCH.heartbeatMs, beats)
    expect(beats).toEqual([DEFAULT_WATCH.heartbeatMs])
    // ...and the case takes its own timer back out, which is the sentence the
    // case below is entirely about: a half a test built and walked away from
    // left a half-hour interval armed in the suite's process.
    half.stop()
  })

  it("carries the cadence a knob move put in force, and a keystroke is not a beat", () => {
    const beats: Array<number> = []
    let knob = DEFAULT_WATCH.heartbeatMs
    const half = halfBeating(() => knob, beats)
    knob = 60_000
    half.revision([], null)
    expect(beats).toEqual([DEFAULT_WATCH.heartbeatMs, 60_000])
    // The vault re-derives on every keystroke; only a MOVED knob re-arms, which
    // is this module's own echo-guard seen from the doorbell's end. Without it a
    // busy vault would beat per keystroke and no window would ever be quiet.
    half.revision([], null)
    expect(beats.length).toBe(2)
    half.stop()
  })

  /**
   * THE HALF'S OWN TEARDOWN — the case the leak was found by, and the one the
   * plugin's finalizer exists to spend.
   *
   * The watcher arms its interval inside `makeWatch`, which `koluHalf` calls
   * inside ITS constructor, so a half is beating from the moment it is built —
   * before anything binds, and whether or not anything ever does. Its only
   * other stop hangs on the sibling connector's interruption, and a half
   * disposed before the surface bound has no connector to be interrupted: the
   * interval simply outlived the thing that armed it, with nothing left holding
   * a reference to either. `olai-plugin-kolu`'s `server.ts` hangs
   * `Effect.addFinalizer` on this door for exactly that reason.
   *
   * A REAL TIMER at test scale, this file's own trade (see the header): twenty
   * milliseconds for half an hour, and the claim is about arming and clearing
   * rather than about the pacing, which the cases above own.
   */
  it("stops beating when the half stops, so a half nobody bound is not still armed", async () => {
    const beats: Array<number> = []
    const half = halfBeating(() => 20, beats)
    // The boot beat is at the DEFAULTS: the knob only enters through a
    // revision, which is the seam the case above establishes.
    half.revision([], null)
    await sleep(70)
    const beating = beats.length
    expect(beating).toBeGreaterThan(2)
    half.stop()
    // ...and NOTHING after it. Without the door this asserts, this window would
    // carry three more beats out of a half nobody owns any more.
    await sleep(70)
    expect(beats.length).toBe(beating)
  })
})
