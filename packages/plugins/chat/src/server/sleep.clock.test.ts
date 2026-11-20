import { type NodeAgent, UsageFailure } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Clock, Duration, Effect, Exit, Fiber, Scope } from "effect"
import { TestClock } from "effect/testing"

import type { LiveSession, ReadingObserver } from "../scoped.ts"
import { CHAT_OFF, type ChatState } from "../wire/members.ts"
import type { Forecast, Judged, Sleeping } from "./sleep.ts"
import { forecastOf, makeSleeper, SKIP_MS } from "./sleep.ts"

const NOW = Date.parse("2026-10-12T09:00:00Z")

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const AGENT: NodeAgent = {
  kind: "node",
  beside: false,
  id: "health",
  file: "Work.olai",
  title: "Health",
  engine: "claude",
  session: "sess-1",
  memory: 2,
}

const stamp = (at: number): string => new Date(at).toISOString()

const vault = (changed: string): Record<string, string> => ({
  "Work.olai": [
    `{"id":"health","ord":"a0","title":"Health"}`,
    `{"id":"note","parent":"health","ord":"a0","title":"a note","changed":"${changed}"}`,
  ].join("\n") + "\n",
})

const thinking = (over: Partial<ChatState> = {}): ChatState => ({
  ...CHAT_OFF,
  status: "thinking",
  sleep: true,
  ...over,
})

interface Arms {
  readonly tick: Effect.Effect<boolean, never, Scope.Scope>
  readonly now: (node: string) => Effect.Effect<"started" | "busy" | "unknown", never, Scope.Scope>
  readonly forecast: (node: string) => ReturnType<typeof forecastOf> | null
  readonly events: Array<string>
  readonly delivers: Array<string>
  readonly memos: Array<unknown>
  readonly commits: Array<{ readonly message: string; readonly paths: ReadonlyArray<string> }>
  readonly warnings: Array<string>
  readonly reads: () => number
}

const withStubs = (over: {
  readonly states?: ReadonlyArray<ChatState>
  readonly nodes?: ReadonlyArray<NodeAgent>
  readonly live?: ReadonlyMap<string, LiveSession>
  readonly changed?: string
  readonly after?: Duration.Duration
  readonly floor?: number
  readonly latest?: Duration.Duration
  readonly start?: Duration.Duration
  readonly question?: Duration.Duration
  readonly limit?: Duration.Duration
  readonly writes?: boolean
  readonly sleeps?: boolean
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
    let memo: string | null = null
    const reading = readingOf(setOf(vault(over.changed ?? stamp(NOW - HOUR))))
    const states = over.states ?? [
      thinking(),
      { ...CHAT_OFF, status: "idle", trouble: null },
    ]
    const doors: Sleeping = {
      nodes: () => over.nodes ?? [AGENT],
      sleptAt: () => memo,
      sleptKey: () => "chat-agent-slept",
      sleeps: () => over.sleeps ?? true,
      live: () => over.live ?? new Map(),
      read: Effect.sync(() => {
        reads += 1
        return reading
      }),
      reading: () => reading.derived,
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
      floor: over.floor ?? 1,
      latest: over.latest ?? Duration.days(7),
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

const onTheClock = <A>(body: Effect.Effect<A, never, Scope.Scope>): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      yield* TestClock.setTime(NOW)
      return yield* body
    })).pipe(Effect.provide(TestClock.layer())),
  )

const settle = Effect.yieldNow

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
    yield* TestClock.adjust(Duration.millis(24 * HOUR - 1))
    expect(yield* arms.tick).toBe(false)
    yield* TestClock.adjust(Duration.millis(1))
    expect(yield* arms.tick).toBe(true)
  })))

test("an asleep node whose memory moved inside the span waits, and sleeps once it has", () =>
  onTheClock(Effect.gen(function*() {
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
    yield* TestClock.adjust(Duration.days(3))
    expect(yield* arms.tick).toBe(false)
    expect(arms.commits).toHaveLength(1)
  })))

test("a node nobody asked for is never picked, and the same node marked is", () =>
  onTheClock(Effect.gen(function*() {
    const quiet = yield* withStubs({ changed: stamp(NOW - HOUR), sleeps: false })
    expect(yield* quiet.tick).toBe(false)
    expect(quiet.delivers).toEqual([])
    expect(quiet.memos).toEqual([])
    expect(quiet.commits).toEqual([])
    expect(quiet.warnings).toEqual([])

    const asked = yield* withStubs({ changed: stamp(NOW - HOUR), sleeps: true })
    expect(yield* asked.tick).toBe(true)
    expect(asked.commits).toHaveLength(1)
  })))

test("a pass asked for by hand sleeps a node nobody asked for", () =>
  onTheClock(Effect.gen(function*() {
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
    const arms = yield* withStubs({
      states: [thinking({ asking: 0 }), thinking({ asking: 1 })],
    })
    const first = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    const second = yield* Effect.forkChild(arms.tick)
    yield* TestClock.adjust(Duration.millis(MIN))
    yield* settle
    expect(arms.delivers).toHaveLength(1)
    yield* TestClock.adjust(Duration.millis(19 * MIN))
    expect(yield* Fiber.join(first)).toBe(true)
    expect(yield* Fiber.join(second)).toBe(false)
    expect(arms.delivers).toHaveLength(1)
  })))

test("the loop stops when the scope it was forked into closes", () =>
  onTheClock(Effect.gen(function*() {
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
    expect(yield* arms.now("health")).toBe("busy")
    yield* TestClock.adjust(Duration.millis(19 * MIN))
    expect(yield* Fiber.join(pass)).toBe(true)
    expect(arms.delivers).toHaveLength(1)
  })))

test("a pass asked for on a node that is not one, or has no conversation, is unknown", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({ nodes: [AGENT, { ...AGENT, id: "bare", session: null }] })
    expect(yield* arms.now("nowhere")).toBe("unknown")
    expect(yield* arms.now("bare")).toBe("unknown")
    expect(arms.delivers).toEqual([])
    expect(arms.commits).toEqual([])
  })))

test("a manual pass that failed is not remembered as a node to leave alone", () =>
  onTheClock(Effect.gen(function*() {
    const arms = yield* withStubs({ writes: false })
    expect(yield* arms.now("health")).toBe("started")
    yield* until(() => arms.warnings.length > 0)
    expect(arms.warnings.join("\n")).toContain("the memo could not be written")
    expect(yield* arms.tick).toBe(true)
  })))

test("a person's turn is not the pass's turn, and the pass waits for its own", () =>
  onTheClock(Effect.gen(function*() {
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
    expect(arms.warnings.join("\n")).toContain("the turn never started")
    expect(arms.events).not.toContain("cancelled")
  })))

test("a cancel is never aimed at a turn that is not marked", () =>
  onTheClock(Effect.gen(function*() {
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
    const arms = yield* withStubs({
      states: [thinking({ asking: 0 }), { ...CHAT_OFF, status: "idle", cancelled: true }],
    })
    expect(yield* arms.tick).toBe(true)
    expect(arms.memos).toEqual([])
    expect(arms.commits).toEqual([])
    expect(arms.warnings.join("\n")).toContain("its turn was cancelled before it finished")
    expect(yield* arms.tick).toBe(true)
  })))

test("a turn that never ends is stopped at the limit, and left alone after that", () =>
  onTheClock(Effect.gen(function*() {
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
    yield* TestClock.adjust(Duration.millis(MIN))
    expect(yield* arms.tick).toBe(false)
  })))

test("the judgement answers each state a node can be in, and none of them is a guess", () => {
  const when = (next: Forecast["next"]): number | null => next.kind === "due"
    ? Date.parse(next.at)
    : next.kind === "skipped" ? Date.parse(next.until) : null
  const doors = (over: {
    readonly sleeps?: boolean
    readonly sleptAt?: string | null
    readonly after?: Duration.Duration
    readonly floor?: number
    readonly latest?: Duration.Duration
  } = {}) => ({
    nodes: () => [AGENT],
    sleeps: () => over.sleeps ?? true,
    sleptAt: () => over.sleptAt ?? null,
    after: over.after ?? Duration.millis(0),
    floor: over.floor ?? 1,
    latest: over.latest ?? Duration.days(7),
  })
  const judged = (over: Partial<Judged> = {}): Judged => ({ inFlight: null, failedAt: undefined, ...over })
  const none = new Map<string, LiveSession>()
  const up = (standing: LiveSession) => new Map<string, LiveSession>([["health", standing]])
  const of = (
    agent: NodeAgent,
    state: Judged,
    held: ReturnType<typeof doors>,
    live: ReadonlyMap<string, LiveSession> = none,
  ) => forecastOf(agent, NOW, live, readingOf(setOf(vault(stamp(NOW - HOUR)))).derived, state, held)
  const rowsUnder = (rows: number, newest: number, at: ReturnType<typeof doors>, state: Judged) =>
    forecastOf(
      AGENT,
      NOW,
      none,
      readingOf(setOf({
        "Work.olai": [
          `{"id":"health","ord":"a0","title":"Health"}`,
          ...Array.from({ length: rows }, (_, index) =>
            `{"id":"note${index}","parent":"health","ord":"a${index}","title":"a note","changed":"${
              stamp(newest - index * DAY)
            }"}`),
        ].join("\n") + "\n",
      })).derived,
      state,
      at,
    )

  expect(of({ ...AGENT, session: null }, judged(), doors()).next).toEqual({ kind: "unbound" })
  expect(of(AGENT, judged(), doors({ sleeps: false })).next).toEqual({ kind: "unmarked" })
  expect(of(AGENT, judged({ inFlight: AGENT.id }), doors()).next).toEqual({ kind: "running" })
  const skipped = of(AGENT, judged({ failedAt: NOW - HOUR }), doors()).next
  expect(skipped.kind).toBe("skipped")
  expect(when(skipped)).toBe(NOW - HOUR + SKIP_MS)
  expect(of(AGENT, judged({ failedAt: NOW - SKIP_MS }), doors()).next.kind).toBe("due")
  expect(of(AGENT, judged(), doors(), up({ status: "thinking", asking: 0 })).next).toEqual({ kind: "busy" })
  expect(of(AGENT, judged(), doors(), up({ status: "idle", asking: 1 })).next).toEqual({ kind: "busy" })
  expect(of(AGENT, judged(), doors(), up({ status: "idle", asking: 0, unopened: true })).next)
    .toEqual({ kind: "busy" })
  expect(of(AGENT, judged(), doors(), up({ status: "off", asking: 0 })).next.kind).toBe("due")
  expect(of(AGENT, judged(), doors({ sleptAt: stamp(NOW - MIN) })).next).toEqual({ kind: "unchanged" })
  const due = of(AGENT, judged(), doors({ sleptAt: stamp(NOW - DAY) })).next
  expect(due.kind).toBe("due")
  expect(when(due)).toBe(NOW)
  expect(due.kind === "due" ? due.rows : null).toBe(1)

  const little = rowsUnder(1, NOW - HOUR, doors({ sleptAt: stamp(NOW - DAY), floor: 5 }), judged()).next
  expect(little).toEqual({ kind: "little", rows: 1 })
  expect(rowsUnder(5, NOW - HOUR, doors({ sleptAt: stamp(NOW - 6 * DAY), floor: 5 }), judged()).next.kind).toBe("due")

  const waited = (age: number) => rowsUnder(1, NOW - age, doors({ sleptAt: stamp(NOW - 30 * DAY), floor: 5 }), judged()).next.kind
  expect(waited(Duration.toMillis(Duration.days(7)))).toBe("little")
  expect(waited(Duration.toMillis(Duration.days(7)) + 1)).toBe("due")

  expect(rowsUnder(1, NOW - HOUR, doors({ floor: 5 }), judged()).next.kind).toBe("due")
})

test("a subtree somebody is editing keeps its node awake, whatever the conversation is doing", () => {
  const held = readingOf(setOf(vault(stamp(NOW - HOUR))))
  const doors = {
    nodes: () => [AGENT],
    sleeps: () => true,
    sleptAt: () => stamp(NOW - DAY),
    after: Duration.hours(6),
    floor: 1,
    latest: Duration.days(7),
  }
  const live = new Map<string, LiveSession>([["health", { status: "idle", asking: 0, since: stamp(NOW - 7 * HOUR) }]])
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
