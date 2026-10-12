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
import { Clock, Duration, Effect, Exit, Fiber, Scope } from "effect"
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

/**
 * One state the conversation reports, as the panel would — AND MARKED, because
 * that is what the panel does with a turn olai's own body began
 * (`chat.ts`'s `begin`): `sleep: true` for exactly as long as that turn lasts.
 * A case about a PERSON's turn says `sleep: false` and means it.
 */
const thinking = (over: Partial<ChatState> = {}): ChatState => ({
  ...CHAT_OFF,
  status: "thinking",
  sleep: true,
  ...over,
})

interface Arms {
  /** One pass, driven by hand. */
  readonly tick: Effect.Effect<boolean, never, Scope.Scope>
  /** One pass, asked for by name — what the verb's door answers. */
  readonly now: (node: string) => Effect.Effect<"started" | "busy" | "unknown", never, Scope.Scope>
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
  /** The roster, for the cases about WHICH nodes a door answers for. */
  readonly nodes?: ReadonlyArray<NodeAgent>
  readonly live?: ReadonlyMap<string, LiveSession>
  readonly changed?: string
  readonly after?: Duration.Duration
  readonly start?: Duration.Duration
  readonly question?: Duration.Duration
  /** Whether the vault takes the memo. `false` is the pass's other failure. */
  readonly writes?: boolean
  /**
   * THE FORKED LOOP'S OWN CADENCE, and it is a YEAR by default on purpose: a
   * test that moves the clock by hours would otherwise have the loop run a pass
   * every fifteen minutes of it, which is not what any of these cases is about.
   * The one test that is about the loop asks for a real span.
   */
  readonly loopTick?: Duration.Duration
} = {}): Effect.Effect<Arms, never, Scope.Scope> =>
  Effect.gen(function*() {
    const events: Array<string> = []
    const delivers: Array<string> = []
    const memos: Array<unknown> = []
    const commits: Array<{ message: string; paths: ReadonlyArray<string> }> = []
    const warnings: Array<string> = []
    let reads = 0
    let observer: ReadingObserver | null = null
    /** THE MEMO, as a vault would keep it — written by the pass, read by the
     *  next candidate question, so "not tidied again" is a statement these
     *  cases can make. */
    let memo: string | null = null
    const states = over.states ?? [
      thinking(),
      { ...CHAT_OFF, status: "idle", trouble: null },
    ]
    const doors: Sleeping = {
      nodes: () => over.nodes ?? [AGENT],
      sleptAt: () => memo,
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
        : Effect.gen(function*() {
          memo = stamp(yield* Clock.currentTimeMillis)
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
      tick: over.loopTick ?? Duration.days(365),
      question: over.question ?? Duration.minutes(20),
      start: over.start ?? Duration.minutes(2),
      log: () => Effect.void,
      warn: (line) => Effect.sync(() => void warnings.push(line)),
    }
    const sleeper = yield* makeSleeper(doors)
    return { tick: sleeper.tick, now: sleeper.now, events, delivers, memos, commits, warnings, reads: () => reads }
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

/**
 * WAIT FOR A PASS SOMEBODY ASKED FOR, which is not this fiber: `now` forks it
 * into the caller's scope, so what the pass DID is a thing to wait for rather
 * than to read. A yield per try, and one more once the predicate holds — the
 * step after the one that answered is the permit going back.
 */
const until = (ready: () => boolean): Effect.Effect<void> =>
  Effect.gen(function*() {
    for (let tries = 0; tries < 500; tries++) {
      if (ready()) return yield* settle
      yield* settle
    }
    throw new Error("the pass never got there")
  })

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

test("trouble mid-turn is a failed pass, stopped and said out loud", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({
      states: [thinking(), thinking({ trouble: "the agent died" })],
    })
    expect(yield* arms.tick).toBe(true)
    // THE TURN IS STOPPED, exactly as a question's is: the pass is about to
    // let go of the hold, and a turn left running would write into the subtree
    // with nobody watching and nothing to undo.
    expect(arms.events).toEqual(["hold", "delivered", "cancelled", "withdrawn", "released"])
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
    expect(arms.warnings.join("\n")).toContain("the turn went wrong")
  })))

test("a failed node is left alone for a day, and is due again after that", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({ writes: false })
    expect(yield* arms.tick).toBe(true)
    expect(arms.warnings.join("\n")).toContain("the memo could not be written")
    // THE BACK-OFF IS EXACTLY `SKIP_MS`, tested at its boundary rather than
    // near it: a millisecond short of a day the node is still left alone, and
    // the millisecond it is due, it is tried again.
    yield* TestClock.adjust(Duration.millis(24 * HOUR - 1))
    expect(yield* arms.tick).toBe(false)
    yield* TestClock.adjust(Duration.millis(1))
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
    // ...AND THE MEMO IS WHAT KEEPS IT FROM BEING DONE AGAIN: hours later, with
    // the memory exactly as the pass left it, the node is not due.
    yield* TestClock.adjust(Duration.days(3))
    expect(yield* arms.tick).toBe(false)
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
    const arms = yield* Effect.provideService(
      withStubs({ loopTick: Duration.minutes(15) }),
      Scope.Scope,
      scope,
    )
    yield* TestClock.adjust(Duration.millis(16 * MIN))
    yield* settle
    const awake = arms.reads()
    expect(awake).toBeGreaterThan(0)
    yield* Scope.close(scope, Exit.void)
    yield* TestClock.adjust(Duration.millis(2 * HOUR))
    yield* settle
    expect(arms.reads()).toBe(awake)
  })))

test("a pass asked for by hand does not ask whether the node is due", () =>
  onTheClock(Effect.gen(function*() {
    // THE GATES THE LOOP ASKS AND THE VERB DOES NOT: the newest stamp under this
    // node is a minute old and the span is six hours, so the loop finds nothing
    // to do — and the node carries no memo either, which is the other half of
    // "due" (`candidate`).
    const arms = yield* withStubs({ changed: stamp(NOW - MIN), after: Duration.hours(6) })
    expect(yield* arms.tick).toBe(false)
    expect(yield* arms.now("health")).toBe("started")
    yield* until(() => arms.commits.length === 1)
    expect(arms.commits).toHaveLength(1)
    expect(arms.memos).toEqual(["memo"])
  })))

test("a pass asked for while one is running is refused, and nothing queues", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({ states: [thinking({ asking: 0 }), thinking({ asking: 1 })] })
    const pass = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    expect(arms.delivers).toHaveLength(1)
    // THE PERMIT IS HELD, and the answer is a refusal rather than a place in a
    // queue: somebody who pressed a row is owed an answer now.
    expect(yield* arms.now("health")).toBe("busy")
    yield* TestClock.adjust(Duration.millis(19 * MIN))
    expect(yield* Fiber.join(pass)).toBe(true)
    expect(arms.delivers).toHaveLength(1)
  })))

test("a pass asked for on a node that is not one, or has no conversation, is unknown", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({ nodes: [AGENT, { ...AGENT, id: "bare", session: null }] })
    expect(yield* arms.now("nowhere")).toBe("unknown")
    // ...AND A SESSIONLESS ROW IS THE SAME ANSWER: there is no conversation to
    // hand a turn to, which is the other thing the verb's row is chosen on.
    expect(yield* arms.now("bare")).toBe("unknown")
    expect(arms.delivers).toEqual([])
    expect(arms.commits).toEqual([])
  })))

test("a manual pass that failed is not remembered as a node to leave alone", () =>
  onTheClock(Effect.gen(function*() {
    // THE 24-HOUR BACK-OFF IS THE LOOP'S: it exists so a broken node is not
    // retried every tick. A person can ask again, and so can the next tick.
    const arms = yield* withStubs({ writes: false })
    expect(yield* arms.now("health")).toBe("started")
    yield* until(() => arms.warnings.length > 0)
    expect(arms.warnings.join("\n")).toContain("the memo could not be written")
    // THE LOOP'S OWN NEXT LOOK still finds this node: had the manual failure
    // been remembered, the map would answer `false` here.
    expect(yield* arms.tick).toBe(true)
  })))

test("a person's turn is not the pass's turn, and the pass waits for its own", () =>
  onTheClock(Effect.gen(function*() {
    // THE STATE A READER IS HANDED FIRST IS THE CONVERSATION'S NOW, and a body
    // the pass hands over is HELD while somebody else's turn runs. So a pass
    // that read the first `thinking` as its own would report a finished sleep —
    // memo, commit and all — over a person's writes, and then hand its own turn
    // over at that person's boundary with nobody watching it. The mark is the
    // only thing that says whose turn it is.
    const arms = yield* withStubs({
      states: [thinking({ sleep: false }), thinking({ sleep: false })],
      start: Duration.minutes(2),
    })
    const pass = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
    yield* TestClock.adjust(Duration.millis(MIN + 1))
    expect(yield* Fiber.join(pass)).toBe(true)
    // ...AND IT SAYS SO: a body that never became a turn is the same ending as a
    // conversation that never reported one, which is what `START_MS` is for.
    expect(arms.warnings.join("\n")).toContain("the turn never started")
    expect(arms.events).not.toContain("cancelled")
  })))

test("a cancel is never aimed at a turn that is not marked", () =>
  onTheClock(Effect.gen(function*() {
    // THE MARK CAN GO OFF UNDER A QUESTION'S DEADLINE: olai's turn ends, a
    // person's begins at the boundary it ended at, and `cancel` stops whatever
    // is running. The pass has to read the mark it is about to act on.
    const arms = yield* withStubs({
      states: [thinking({ asking: 0 }), thinking({ asking: 1 }), thinking({ sleep: false })],
    })
    const pass = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    expect(arms.delivers).toHaveLength(1)
    yield* TestClock.adjust(Duration.millis(20 * MIN))
    expect(yield* Fiber.join(pass)).toBe(true)
    expect(arms.events).not.toContain("cancelled")
    expect(arms.events).toEqual(["hold", "delivered", "withdrawn", "released"])
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
  })))

test("a pass asked for on a node whose turn is running is refused", () =>
  onTheClock(Effect.gen(function*() {
    // THE GATE `candidate()` KEEPS AND THE VERB MUST KEEP TOO: a node with a
    // turn running has a conversation that would HOLD this pass's body, and the
    // pass would then watch a turn that is not its own (see the case above).
    // A question open, or an open refused, is the same answer for the same
    // reason.
    for (const standing of [
      { status: "thinking" as const, asking: 0 },
      { status: "idle" as const, asking: 1 },
      { status: "idle" as const, asking: 0, unopened: true },
    ]) {
      const arms = yield* withStubs({
        live: () => new Map([[AGENT.id, { ...standing, sleep: false }]]),
      })
      expect(yield* arms.now("health")).toBe("busy")
      expect(arms.delivers).toEqual([])
      expect(arms.commits).toEqual([])
    }
  })))

test("a turn somebody cancelled writes nothing, and is not remembered", () =>
  onTheClock(Effect.gen(function*() {
    // A PERSON'S CANCEL — or an agent stopping its own turn — lands on `idle`
    // with no `trouble`, which is what a turn that ENDED looks like, so the
    // state carries the difference (`ChatState.cancelled`). Read as a finished
    // sleep, this pass would stamp the memo on a rewrite that stopped halfway
    // and commit it as a completed pass.
    const arms = yield* withStubs({
      states: [thinking({ asking: 0 }), { ...CHAT_OFF, status: "idle", cancelled: true }],
    })
    expect(yield* arms.tick).toBe(true)
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
    expect(arms.warnings.join("\n")).toContain("its turn was cancelled before it finished")
    // ...AND NOTHING IS REMEMBERED AGAINST THE NODE: the back-off is for a node
    // that fails on its own, and the next look is entitled to try again.
    expect(yield* arms.tick).toBe(true)
    expect(arms.commits).toHaveLength(1)
  })))
