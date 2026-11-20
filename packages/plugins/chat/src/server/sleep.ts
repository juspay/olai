/**
 * ## One pass, one SCOPE
 *
 * Each pass runs inside its own `Effect.scoped`, and everything it acquires is
 * released by closing it — in the LIFO order of the registrations below:
 *
 *   1. THE HOLD on git's quiet window, taken first so it is released LAST: the
 *      pass writes a subtree over minutes and then commits it as one commit, and
 *      without the hold the window would record the first half of that as `auto`
 *      while the pass was still going.
 *   2. THE READING of the node's conversation, which is also what keeps the
 *      node scope from being reaped while its agent works.
 *   3. THE CANCELLATION, registered last so it runs FIRST: a pass that is
 *      stopped stops the TURN rather than walking away from it. A turn left
 *      running would write into the subtree with nobody watching and no commit
 *      of its own to be undone by — the one outcome worse than not sleeping.
 */

import type { Forecast } from "../wire/agents.ts"

import {
  changesUnder,
  type Derived,
  memoryFiles,
  type MovedRow,
  movedUnder,
  type NodeAgent,
  type NodeAgents,
  othersOf,
  type OpFailure,
  type Reading,
  stampOf,
  type WriteRequest,
} from "@olai/format"
import { Clock, Duration, Effect, Queue, Semaphore, type Scope } from "effect"

import type { WaitingOutline } from "@olai/plugin-api/services"

import type { Conversing } from "../sessions.ts"
import type { LiveSession, ReadingObserver } from "../scoped.ts"
import { sleepFor } from "../sleep.ts"
import type { ChatState } from "../wire/members.ts"

export const START = Duration.minutes(2)

export const SKIP_MS = Duration.toMillis(Duration.hours(24))

export type { Forecast } from "../wire/agents.ts"

export type Verdict =
  | "slept"
  | "gone"
  | "trouble"
  | "question"
  | "cancelled"
  | "limit"
  | "unstarted"

const WHY: Record<Exclude<Verdict, "slept">, string> = {
  gone: "the conversation is not there any more",
  trouble: "the turn went wrong, or the memo could not be written",
  question: "it asked a question nobody is there to answer, so it was stopped",
  cancelled: "its turn was cancelled before it finished, so nothing was written",
  limit: "the turn ran past its limit, so it was stopped",
  unstarted: "the turn never started",
}

export interface Sleeping {
  readonly nodes: () => NodeAgents
  readonly sleptAt: (node: string) => string | null
  readonly sleptKey: () => string
  readonly sleeps: (node: string) => boolean
  readonly live: () => ReadonlyMap<string, LiveSession>
  readonly deliver: (to: Conversing, say: () => string | null) => Effect.Effect<void>
  readonly withdraw: (to: Conversing) => Effect.Effect<void>
  readonly watch: (
    to: Conversing,
    observer: ReadingObserver,
  ) => Effect.Effect<Stoppable, OpFailure, Scope.Scope>
  readonly read: Effect.Effect<Reading & { readonly outlineRow: string }, OpFailure>
  readonly write: (request: WriteRequest) => Effect.Effect<unknown, OpFailure>
  readonly waiting: Effect.Effect<ReadonlyArray<WaitingOutline>>
  readonly commit: (
    message: string,
    paths: ReadonlyArray<string>,
  ) => Effect.Effect<{ readonly said: string; readonly failed: boolean } | null>
  readonly hold: Effect.Effect<void, never, Scope.Scope>
  readonly warn: (line: string) => Effect.Effect<void>
  readonly after: Duration.Duration
  readonly floor: number
  readonly latest: Duration.Duration
  readonly tick: Duration.Duration
  readonly question: Duration.Duration
  readonly limit: Duration.Duration
  readonly start: Duration.Duration
  readonly reading: () => Derived | null
  readonly changed?: Effect.Effect<void>
  readonly log: (line: string) => Effect.Effect<void>
}

export const forecastOf = (
  agent: NodeAgent,
  now: number,
  live: ReadonlyMap<string, LiveSession>,
  derived: Derived,
  judged: Judged,
  doors: Pick<Sleeping, "nodes" | "sleeps" | "sleptAt" | "after" | "floor" | "latest">,
): Forecast => {
  const lastSlept = doors.sleptAt(agent.id)
  const after = Duration.toMillis(doors.after)
  const floor = doors.floor
  const latest = Duration.toMillis(doors.latest)
  const at = (next: Forecast["next"]): Forecast => ({ lastSlept, after, floor, latest, next })
  if (agent.session === null) return at({ kind: "unbound" })
  if (!doors.sleeps(agent.id)) return at({ kind: "unmarked" })
  if (judged.inFlight === agent.id) return at({ kind: "running" })
  const failed = judged.failedAt
  if (failed !== undefined && now - failed < SKIP_MS) {
    return at({ kind: "skipped", until: stampOf(new Date(failed + SKIP_MS)) })
  }
  const standing = live.get(agent.id)
  if (busySession(standing)) return at({ kind: "busy" })
  const others = othersOf(doors.nodes(), agent.id)
  const moved = changesUnder(derived, agent.id, lastSlept, others)
  if (moved.rows === 0) return at({ kind: "unchanged" })
  const pressured = lastSlept === null ||
    moved.rows >= floor ||
    (moved.oldest !== null && now - moved.oldest > latest)
  if (!pressured) return at({ kind: "little", rows: moved.rows })
  const since = standing?.since
  const idleAt = since === undefined ? Number.NaN : Date.parse(since)
  const quiet = Math.max(
    Number.isNaN(idleAt) ? now - after : idleAt + after,
    moved.newest === null ? now - after : moved.newest + after,
  )
  return at({ kind: "due", rows: moved.rows, at: stampOf(new Date(Math.max(now, quiet))) })
}

const busySession = (standing: LiveSession | undefined): boolean =>
  standing !== undefined && standing.status !== "off" && standing.status !== "gone" &&
  (standing.status !== "idle" || standing.asking > 0 || standing.unopened === true)

export interface Judged {
  readonly inFlight: string | null
  readonly failedAt: number | undefined
}

export interface Stoppable {
  readonly cancel: Effect.Effect<void, OpFailure>
}

export type Asked = "started" | "busy" | "unknown"

export const makeSleeper = (
  doors: Sleeping,
): Effect.Effect<
  {
    readonly tick: Effect.Effect<boolean, never, Scope.Scope>
    readonly now: (node: string) => Effect.Effect<Asked, never, Scope.Scope>
    readonly forecast: (node: string) => Forecast | null
  },
  never,
  Scope.Scope
> =>
  Effect.gen(function*() {
    const failures = new Map<string, number>()

    let inFlight: string | null = null

    const moved = doors.changed ?? Effect.void

    const busy = busySession

    const skipped = (node: string, now: number): boolean => {
      const at = failures.get(node)
      if (at === undefined) return false
      if (now - at < SKIP_MS) return true
      failures.delete(node)
      return false
    }

    const judge = (agent: NodeAgent, now: number, live: ReadonlyMap<string, LiveSession>, derived: Derived): Forecast => {
      const failedAt = failures.get(agent.id)
      const verdict = forecastOf(agent, now, live, derived, { inFlight, failedAt }, doors)
      if (failedAt !== undefined && verdict.next.kind !== "skipped") failures.delete(agent.id)
      return verdict
    }

    const candidate = (): Effect.Effect<
      {
        readonly agent: NodeAgent
        readonly files: ReadonlySet<string>
        readonly others: ReadonlySet<string>
        readonly moved: ReadonlyArray<MovedRow>
      } | null
    > =>
      Effect.gen(function*() {
        const observed = yield* Effect.result(doors.read)
        if (observed._tag === "Failure") return null
        const derived = observed.success.derived
        const live = doors.live()
        const roster = doors.nodes()
        const now = yield* Clock.currentTimeMillis
        for (const agent of roster) {
          const next = judge(agent, now, live, derived).next
          if (next.kind !== "due" || Date.parse(next.at) > now) continue
          const others = othersOf(roster, agent.id)
          return {
            agent,
            files: memoryFiles(derived, agent.id, others),
            others,
            moved: movedUnder(derived, agent.id, doors.sleptAt(agent.id), others),
          }
        }
        return null
      })

    const ended = (state: ChatState): Verdict | null => {
      if (state.status !== "idle" && state.status !== "thinking") return "gone"
      if (state.sleep === true) return state.trouble === null ? null : "trouble"
      if (state.status !== "idle") return "gone"
      if (state.cancelled) return "cancelled"
      return state.trouble === null ? "slept" : "trouble"
    }

    const waited = (states: Queue.Queue<ChatState>): Effect.Effect<Verdict> =>
      Effect.gen(function*() {
        let asked: number | null = null
        for (;;) {
          const taken = Effect.map(Queue.take(states), (state) => ({ state, silence: false } as const))
          const next: { readonly state: ChatState | null; readonly silence: boolean } = asked === null
            ? yield* taken
            : yield* Effect.raceFirst(
              taken,
              Effect.as(
                Effect.sleep(Duration.millis(Math.max(
                  0,
                  Duration.toMillis(doors.question) - ((yield* Clock.currentTimeMillis) - asked),
                ))),
                { state: null, silence: true } as const,
              ),
            )
          if (next.silence || next.state === null) return "question"
          const verdict = ended(next.state)
          if (verdict !== null) return verdict
          asked = next.state.asking > 0 ? (asked ?? (yield* Clock.currentTimeMillis)) : null
        }
      })

    const watchTurn = (states: Queue.Queue<ChatState>): Effect.Effect<Verdict> =>
      Effect.gen(function*() {
        const began = yield* Effect.raceFirst(
          Effect.gen(function*() {
            for (;;) {
              const state = yield* Queue.take(states)
              if (state.sleep === true) return "running" as const
              if (state.status === "off" || state.status === "gone") return "gone" as const
            }
          }),
          Effect.as(Effect.sleep(doors.start), "unstarted" as const),
        )
        if (began !== "running") return began
        return yield* Effect.raceFirst(waited(states), Effect.as(Effect.sleep(doors.limit), "limit" as const))
      })

    const stopping = (stoppable: Stoppable, node: string, ours: boolean): Effect.Effect<void> =>
      ours
        ? Effect.catch(
          stoppable.cancel,
          (failure) => doors.log(`sleep: ${node}: the turn would not stop: ${failure.message}`),
        )
        : doors.log(`sleep: ${node}: its turn had already ended, so nothing was cancelled`)

    const one = (
      agent: NodeAgent,
      files: ReadonlySet<string>,
      others: ReadonlySet<string>,
      movedRows: ReadonlyArray<MovedRow>,
    ): Effect.Effect<Verdict, never, Scope.Scope> =>
      Effect.scoped(Effect.gen(function*() {
        const to = { agent: agent.engine, session: agent.session as string }
        inFlight = agent.id
        yield* moved
        yield* Effect.addFinalizer(() => Effect.sync(() => void (inFlight = null)))
        yield* doors.hold
        const states = yield* Queue.unbounded<ChatState>()
        let last: ChatState | null = null
        const lastState = (): ChatState | null => last
        const observed = yield* Effect.result(doors.watch(to, {
          state: (state) => {
            last = state
            Queue.offerUnsafe(states, state)
          },
          transcript: () => {},
        }))
        if (observed._tag === "Failure") {
          yield* doors.warn(`sleep: ${agent.id}: its conversation could not be read: ${observed.failure.message}`)
          return "gone"
        }
        const stoppable = observed.success
        let running = true
        yield* Effect.addFinalizer(() => Effect.gen(function*() {
          if (running) {
            running = false
            yield* doors.warn(`sleep: ${agent.id}: the pass was stopped, so its turn was cancelled`)
            yield* stopping(stoppable, agent.id, lastState()?.sleep === true)
          }
          yield* doors.withdraw(to)
        }))
        yield* doors.deliver(to, () => sleepFor(agent, movedRows))
        const verdict = yield* watchTurn(states)
        if (verdict === "question" || verdict === "trouble" || verdict === "limit") {
          running = false
          yield* stopping(stoppable, agent.id, lastState()?.sleep === true)
        }
        running = false
        if (verdict !== "slept") {
          yield* doors.warn(`sleep: ${agent.id} did not finish: ${WHY[verdict]}`)
          return verdict
        }
        // THE MEMO, THEN THE COMMIT — the order that makes the commit the undo:
        // a stamp on disk that no commit carries would be a pass whose evidence
        // a person cannot see in `git log`.
        const at = stampOf(new Date(yield* Clock.currentTimeMillis))
        const wrote = yield* Effect.result(doors.write({ op: "prop", id: agent.id, key: doors.sleptKey(), value: at }))
        if (wrote._tag === "Failure") {
          yield* doors.warn(`sleep: ${agent.id}: the memo could not be written: ${wrote.failure.message}`)
          return "trouble"
        }
        const reread = yield* Effect.result(doors.read)
        const named = reread._tag === "Success"
          ? new Set([...files, ...memoryFiles(reread.success.derived, agent.id, others)])
          : files
        const waiting = yield* doors.waiting
        const paths = waiting.filter((row) => named.has(row.file)).map((row) => row.path)
        const refusal = yield* doors.commit(`sleep: ${agent.title}`, paths)
        if (refusal === null) {
          yield* doors.log(`sleep: ${agent.id} finished and committed`)
        } else if (refusal.failed) {
          yield* doors.warn(`sleep: ${agent.id} finished, but the commit was refused: ${refusal.said}`)
        } else {
          yield* doors.log(`sleep: ${agent.id} finished; the memo is written and waiting: ${refusal.said}`)
        }
        return "slept"
      }))

    const passes = Semaphore.makeUnsafe(1)
    const tick: Effect.Effect<boolean, never, Scope.Scope> = passes.withPermit(Effect.gen(function*() {
      const next = yield* candidate()
      if (next === null) return false
      yield* doors.log(`sleep: ${next.agent.id} is being tidied`)
      const verdict = yield* one(next.agent, next.files, next.others, next.moved)
      yield* moved
      if (verdict !== "slept" && verdict !== "cancelled") {
        failures.set(next.agent.id, yield* Clock.currentTimeMillis)
        yield* moved
      }
      return true
    }))

    const now = (node: string): Effect.Effect<Asked, never, Scope.Scope> =>
      Effect.gen(function*() {
        const agent = doors.nodes().find((one) => one.id === node)
        if (agent === undefined || agent.session === null) return "unknown"
        if (busy(doors.live().get(agent.id))) return "busy"
        const observed = yield* Effect.result(doors.read)
        if (observed._tag === "Failure") return "unknown"
        const others = othersOf(doors.nodes(), agent.id)
        // TAKEN, LOGGED AND FORKED AS ONE STEP, uninterruptibly: the fiber that
        // hands the permit back is the one this forks, so a request interrupted
        // between the take and the fork would leave a permit nobody owns and
        // wedge the loop for the life of the process — every tick after it would
        // wait for ever, and every Tidy memory would answer "busy".
        return yield* Effect.uninterruptible(Effect.gen(function*() {
          if (!(yield* Semaphore.takeIfAvailable(passes, 1))) return "busy" as const
          yield* doors.log(`sleep: ${agent.id} was asked for, and is being tidied`)
          yield* Effect.forkScoped(
            one(
              agent,
              memoryFiles(observed.success.derived, agent.id, others),
              others,
              movedUnder(observed.success.derived, agent.id, doors.sleptAt(agent.id), others),
            ).pipe(
              Effect.ensuring(Semaphore.release(passes, 1)),
            ),
          )
          return "started" as const
        }))
      })

    const forecast = (node: string): Forecast | null => {
      const agent = doors.nodes().find((one) => one.id === node)
      const derived = doors.reading()
      if (agent === undefined || derived === null) return null
      return judge(agent, Date.now(), doors.live(), derived)
    }

    yield* Effect.forkScoped(Effect.gen(function*() {
      for (;;) {
        yield* Effect.sleep(doors.tick)
        yield* Effect.catchCause(tick, (cause) =>
          doors.warn(`sleep: the pass failed: ${String(cause)}`))
      }
    }))
    return { tick, now, forecast }
  })
