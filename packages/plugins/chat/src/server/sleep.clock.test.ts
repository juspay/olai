/**
 * THE PASS'S OWN JUDGEMENT, ON A CLOCK A TEST MOVES.
 *
 * `./sleep.test.ts` runs the pass over a real scheduler and a real ACP
 * subprocess, which is what makes its claims about TURNS evidence — and which
 * also means its clock is the machine's, so nothing there can ask what happens
 * after twenty minutes, or after a day. This file drives the other half: the
 * rules that are statements about TIME, over stubbed doors and no process at
 * all.
 *
 * THAT SPLIT IS THE CONTRACT'S, not the tests': what the pass watches arrives
 * through a `ReadingObserver`, and the one thing it does to a conversation is
 * stop its turn ({@link ./sleep.ts}'s `Stoppable`). A pass that only knew how to
 * hold a `Panel` could not be asked any of this without a subprocess behind
 * every question.
 *
 * Every case is EXACT rather than approximate: the test clock starts at a fixed
 * instant and is moved by the span under test, so "six hours have passed" is a
 * thing this file says rather than a thing it waits for.
 */

import { type NodeAgent, UsageFailure } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Duration, Effect, Exit, Fiber, Scope } from "effect"
import { TestClock } from "effect/testing"

import type { LiveSession, ReadingObserver } from "../scoped.ts"
import { CHAT_OFF, type ChatState } from "../wire/members.ts"
import type { Sleeping } from "./sleep.ts"
import { makeSleeper } from "./sleep.ts"

/** THE INSTANT EVERY CASE STARTS AT, and one the fixture's stamps are older
 *  than: a reading whose stamps were in the future would make every candidate
 *  "recently touched" and prove nothing. */
const NOW = Date.parse("2026-10-12T09:00:00Z")

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const AGENT: NodeAgent = {
  id: "health",
  file: "Work.olai",
  title: "Health",
  engine: "claude",
  session: "sess-1",
  memory: 2,
}

const stamp = (at: number): string => new Date(at).toISOString()

/** A node with one stamped row under it — memory that has moved. */
const vault = (changed: string): Record<string, string> => ({
  "Work.olai": [
    `{"id":"health","ord":"a0","title":"Health"}`,
    `{"id":"note","parent":"health","ord":"a0","title":"a note","changed":"${changed}"}`,
  ].join("\n") + "\n",
})

/** One state the conversation reports, as the panel would. */
const thinking = (over: Partial<ChatState> = {}): ChatState => ({
  ...CHAT_OFF,
  status: "thinking",
  ...over,
})

interface Arms {
  /** One pass, driven by hand. */
  readonly tick: Effect.Effect<boolean, never, Scope.Scope>
  /** What the pass did, in order. */
  readonly events: Array<string>
  /** One entry per turn handed to a conversation. */
  readonly delivers: Array<string>
  readonly memos: Array<unknown>
  readonly commits: Array<{ readonly message: string; readonly paths: ReadonlyArray<string> }>
  readonly warnings: Array<string>
  /** How many times the pass read the set — what the loop's cadence is measured
   *  in. */
  readonly reads: () => number
}

const withStubs = (over: {
  /** What the conversation reports once the turn is handed over. */
  readonly states?: ReadonlyArray<ChatState>
  readonly live?: ReadonlyMap<string, LiveSession>
  readonly changed?: string
  readonly after?: Duration.Duration
  readonly start?: Duration.Duration
  readonly question?: Duration.Duration
  /** Whether the vault takes the memo. `false` is the pass's other failure. */
  readonly writes?: boolean
} = {}): Effect.Effect<Arms, never, Scope.Scope> =>
  Effect.gen(function*() {
    const events: Array<string> = []
    const delivers: Array<string> = []
    const memos: Array<unknown> = []
    const commits: Array<{ message: string; paths: ReadonlyArray<string> }> = []
    const warnings: Array<string> = []
    let reads = 0
    let observer: ReadingObserver | null = null
    const states = over.states ?? [
      thinking(),
      { ...CHAT_OFF, status: "idle", trouble: null },
    ]
    const doors: Sleeping = {
      nodes: () => [AGENT],
      sleptAt: () => null,
      sleptKey: () => "chat-agent-slept",
      live: () => over.live ?? new Map(),
      read: Effect.sync(() => {
        reads += 1
        return readingOf(setOf(vault(over.changed ?? stamp(NOW - HOUR))))
      }),
      // THE CONVERSATION, AS THE PANEL PRESENTS IT: the state it is in when the
      // reading is taken, and then whatever the script says once the turn is
      // handed over. A turn's ENDING is a state rather than a clock, which is
      // the one thing this stub has to get right.
      watch: (_to, held) =>
        Effect.sync(() => {
          observer = held
          held.state({ ...CHAT_OFF, status: "idle" })
          held.transcript({ upserts: [], removes: [], appends: [] })
          return { cancel: Effect.sync(() => void events.push("cancelled")) }
        }),
      deliver: (_to, say) =>
        Effect.sync(() => {
          events.push("delivered")
          delivers.push(say() ?? "")
          for (const state of states) observer?.state(state)
        }),
      withdraw: () => Effect.sync(() => void events.push("withdrawn")),
      write: () => over.writes === false
        ? Effect.fail(new UsageFailure({ reason: "the vault refused the write" }))
        : Effect.sync(() => {
          memos.push("memo")
          return {}
        }),
      waiting: Effect.succeed([{ file: "Work.olai", path: "Work.olai" }]),
      commit: (message, paths) => Effect.sync(() => {
        events.push("committed")
        commits.push({ message, paths })
        return null
      }),
      hold: Effect.acquireRelease(
        Effect.sync(() => void events.push("hold")),
        () => Effect.sync(() => void events.push("released")),
      ),
      after: over.after ?? Duration.millis(0),
      tick: Duration.minutes(15),
      question: over.question ?? Duration.minutes(20),
      start: over.start ?? Duration.minutes(2),
      log: () => Effect.void,
      warn: (line) => Effect.sync(() => void warnings.push(line)),
    }
    const sleeper = yield* makeSleeper(doors)
    return { tick: sleeper.tick, events, delivers, memos, commits, warnings, reads: () => reads }
  })

/** One case, on a test clock started at {@link NOW}. */
const onTheClock = <A>(body: Effect.Effect<A, never, Scope.Scope>): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* TestClock.setTime(NOW)
      return yield* body
    })).pipe(Effect.provide(TestClock.layer())),
  )

/** Let the fibers the clock just woke run before anything is asserted.
 *  `Effect.yieldNow` is a VALUE in this Effect — the callable one is
 *  `yieldNowWith`. */
const settle = Effect.yieldNow

test("a question past its deadline is cancelled, said out loud, and writes nothing", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({
      states: [thinking({ asking: 0 }), thinking({ asking: 1 })],
    })
    const pass = yield* Effect.forkChild(arms.tick)
    // THE TURN IS RUNNING AND ASKING, and nothing else will happen until the
    // deadline — which is a thing this test says rather than waits for.
    yield* TestClock.adjust(Duration.millis(19 * MIN))
    yield* settle
    expect(arms.delivers).toHaveLength(1)
    expect(arms.events).not.toContain("cancelled")
    yield* TestClock.adjust(Duration.millis(MIN + 1))
    expect(yield* Fiber.join(pass)).toBe(true)
    expect(arms.events).toEqual(["hold", "delivered", "cancelled", "withdrawn", "released"])
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
    expect(arms.warnings.join("\n")).toContain("asked a question nobody is there to answer")
  })))

test("a turn that never starts is given up on, and its words taken back", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({ states: [], start: Duration.minutes(2) })
    const pass = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    expect(arms.events).toEqual(["hold", "delivered"])
    yield* TestClock.adjust(Duration.millis(MIN + 1))
    expect(yield* Fiber.join(pass)).toBe(true)
    expect(arms.events).toEqual(["hold", "delivered", "withdrawn", "released"])
    expect(arms.warnings.join("\n")).toContain("the turn never started")
  })))

test("trouble mid-turn is a failed pass, and writes nothing", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({
      states: [thinking(), thinking({ trouble: "the agent died" })],
    })
    expect(yield* arms.tick).toBe(true)
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
    expect(arms.warnings.join("\n")).toContain("the turn went wrong")
  })))

test("a failed node is left alone for a day, and is due again after that", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({ writes: false })
    expect(yield* arms.tick).toBe(true)
    expect(arms.warnings.join("\n")).toContain("the memo could not be written")
    // THE BACK-OFF, exactly: a day less a minute is still inside it.
    yield* TestClock.adjust(Duration.millis(23 * HOUR))
    expect(yield* arms.tick).toBe(false)
    yield* TestClock.adjust(Duration.millis(HOUR + 1))
    expect(yield* arms.tick).toBe(true)
  })))

test("an asleep node whose memory moved inside the span waits, and sleeps once it has", () =>
  onTheClock(Effect.gen(function*() {
    // THE CASE A CLOCK IS FOR: the stamp is half an hour old and the span is six
    // hours, so this node becomes due at a knowable instant.
    const arms = yield* withStubs({
      changed: stamp(NOW - 30 * MIN),
      after: Duration.hours(6),
    })
    expect(yield* arms.tick).toBe(false)
    yield* TestClock.adjust(Duration.millis(5 * HOUR))
    expect(yield* arms.tick).toBe(false)
    yield* TestClock.adjust(Duration.millis(HOUR + 1))
    expect(yield* arms.tick).toBe(true)
    expect(arms.commits).toHaveLength(1)
  })))

test("a conversation with a question open, and one that refused to open, are left alone", () =>
  onTheClock(Effect.gen(function*() {
    for (const live of [
      new Map([["health", { status: "idle" as const, asking: 1, since: stamp(NOW - DAY) }]]),
      new Map([["health", { status: "idle" as const, asking: 0, unopened: true, since: stamp(NOW - DAY) }]]),
    ]) {
      const arms = yield* withStubs({ live })
      expect(yield* arms.tick).toBe(false)
      expect(arms.delivers).toEqual([])
    }
  })))

test("two passes never overlap, however many callers there are", () =>
  onTheClock(Effect.gen(function*() {
    // THE PERMIT, and not the loop's shape: `tick` is handed back so a test can
    // drive a pass by hand, and two callers of it would be two passes over one
    // directory at once.
    const arms = yield* withStubs({
      states: [thinking({ asking: 0 }), thinking({ asking: 1 })],
    })
    const first = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    const second = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    // ONE TURN, though two passes were asked for: the second is waiting for the
    // first to end.
    expect(arms.delivers).toHaveLength(1)
    yield* TestClock.adjust(Duration.millis(19 * MIN))
    expect(yield* Fiber.join(first)).toBe(true)
    // ...and when it does end the node has failed, so the second pass finds
    // nothing to do rather than starting a turn of its own.
    expect(yield* Fiber.join(second)).toBe(false)
    expect(arms.delivers).toHaveLength(1)
  })))

test("the loop stops when the scope it was forked into closes", () =>
  onTheClock(Effect.gen(function*() {
    // THE PASS'S OWN SCOPE, as a serve gives it: the chat row's fork. A loop
    // that outlived that scope would be work nobody owns.
    const scope = yield* Scope.make()
    const arms = yield* Effect.provideService(withStubs(), Scope.Scope, scope)
    yield* TestClock.adjust(Duration.millis(16 * MIN))
    yield* settle
    const awake = arms.reads()
    expect(awake).toBeGreaterThan(0)
    yield* Scope.close(scope, Exit.void)
    yield* TestClock.adjust(Duration.millis(2 * HOUR))
    yield* settle
    expect(arms.reads()).toBe(awake)
  })))
