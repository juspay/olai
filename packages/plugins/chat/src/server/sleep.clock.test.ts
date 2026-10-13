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
import type { Forecast, Judged, Sleeping } from "./sleep.ts"
import { forecastOf, makeSleeper, SKIP_MS } from "./sleep.ts"

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
  /** What the strip under a conversation reads — the same judgement the loop
   *  picks with, off the roster's reading. */
  readonly forecast: (node: string) => ReturnType<typeof forecastOf> | null
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
  /** How long one turn may run — a span the cases about a stuck turn move. */
  readonly limit?: Duration.Duration
  /** Whether the vault takes the memo. `false` is the pass's other failure. */
  readonly writes?: boolean
  /** WHETHER THIS CHAT ASKED TO BE TIDIED — `true` everywhere but the cases
   *  about the mark's absence. */
  readonly sleeps?: boolean
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
    /** THE SET BOTH READERS ARE HANDED — the loop's own read and the roster's
     *  current one are the same object here, which is what a served revision
     *  looks like from inside the server. */
    const reading = readingOf(setOf(vault(over.changed ?? stamp(NOW - HOUR))))
    const states = over.states ?? [
      thinking(),
      { ...CHAT_OFF, status: "idle", trouble: null },
    ]
    const doors: Sleeping = {
      nodes: () => over.nodes ?? [AGENT],
      sleptAt: () => memo,
      sleptKey: () => "chat-agent-slept",
      // A CHAT THAT ASKED, by default: what the mark's absence means is a case
      // of its own below.
      sleeps: () => over.sleeps ?? true,
      live: () => over.live ?? new Map(),
      read: Effect.sync(() => {
        reads += 1
        return reading
      }),
      // ...AND THE SET ITSELF, which is what a forecast is judged over: the
      // door answers with the derivation, the loop's own read with the reading
      // that carries it (`server/sleep.ts` says why they are two doors).
      reading: () => reading.derived,
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
      limit: over.limit ?? Duration.hours(1),
      start: over.start ?? Duration.minutes(2),
      log: () => Effect.void,
      warn: (line) => Effect.sync(() => void warnings.push(line)),
    }
    const sleeper = yield* makeSleeper(doors)
    return {
      tick: sleeper.tick,
      now: sleeper.now,
      forecast: sleeper.forecast,
      events,
      delivers,
      memos,
      commits,
      warnings,
      reads: () => reads,
    }
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

test("a node nobody asked for is never picked, and the same node marked is", () =>
  onTheClock(Effect.gen(function*() {
    // THE DEFAULT THE WHOLE FEATURE RESTS ON: a node whose memory has moved and
    // which has been left alone for hours is still left alone until somebody
    // says otherwise — no turn, no memo, nothing committed.
    const quiet = yield* withStubs({ changed: stamp(NOW - HOUR), sleeps: false })
    expect(yield* quiet.tick).toBe(false)
    expect(quiet.delivers).toEqual([])
    expect(quiet.memos).toEqual([])
    expect(quiet.commits).toEqual([])
    expect(quiet.warnings).toEqual([])

    // ...AND THE SAME NODE, MARKED, IS A CANDIDATE: the mark is the only thing
    // that changed, and the pass that was not allowed to begin now finishes.
    const asked = yield* withStubs({ changed: stamp(NOW - HOUR), sleeps: true })
    expect(yield* asked.tick).toBe(true)
    expect(asked.commits).toHaveLength(1)
  })))

test("a pass asked for by hand sleeps a node nobody asked for", () =>
  onTheClock(Effect.gen(function*() {
    // A PRESS IS A CHOICE, exactly as it already skips the idle window and the
    // "memory has moved" test: the mark decides whether the LOOP may pick a node
    // up, and `now` does not ask it.
    const arms = yield* withStubs({ sleeps: false })
    expect(yield* arms.tick).toBe(false)
    expect(yield* arms.now("health")).toBe("started")
    yield* until(() => arms.commits.length === 1)
    expect(arms.memos).toEqual(["memo"])
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
        live: new Map([[AGENT.id, { ...standing, sleep: false }]]),
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
    // that fails on its own, and the next look is entitled to try again — which
    // is what `true` says. (The stub replays its script, so that pass ends
    // cancelled as well; what this line is about is that it was allowed to run.)
    expect(yield* arms.tick).toBe(true)
  })))

test("a turn that never ends is stopped at the limit, and left alone after that", () =>
  onTheClock(Effect.gen(function*() {
    // THE QUIET WAIT IS BOUNDED TOO, and this is why it must be: a turn that
    // stops reporting holds the quiet window shut for the whole vault, wedges
    // the permit, and makes every *Sleep now* answer "busy" — with the git pill
    // still promising a commit that cannot come.
    const arms = yield* withStubs({
      states: [thinking({ asking: 0 })],
      limit: Duration.minutes(10),
    })
    const pass = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(9 * MIN))
    yield* settle
    expect(arms.events).not.toContain("cancelled")
    yield* TestClock.adjust(Duration.millis(MIN + 1))
    expect(yield* Fiber.join(pass)).toBe(true)
    expect(arms.events).toEqual(["hold", "delivered", "cancelled", "withdrawn", "released"])
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
    expect(arms.warnings.join("\n")).toContain("the turn ran past its limit")
    // ...AND IT IS A FAILURE LIKE ANY OTHER: the node is left alone for a day,
    // which the loop's own next look is what shows.
    yield* TestClock.adjust(Duration.millis(MIN))
    expect(yield* arms.tick).toBe(false)
  })))

/**
 * THE JUDGEMENT ITSELF, AS A TABLE.
 *
 * `forecastOf` is pure — `now` is an argument, the reading is a parameter and the
 * pass's own memory of a node is handed in — so every state a node can be in is a
 * row here rather than a scenario somebody has to run a pass to reach. What the
 * LOOP does with these answers is the cases above; what the STRIP says about them
 * is `browser/chat/sleeping.test.ts`.
 *
 * ONE KIND IS NOT A JUDGEMENT AT ALL: `off` is the directory's own setting, read
 * before a sleeper exists, which is why it is `null` on the wire rather than an
 * answer from here.
 */
test("the judgement answers each state a node can be in, and none of them is a guess", () => {
  /** THE MOMENT A `due` OR `skipped` CARRIES, as a number: the spelling on the
   *  wire is the server's, and a test asserting that string would be asserting
   *  the format rather than the instant a person is being told about. */
  const when = (next: Forecast["next"]): number | null => next.kind === "due"
    ? Date.parse(next.at)
    : next.kind === "skipped" ? Date.parse(next.until) : null
  const doors = (over: {
    readonly sleeps?: boolean
    readonly sleptAt?: string | null
    readonly after?: Duration.Duration
  } = {}) => ({
    nodes: () => [AGENT],
    sleeps: () => over.sleeps ?? true,
    sleptAt: () => over.sleptAt ?? null,
    after: over.after ?? Duration.millis(0),
  })
  const judged = (over: Partial<Judged> = {}): Judged => ({ inFlight: null, failedAt: undefined, ...over })
  const none = new Map<string, LiveSession>()
  /** ONE LIVE CONVERSATION, as the panel reports it — typed at the map so the
   *  literal is checked against `LiveSession` rather than widened into it. */
  const up = (standing: LiveSession) => new Map<string, LiveSession>([["health", standing]])
  const of = (
    agent: NodeAgent,
    state: Judged,
    held: ReturnType<typeof doors>,
    live: ReadonlyMap<string, LiveSession> = none,
  ) => forecastOf(agent, NOW, live, readingOf(setOf(vault(stamp(NOW - HOUR)))).derived, state, held)

  // NO CONVERSATION: there is nothing to hand a turn to, however due it is.
  expect(of({ ...AGENT, session: null }, judged(), doors()).next).toEqual({ kind: "unbound" })
  // NOBODY HAS ASKED: the mark is a person's answer, and nothing is tidied until
  // they give it.
  expect(of(AGENT, judged(), doors({ sleeps: false })).next).toEqual({ kind: "unmarked" })
  // THE PASS IS IN FLIGHT — asked BEFORE the busy test, because a running pass
  // makes the session `thinking` and `busy` would mask it.
  expect(of(AGENT, judged({ inFlight: AGENT.id }), doors()).next).toEqual({ kind: "running" })
  // A FAILED PASS, for a day — and the instant is the backoff's own end.
  const skipped = of(AGENT, judged({ failedAt: NOW - HOUR }), doors()).next
  expect(skipped.kind).toBe("skipped")
  expect(when(skipped)).toBe(NOW - HOUR + SKIP_MS)
  // ...AND DUE AGAIN ONCE THE DAY IS UP, because the expiry is pruned rather
  // than remembered for ever.
  expect(of(AGENT, judged({ failedAt: NOW - SKIP_MS }), doors()).next.kind).toBe("due")
  // THE CONVERSATION IS UP: a turn, a question, or a handshake nobody has
  // answered yet.
  expect(of(AGENT, judged(), doors(), up({ status: "thinking", asking: 0 })).next).toEqual({ kind: "busy" })
  expect(of(AGENT, judged(), doors(), up({ status: "idle", asking: 1 })).next).toEqual({ kind: "busy" })
  expect(of(AGENT, judged(), doors(), up({ status: "idle", asking: 0, unopened: true })).next)
    .toEqual({ kind: "busy" })
  // A DEAD PROCESS IS NOT BUSY: `off` and `gone` are a conversation to be woken,
  // which is what the delivery path does.
  expect(of(AGENT, judged(), doors(), up({ status: "off", asking: 0 })).next.kind).toBe("due")
  // THE MEMORY HAS NOT MOVED since the memo — which is the whole reason the memo
  // exists.
  expect(of(AGENT, judged(), doors({ sleptAt: stamp(NOW - MIN) })).next).toEqual({ kind: "unchanged" })
  // DUE, and the instant is when the quiet window closes.
  const due = of(AGENT, judged(), doors({ sleptAt: stamp(NOW - HOUR) })).next
  expect(due.kind).toBe("due")
  expect(when(due)).toBe(NOW)
})

/**
 * THE SECOND QUIET READING, which is the one the conversation cannot see: an
 * agent idle for seven hours whose SUBTREE somebody edited an hour ago is a node
 * nobody should be tidying, and it becomes due six hours after the edit — not
 * when the idle window ran out. A rule that read only the conversation's `since`
 * would tidy a memory somebody is writing.
 */
test("a subtree somebody is editing keeps its node awake, whatever the conversation is doing", () => {
  const held = readingOf(setOf(vault(stamp(NOW - HOUR))))
  const doors = {
    nodes: () => [AGENT],
    sleeps: () => true,
    sleptAt: () => stamp(NOW - DAY),
    after: Duration.hours(6),
  }
  const live = new Map<string, LiveSession>([["health", { status: "idle", asking: 0, since: stamp(NOW - 7 * HOUR) }]])
  // THE IDLE WINDOW ALONE WOULD SAY YES — it ran out six hours into the seven —
  // and the edit an hour ago says no.
  const next = forecastOf(AGENT, NOW, live, held.derived, { inFlight: null, failedAt: undefined }, doors).next
  expect(next.kind).toBe("due")
  expect(next.kind === "due" ? Date.parse(next.at) : null).toBe(NOW + 5 * HOUR)
})

test("the strip's forecast is null for a node that is not one, and judges the one that is", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs()
    expect(arms.forecast("nobody")).toBeNull()
    expect(arms.forecast("health")?.next.kind).toBe("due")
  })))
