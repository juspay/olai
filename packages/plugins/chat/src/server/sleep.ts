/**
 * THE PASS THAT PUTS A NODE AGENT'S MEMORY IN ORDER — the loop, and the one
 * turn it takes when a node has been left alone.
 *
 * A node's subtree is its only memory and nothing ever compacts it: a day's
 * whole report ends up in a title, standing facts are re-derived by hand, and
 * nothing is archived. This is the offline pass every long-lived memory system
 * has, and the words are `../sleep.ts` — what lives HERE is when it runs, what
 * it is allowed to touch, and what happens to a turn nobody is watching.
 *
 * ## A scope-owned fiber, beside the filer
 *
 * Not a Cordis component, and not a service anything declares: it needs chat's
 * OWN doors — the roster, the scheduler's deliver, a conversation's reading,
 * and the write gate — and chat's server row already holds all four. A separate
 * row would have had to be handed a machine-turn door with no turn end, no
 * commit with a writer word and no reading, which is to say it would have had
 * to be handed chat. So it is forked with `Effect.forkScoped` in the same fork
 * as the filer (`server.ts`), in the same scope, and it stops when that scope
 * closes: the loop dies, an in-flight turn is cancelled by the pass's own
 * finalizer, and no memo is written.
 *
 * ## One pass, one SCOPE
 *
 * Each pass runs inside its own `Effect.scoped`, and everything it acquires
 * there is released by closing it — the hold on the quiet window, the reading
 * of the node's conversation, and the turn itself. The order is the LIFO order
 * of the registrations below:
 *
 *   1. THE HOLD (`@olai/plugin-api`'s `Ledger.hold`), taken first so it is
 *      released LAST. Under `commit: auto` the pass writes a subtree over
 *      minutes and then commits it as one commit; without a hold the window
 *      would record the first half of that as `auto` while the pass was still
 *      going, and the commit a person reverts would not be the whole pass.
 *   2. THE READING of the node's conversation, which is also what keeps the
 *      node scope from being reaped while its agent works.
 *   3. THE CANCELLATION, registered last so it runs FIRST: a pass that is
 *      stopped (a settings flip, a serve shutting down) stops the TURN rather
 *      than walking away from it. A turn left running would write into the
 *      subtree with nobody watching and no commit of its own to be undone by —
 *      the one outcome worse than not sleeping at all.
 *
 * The memo and the turn therefore end on the same path, however the pass ends.
 *
 * ## One commit, and the one thing it may not sweep
 *
 * The commit names the files the node's memory LIVES IN — its own outline, and
 * every file holding a record under it — because a sleep is one commit a person
 * can `git revert`, and a revert of somebody else's parked edits is not an undo
 * of anything this pass did. `@olai/plugin-api`'s `Ledger.waiting` is what makes
 * that nameable at all: a plugin knows its files by their served names, and a
 * commit request names them as git does, and the two are the same string only
 * when olai serves the repository root.
 *
 * WHAT IT STILL SWEEPS, written down rather than left to be found: other rows of
 * those same files that a person edited are inside the commit too. Narrowing
 * further would mean a node-level selection, which git does not have — and the
 * alternative, committing nothing, is the outcome worse than a commit nobody
 * asked for (a machine that edits at night and leaves the edits waiting). A file
 * the agent creates OUTSIDE that set — which the instruction forbids, and which
 * a `move` inside the subtree does not produce — is left waiting rather than
 * swept, which is the safe direction.
 *
 * ## What it is NOT
 *
 * Nothing new is declared on the row, nothing is registered, and nothing is
 * remembered outside this activation: which nodes failed lives in one map here,
 * so a restart forgets it. That is the whole of this module's state.
 */

import {
  changedUnder,
  memoryFiles,
  type NodeAgent,
  type NodeAgents,
  type OpFailure,
  type Reading,
  stampOf,
  type WriteRequest,
} from "@olai/format"
import { Clock, Duration, Effect, Queue, Semaphore, type Scope } from "effect"

import type { Conversing } from "../sessions.ts"
import type { LiveSession, ReadingObserver } from "../scoped.ts"
import { sleepFor } from "../sleep.ts"
import type { ChatState } from "../wire/members.ts"

/**
 * HOW LONG A DELIVERED TURN MAY TAKE TO START before the pass stops waiting for
 * it — THE ONE DEADLINE THAT IS NOT A SETTING.
 *
 * The pass's three SPANS are the vault's (`./settings.ts`): `sleep-after`,
 * `sleep-tick` and `sleep-question` are written by an operator and shortened by
 * the harness through the same declared config, because a slow engine and a
 * short one want different patience and a test cannot wait six hours. This one
 * is different: it exists so that a BUG cannot wedge the loop for ever, and
 * there is no user-facing meaning in it to configure.
 *
 * A machine turn that was HELD rather than handed is the case it covers: the
 * body waits for a turn boundary, and if there is no turn to bound it, it waits
 * forever. Two minutes is a wake plus a handshake on a slow machine, and it
 * must not be less: a node asleep for a week boots a process before it can
 * answer anything.
 */
export const START_MS = Duration.toMillis(Duration.minutes(2))

/** HOW LONG A NODE THAT FAILED IS LEFT ALONE, in memory and only in memory. */
export const SKIP_MS = Duration.toMillis(Duration.hours(24))

/** WHAT A PASS CONCLUDED, which is what the loop does next about it. */
export type Verdict =
  /** The turn ended with nothing wrong: the memo is written and committed. */
  | "slept"
  /** The conversation is not there — the process died, or the panel was let go. */
  | "gone"
  /** Something went wrong mid-turn, or the memo could not be written. */
  | "trouble"
  /** The turn sat on a question past `sleep-question` and was cancelled. */
  | "question"
  /**
   * SOMEBODY ELSE STOPPED IT — a person pressed Cancel, or the agent stopped
   * its own turn. Nothing was written and nothing is remembered: the rewrite is
   * half done, so there is no memo and no commit, and no back-off either,
   * because the next tick is entitled to try again and a person's press is not
   * a failure to wait out.
   */
  | "cancelled"
  /** The turn ran past `sleep-limit`, so it was stopped. */
  | "limit"
  /** The turn never started, so there was nothing to wait for. */
  | "unstarted"

/** What the log says about a pass that did not finish. `slept` is absent by
 *  construction rather than by omission: it is the only arm with nothing to
 *  explain, and a map with an entry for it would be a sentence nobody writes. */
const WHY: Record<Exclude<Verdict, "slept">, string> = {
  gone: "the conversation is not there any more",
  trouble: "the turn went wrong, or the memo could not be written",
  question: "it asked a question nobody is there to answer, so it was stopped",
  cancelled: "its turn was cancelled before it finished, so nothing was written",
  limit: "the turn ran past its limit, so it was stopped",
  unstarted: "the turn never started",
}

/**
 * EVERYTHING THE PASS IS HANDED — closures, all of them, because the pass owns
 * none of it. The roster, the scheduler's doors and the write gate are chat's
 * server row's, and what this module may do is exactly what it is given here.
 */
export interface Sleeping {
  /** Every durable node agent, including ones with no live conversation. */
  readonly nodes: () => NodeAgents
  /** WHEN THIS NODE LAST SLEPT, off whichever key the vault declares the memo
   *  on — `null` for a node that never has. */
  readonly sleptAt: (node: string) => string | null
  /** THE KEY THE MEMO IS WRITTEN UNDER — the vault's own column where it has
   *  one, and the word this plugin's kind claims where it has not. */
  readonly sleptKey: () => string
  /** The standing of every acquired node scope, keyed by node id. A node with
   *  no entry is ASLEEP: no conversation, no process, nothing to interrupt. */
  readonly live: () => ReadonlyMap<string, LiveSession>
  /** Send one machine turn into a node agent's own conversation, exactly as a
   *  doorbell does — the row it writes carries this feature's own word. */
  readonly deliver: (to: Conversing, say: () => string | null) => Effect.Effect<void>
  /** TAKE BACK THE WORDS THIS PASS HANDED OVER, for one conversation — what the
   *  scope's finalizer does with a delivery it never saw delivered. A body the
   *  scheduler or a panel is still holding would otherwise fire as a machine
   *  turn with no hold, no observer, no memo and no commit
   *  ({@link @olai/plugin-api}'s `Deliveries` and `olai-plugin-chat`'s
   *  `Chat.withdraw` argue the whole of it). */
  readonly withdraw: (to: Conversing) => Effect.Effect<void>
  /**
   * OBSERVE ONE NODE'S CONVERSATION, and answer with the ONE THING the pass may
   * do to it: stop its turn.
   *
   * A CONTRACT AND NOT A PANEL, which is the difference between the pass's
   * dependency and the whole of chat's: what it watches arrives through
   * {@link ReadingObserver}, and what it does at the end is `cancel`. Handing
   * over a `Panel` would be handing over thirty members nobody here may use —
   * and would put a subprocess behind every test of the pass's own judgement,
   * which is the argument `./turns.ts` makes for its own small state machines.
   */
  readonly watch: (
    to: Conversing,
    observer: ReadingObserver,
  ) => Effect.Effect<Stoppable, OpFailure, Scope.Scope>
  /** The set as a reader sees it — what the subtree walk is taken off. */
  readonly read: Effect.Effect<Reading & { readonly outlineRow: string }, OpFailure>
  /** One write, under this feature's own writer word. */
  readonly write: (request: WriteRequest) => Effect.Effect<unknown, OpFailure>
  /** WHAT IS WAITING, in the two names every outline has — so the commit below
   *  can name the files the pass wrote in the spelling git wants
   *  (`@olai/plugin-api`'s `Ledger.waiting`). */
  readonly waiting: Effect.Effect<ReadonlyArray<{ readonly file: string; readonly path: string }>>
  /** One commit OF EXACTLY THESE PATHS, under the same word, answering with the
   *  reason it did NOT happen — `null` when it did. A commit that could not
   *  happen is not a failed pass: under `commit: off`, and with no repository at
   *  all, the memo has still landed and waits like anybody else's write.
   *
   * PATHS AND NEVER A BARE MESSAGE, and that is the promise this feature is
   * built on: a sleep is one commit a person can `git revert`, so it may not
   *  sweep in somebody else's parked work: the paths are the files that memory
   *  lives in ({@link @olai/format}'s `memoryFiles`), and nothing else. */
  readonly commit: (
    message: string,
    paths: ReadonlyArray<string>,
  ) => Effect.Effect<{ readonly said: string; readonly failed: boolean } | null>
  /** Keep the quiet window shut for this scope — see the header's order. */
  readonly hold: Effect.Effect<void, never, Scope.Scope>
  /** A line at the level an operator reads: a pass that did not finish is a
   *  thing to be able to find afterwards, and one that did is not. */
  readonly warn: (line: string) => Effect.Effect<void>
  /** How long a node must have been left alone (`sleep-after`). */
  readonly after: Duration.Duration
  /** How often the loop looks (`sleep-tick`, shortened in the harness). */
  readonly tick: Duration.Duration
  /** How long a turn may sit on an unanswered question (`sleep-question`). */
  readonly question: Duration.Duration
  /**
   * HOW LONG ONE TURN MAY RUN AT ALL (`sleep-limit`).
   *
   * The other three spans bound WAITING — for a start, for a boundary, for an
   * answer. This one bounds the turn itself, and it exists because a turn that
   * never ends holds the quiet window shut for the whole vault, wedges the loop
   * on the permit and makes every *Sleep now* answer "busy" — with the git pill
   * still promising a commit that cannot come. An hour is generous for a
   * tidying pass and far short of "for ever".
   */
  readonly limit: Duration.Duration
  /** How long a delivered turn may take to start ({@link START_MS}). */
  readonly start: Duration.Duration
  readonly log: (line: string) => Effect.Effect<void>
}

/** WHAT THE PASS MAY DO TO THE CONVERSATION IT IS WATCHING: stop the turn it
 *  started, and nothing else ({@link Sleeping.watch}). */
export interface Stoppable {
  readonly cancel: Effect.Effect<void, OpFailure>
}

/** WHAT A REQUEST FOR A PASS RIGHT NOW WAS TOLD — see {@link makeSleeper}'s
 *  `now`. Three answers, and not the pass's verdict: a verdict exists when the
 *  pass ENDS, and the person who pressed the row is owed an answer while it
 *  runs. */
export type Asked = "started" | "busy" | "unknown"

/**
 * THE LOOP, forked into the caller's scope — and the TWO passes it takes, handed
 * back: the loop's own (`tick`, which a test drives by hand) and the one a
 * person asks for (`now`, the verb's door).
 */
export const makeSleeper = (
  doors: Sleeping,
): Effect.Effect<
  {
    readonly tick: Effect.Effect<boolean, never, Scope.Scope>
    readonly now: (node: string) => Effect.Effect<Asked, never, Scope.Scope>
  },
  never,
  Scope.Scope
> =>
  Effect.gen(function*() {
    /** THE NODES THIS ACTIVATION HAS GIVEN UP ON, by node id, and when. In
     *  memory, so a restart forgets — which costs one retry per restart on a
     *  node that is going to fail again anyway. */
    const failures = new Map<string, number>()

    const skipped = (node: string, now: number): boolean => {
      const at = failures.get(node)
      if (at === undefined) return false
      if (now - at < SKIP_MS) return true
      failures.delete(node)
      return false
    }

    /**
     * THE NEXT NODE TO SLEEP, or `null` — the whole of what a candidate is.
     *
     * In order, and each test is a way of being wrong about a node:
     *
     *   - A NODE WITH NO CONVERSATION (`session: null`) is not asleep, it is
     *     unbound: there is nothing to hand a turn to.
     *   - A NODE THAT FAILED, for {@link SKIP_MS}.
     *   - A NODE THAT IS NOT IDLE. `live` present means a process is up, so
     *     the standing has to be exactly idle: working is a turn, `booting` is
     *     a handshake, `off`/`gone` are a conversation to be woken, and a
     *     question is somebody's to answer. `live` ABSENT is the sleeping agent
     *     the doorbell wakes, which is the ordinary candidate.
     *   - A NODE TOUCHED RECENTLY. With a live conversation that is the
     *     panel's own `since` — the instant its status last moved, which is how
     *     a node that has just finished a turn is left alone rather than
     *     tidied the moment it stops talking. With no conversation there is no
     *     `since` at all, so the subtree's own newest stamp stands in: a node
     *     asleep for a week still counts as touched when its memory was last
     *     written.
     *   - A NODE WHOSE MEMORY HAS NOT MOVED since it last slept — which is the
     *     whole reason the memo exists, and what keeps a quiet vault from
     *     spending a turn an hour on nothing.
     *
     * THE NODE'S OWN RECORD IS NEVER CONSULTED: the memo is a property on the
     * node, so every pass re-stamps that node's own `changed`, and a walk that
     * read it would find its own last sleep and never sleep again
     * (`@olai/format`'s `changedUnder`).
     */
    const candidate = (): Effect.Effect<{ readonly agent: NodeAgent; readonly files: ReadonlySet<string> } | null> =>
      Effect.gen(function*() {
        const observed = yield* Effect.result(doors.read)
        if (observed._tag === "Failure") return null
        const derived = observed.success.derived
        const live = doors.live()
        const now = yield* Clock.currentTimeMillis
        const after = Duration.toMillis(doors.after)
        for (const agent of doors.nodes()) {
          if (agent.session === null) continue
          if (skipped(agent.id, now)) continue
          // A CONVERSATION THAT IS UP IS NOT ASLEEP: working is a turn, booting
          // is a handshake, and a question is somebody's to answer. `off` and
          // `gone` are NOT that — they are a process that died, or an engine
          // that left — and the delivery path wakes one: the pass's own reading
          // reopens the conversation before it hands the turn over. A slot left
          // `gone` would otherwise be unsleepable for as long as it sat in the
          // pool, which is the idle window — 48 hours by default.
          const standing = live.get(agent.id)
          const dead = standing !== undefined && (standing.status === "off" || standing.status === "gone")
          if (standing !== undefined && !dead) {
            if (standing.status !== "idle" || standing.asking > 0 || standing.unopened === true) continue
          }
          // QUIET FOR `sleep-after`, and BOTH READINGS OF QUIET ARE ASKED. The
          // conversation's own idle instant where there is one — how long since
          // this agent last stopped working — and the memory's newest stamp
          // always, because those are different facts: a person editing this
          // subtree in the outline at 22:00 while the agent has been idle since
          // 14:00 is a node nobody should be tidying.
          //
          // A `since` this reading cannot place — absent, or not a date — costs
          // the CONVERSATION's half of the test and nothing else. It used to
          // disqualify the node for ever, which is a state nothing could leave:
          // the scheduler always sets `since` at acquisition and on every status
          // change, so the arm is unreachable in a serve, and a rule whose
          // failure mode is "never" is worse than one that falls back.
          const since = standing?.since
          if (since !== undefined) {
            const at = Date.parse(since)
            if (!Number.isNaN(at) && now - at < after) continue
          }
          // EVERY OTHER NODE AGENT IS A DOOR THIS PASS DOES NOT OPEN: a subtree
          // with another agent seated in it would otherwise have each sleep
          // re-stamp the other for ever (`@olai/format`'s `changedUnder`).
          const others = new Set(
            doors.nodes().filter((one) => one.id !== agent.id).map((one) => one.id),
          )
          if (changedUnder(derived, agent.id, stampOf(new Date(now - after)), others)) continue
          if (!changedUnder(derived, agent.id, doors.sleptAt(agent.id), others)) continue
          return { agent, files: memoryFiles(derived, agent.id, others) }
        }
        return null
      })

    /**
     * WHEN THE TURN HAS ENDED, and how — off the conversation's own state, one
     * reading at a time.
     *
     * IT WAITS FOR THE TURN FIRST because a state that is not `thinking` before
     * the delivery lands is the panel as it was, not a turn that finished. The
     * first `thinking` is ours by construction: the queue is opened before the
     * delivery, the candidate had no turn running, and `begin` marks the panel
     * thinking in the same step that writes the row.
     *
     * A QUESTION ARMS A CLOCK rather than cancelling at once: an agent that
     * asks and answers itself in the same breath is not a failure, and the
     * deadline is the same twenty minutes the alert would have given a person.
     */
    const watchTurn = (states: Queue.Queue<ChatState>): Effect.Effect<Verdict> =>
      Effect.gen(function*() {
        // THE TURN IS OURS ONLY WHEN THE MARK SAYS SO. A reader attached to a
        // conversation is handed its current state at once, so the first
        // `thinking` this sees can be a PERSON's turn, another plugin's
        // doorbell, or a boot — and a body this pass handed over is HELD while
        // any of those run, then flushed at the boundary they end at. Reading
        // the wrong turn as its own is how a pass would stamp the memo and
        // commit somebody else's writes as `sleep`. `begin` puts `sleep: true`
        // on the state for exactly as long as olai's own turn lasts
        // (`olai-plugin-chat`'s `chat.ts`), so the mark is what this waits for —
        // and a body that was held for a person's turn never produces one, which
        // is what {@link START_MS} is left to answer.
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
        // ...AND EVERY WAIT AFTER IT IS BOUNDED, the quiet one included: a turn
        // that stops reporting holds the window shut for the whole vault and
        // wedges the permit, which is what `sleep-limit` is for.
        const started = yield* Clock.currentTimeMillis
        let asking = 0
        for (;;) {
          const now = yield* Clock.currentTimeMillis
          const left = Duration.toMillis(doors.limit) - (now - started)
          if (left <= 0) return "limit"
          const taken = Effect.map(Queue.take(states), (state) => ({ state, silence: false } as const))
          const next = asking === 0
            ? yield* Effect.raceFirst(
              taken,
              Effect.as(Effect.sleep(Duration.millis(left)), { state: null, silence: true } as const),
            )
            : yield* Effect.raceFirst(
              taken,
              Effect.as(
                Effect.sleep(Duration.millis(Math.min(left, Math.max(0, Duration.toMillis(doors.question) - (now - asking))))),
                { state: null, silence: true } as const,
              ),
            )
          if (next.silence || next.state === null) {
            // WHICH DEADLINE RAN OUT, because they mean different things: a
            // question is an agent waiting for somebody who is not there, and
            // the limit is a turn that has stopped making progress at all.
            const over = Duration.toMillis(doors.limit) - ((yield* Clock.currentTimeMillis) - started)
            return over <= 0 ? "limit" : "question"
          }
          const state = next.state
          // THE TURN IS OVER — the mark went off, or the status left
          // `thinking`. Both are read, because `idle` is published a frame
          // BEFORE the mark is cleared (`chat.ts`'s `ensuring`), and a state
          // without the mark is not this pass's turn whatever it says. `idle` is
          // the one ending that says nothing went wrong; a boot or a lost
          // process is not a finished pass, and the panel's own `trouble` is
          // where a failed turn says so.
          if (state.sleep !== true || state.status !== "thinking") {
            if (state.status !== "idle") return "gone"
            // CANCELLED FIRST, and it is why the state carries the flag: a
            // cancelled turn lands on `idle` with no `trouble`, which is what a
            // turn that ENDED looks like — and calling it a finished sleep would
            // stamp the memo on a rewrite that stopped halfway and keep the node
            // from being tried again.
            if (state.cancelled) return "cancelled"
            return state.trouble === null ? "slept" : "trouble"
          }
          if (state.trouble !== null) return "trouble"
          asking = state.asking > 0 ? (asking === 0 ? yield* Clock.currentTimeMillis : asking) : 0
        }
      })

    /**
     * STOP THE TURN — and only while it is still OURS, which is the mark again.
     *
     * A question's deadline or a stop can arrive after olai's own turn has ended
     * and a person's has begun in its place (`chat.ts` hands the next body over
     * at the boundary), and `cancel` stops whatever is running: a cancel aimed
     * at "the conversation" would kill that person's turn. So the last state the
     * panel reported decides, and a turn that is not marked is left alone — said
     * out loud rather than silently, because a pass that decided not to stop
     * something is a thing an operator should be able to read.
     */
    const stopping = (stoppable: Stoppable, node: string, ours: boolean): Effect.Effect<void> =>
      ours
        ? Effect.catch(
          stoppable.cancel,
          (failure) => doors.log(`sleep: ${node}: the turn would not stop: ${failure.message}`),
        )
        : doors.log(`sleep: ${node}: its turn had already ended, so nothing was cancelled`)

    /** ONE PASS, in its own scope — the header's three acquisitions in order. */
    const one = (
      agent: NodeAgent,
      files: ReadonlySet<string>,
    ): Effect.Effect<Verdict, never, Scope.Scope> =>
      Effect.scoped(Effect.gen(function*() {
        const to = { agent: agent.engine, session: agent.session as string }
        yield* doors.hold
        const states = yield* Queue.unbounded<ChatState>()
        // THE PANEL'S LAST WORD, kept beside the queue: what a cancel is judged
        // against ({@link stopping}), because a cancel can arrive long after the
        // state that earned it.
        let last: ChatState | null = null
        const observed = yield* Effect.result(doors.watch(to, {
          state: (state) => {
            last = state
            Queue.offerUnsafe(states, state)
          },
          // The transcript is the panel's business; nothing about a pass is
          // decided by a row.
          transcript: () => {},
        }))
        if (observed._tag === "Failure") {
          yield* doors.warn(`sleep: ${agent.id}: its conversation could not be read: ${observed.failure.message}`)
          return "gone"
        }
        const stoppable = observed.success
        // TRUE FROM HERE, and the finalizer is why: whatever ends this scope —
        // the loop being interrupted, the row unloading, a settings flip — the
        // turn it may have started is stopped before the scope lets go of the
        // hold.
        let running = true
        yield* Effect.addFinalizer(() => Effect.gen(function*() {
          if (running) {
            running = false
            yield* doors.warn(`sleep: ${agent.id}: the pass was stopped, so its turn was cancelled`)
            yield* stopping(stoppable, agent.id, last?.sleep === true)
          }
          // ...AND ITS OWN WORDS, WITHDRAWN. A delivery this pass handed over and
          // never saw delivered is work with no owner: it would sit in the
          // scheduler's queue and fire days later as a machine turn with no hold
          // on the quiet window, nobody observing it, no memo and no commit. The
          // pass's own sentence is the one thing that can take it back, and this
          // is where it is about to stop being there to.
          //
          // UNCONDITIONAL, and it is a no-op on a pass that handed its turn over:
          // a body the agent has already been given is not in the holding at all
          // (`olai-plugin-chat`'s `deliveries.ts`).
          yield* doors.withdraw(to)
        }))
        yield* doors.deliver(to, () => sleepFor(agent))
        const verdict = yield* watchTurn(states)
        // THE TWO VERDICTS THAT LEAVE A TURN RUNNING, and both of them stop it.
        // A question is an agent waiting for somebody who is not there; a
        // `trouble` from a `thinking` state (`watchTurn` answers that arm off a
        // turn whose `trouble` is already set) is an agent still working on
        // something that went wrong. Either way this scope is about to close
        // and the hold with it, so a turn left running would carry on
        // unobserved, with no memo and no commit — the outcome the header calls
        // worse than not sleeping at all. A `trouble` read off an `idle` state
        // is a turn that has already ended, and `cancel` is a no-op there.
        if (verdict === "question" || verdict === "trouble" || verdict === "limit") {
          running = false
          yield* stopping(stoppable, agent.id, last?.sleep === true)
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
        // ... AND ONE COMMIT OF THE FILES THAT MEMORY LIVES IN, named in the
        // spelling git takes. Anything else waiting — a person's parked edits
        // in another file, another agent's work — is left exactly where it was,
        // because this commit is the undo of THIS pass and nothing else.
        //
        // THE FILES ARE READ AGAIN, so the commit names where the memory is NOW
        // rather than where it was when the node was picked: a row the agent
        // MOVED has its record in a file the candidate-time set never had, and
        // the record it moved would stay waiting — the one direction the header
        // promises cannot happen. The UNION, because the pass may also have
        // written where the fresh reading no longer looks (a `move` that took a
        // record out of this subtree leaves a file this pass edited). A re-read
        // that fails costs the union and nothing else: the candidate's set is
        // still the files this pass may name.
        const reread = yield* Effect.result(doors.read)
        const named = reread._tag === "Success"
          ? new Set([...files, ...memoryFiles(reread.success.derived, agent.id)])
          : files
        const waiting = yield* doors.waiting
        const paths = waiting.filter((row) => named.has(row.file)).map((row) => row.path)
        const refusal = yield* doors.commit(`sleep: ${agent.title}`, paths)
        if (refusal === null) {
          yield* doors.log(`sleep: ${agent.id} finished and committed`)
        } else if (refusal.failed) {
          // A COMMIT GIT ITSELF REFUSED IS A WARNING, and it is the one failure
          // here that nothing retries: the memo is already written, so the node
          // is not due again, and the log is the only place a person can find
          // out that the pass's writes were never recorded. `docs/chat.md` says
          // where to look.
          yield* doors.warn(`sleep: ${agent.id} finished, but the commit was refused: ${refusal.said}`)
        } else {
          yield* doors.log(`sleep: ${agent.id} finished; the memo is written and waiting: ${refusal.said}`)
        }
        return "slept"
      }))

    /**
     * ONE PASS AT A TIME, BY THE PERMIT — three callers, and the permit is what
     * keeps them from overlapping: the loop (a tick), the verb (a person
     * pressing *Sleep now*), and the test door, which is `tick` handed
     * back so a case can drive a pass without waiting for a span.
     */
    const passes = Semaphore.makeUnsafe(1)
    const tick: Effect.Effect<boolean, never, Scope.Scope> = passes.withPermit(Effect.gen(function*() {
      const next = yield* candidate()
      if (next === null) return false
      yield* doors.log(`sleep: ${next.agent.id} is being tidied`)
      const verdict = yield* one(next.agent, next.files)
      // NOTHING IS REMEMBERED AGAINST A NODE SOMEBODY STOPPED: the back-off is
      // for a node that fails on its own, and a person's Cancel (or an agent
      // stopping itself) is not that — the next tick is entitled to try again.
      if (verdict !== "slept" && verdict !== "cancelled") {
        failures.set(next.agent.id, yield* Clock.currentTimeMillis)
      }
      return true
    }))

    /**
     * ONE PASS, ASKED FOR BY NAME — a person's own gesture, and the loop's other
     * production caller.
     *
     * THE SAME PERMIT, TAKEN WITHOUT WAITING. A request that arrives while a
     * pass is running is refused in words rather than queued: somebody who
     * pressed a button is owed an answer now, and a queue of machine turns
     * nobody asked for is the thing this refuses to become.
     *
     * WHAT IT DOES NOT ASK is `candidate()`'s opinion. The idle window and the
     * "memory has moved" test are about whether a node is DUE, and a person
     * pressing *Sleep now* has answered that themselves. Everything the
     * pass then does with the node — the hold on the quiet window, the mark on
     * the turn, the cancel when a turn goes wrong or sits on a question, the
     * memo and the commit — is `one`, unchanged.
     *
     * NOT REMEMBERED WHEN IT FAILS: the failure map is for a LOOP that would
     * otherwise retry a broken node every tick, and a person can ask again.
     *
     * IT ANSWERS WHEN THE PASS HAS BEGUN, not when it ends — a tidying turn
     * runs for minutes, and what is waiting on this answer is a palette row a
     * person pressed. So the pass is forked into the CALLER's scope, which for
     * the verb is the chat server's own, exactly as the loop's fiber is; and
     * what comes back is what happened to the REQUEST: it started, or it did not
     * and why. The verdict is nobody's answer here — `one` says it in the log
     * and, when a turn went wrong, in a warning.
     */
    const now = (node: string): Effect.Effect<Asked, never, Scope.Scope> =>
      Effect.gen(function*() {
        const agent = doors.nodes().find((one) => one.id === node)
        if (agent === undefined || agent.session === null) return "unknown"
        // WHAT `candidate()` ASKS ABOUT A NODE'S STATE, and nothing else: a
        // person pressing a button has answered "is this node DUE", and has not
        // answered "is anything else going on here". A node whose turn is
        // running, whose question is open, or whose open was refused is "busy" —
        // because the body this pass hands over would be HELD behind that turn
        // and then watch a turn that is not its own
        // ({@link watchTurn} says what that costs).
        const standing = doors.live().get(agent.id)
        if (standing !== undefined) {
          const dead = standing.status === "off" || standing.status === "gone"
          if (!dead && (standing.status !== "idle" || standing.asking > 0 || standing.unopened === true)) return "busy"
        }
        // THE SET IS READ FRESH, and a set that cannot be read is a node whose
        // memory cannot be named: the commit would name nothing, so nothing is
        // tidied. (The loop's reading failing is simply "no candidate".)
        const observed = yield* Effect.result(doors.read)
        if (observed._tag === "Failure") return "unknown"
        const others = new Set(doors.nodes().filter((one) => one.id !== agent.id).map((one) => one.id))
        // TAKEN, LOGGED AND FORKED AS ONE STEP, uninterruptibly: the fiber that
        // hands the permit back is the one this forks, so a request interrupted
        // between the take and the fork would leave a permit nobody owns and
        // wedge the loop for the life of the process — every tick after it would
        // wait for ever, and every Sleep now would answer "busy".
        return yield* Effect.uninterruptible(Effect.gen(function*() {
          if (!(yield* Semaphore.takeIfAvailable(passes, 1))) return "busy" as const
          yield* doors.log(`sleep: ${agent.id} was asked for, and is being tidied`)
          yield* Effect.forkScoped(
            one(agent, memoryFiles(observed.success.derived, agent.id, others)).pipe(
              // THE PERMIT GOES BACK WHEN THE PASS ENDS, whichever way it ends:
              // the pass is a fiber of its own now, so nothing else can hand it
              // back.
              Effect.ensuring(Semaphore.release(passes, 1)),
            ),
          )
          return "started" as const
        }))
      })

    yield* Effect.forkScoped(Effect.gen(function*() {
      for (;;) {
        yield* Effect.sleep(doors.tick)
        yield* Effect.catchCause(tick, (cause) =>
          doors.warn(`sleep: the pass failed: ${String(cause)}`))
      }
    }))
    return { tick, now }
  })
