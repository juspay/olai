#!/usr/bin/env bun
/**
 * A PADI THAT IS NOT A PADI — the far end of the terminal door's e2e.
 *
 * The scenarios about the door are about what a CHIP does with a fleet, and
 * standing up a real kolu to get one would make them a test of kolu's daemon
 * on whatever machine the suite happens to run on. So this serves padi's own
 * surface — the real `padiSurface` spec, over the real `serveOverUnixSocket`,
 * on a temp socket — with a fleet it was handed on the command line.
 *
 * It is NOT a mock of the dial. The whole local path runs: socket →
 * `socketDuplexLink` over `padiDaemonGroup` → the frozen control core's
 * `hello` → the compatibility gate → the two typed faces. That is deliberately
 * kolu's own consumer smoke (`@kolu/padi-client`'s `dialLoopback.test.ts`)
 * grown three members: it serves the CONTROL sibling AND `terminals`,
 * `screen.text` and `watchStates`, which is the slice olai reads.
 *
 * What differs from a real padi is what it ANSWERS and nothing else — so a
 * scenario that passes here is a scenario about olai, and a change to padi's
 * wire breaks this the same way it would break the product.
 *
 * ## Why it lives beside the fake kolu and not in a step definition
 *
 * It is a PROCESS, spawned before the server it serves, exactly as the fake ACP
 * agent is. A step definition that started a listener in the runner's own
 * process would put a padi in the same process as the browser driver, and the
 * one thing this file has to be honest about is that olai reaches it over a
 * socket like anything else.
 *
 * Usage: `fake-padi.ts <socket-path> <fleet.json>` — and it prints `listening`
 * on stdout when the socket is bound, so a caller waits for a fact rather than
 * for a timer.
 */

import { readFileSync } from "node:fs"

import { implementSurface, inMemoryStore } from "@kolu/surface/server"
import { serveOverUnixSocket } from "@kolu/surface/unix-socket"
import { CONTROL_CORE_VERSION } from "@kolu/surface-daemon/control-core"
import {
  PADI_SURFACE_VERSION,
  padiControlSibling,
  padiDaemonGroup,
  padiSurfaceSibling,
  TerminalNotFound,
} from "@kolu/padi-client/surface"
import { Effect, Queue, Stream } from "effect"

import { agentBucket, WATCH_DEFAULT_STATES } from "@kolu/terminal-vocab/agentProjection"
import type { PadiStateEvent } from "@kolu/padi-client/surface"

/** What the fixture hands over: the terminals, and what each one's screen
 *  says. Two maps rather than one record with the screen on it, because padi's
 *  own record does not carry a screen — a snapshot is a VERB there, and a
 *  fixture that put the text on the record would be modelling a padi that does
 *  not exist. */
interface Fleet {
  readonly terminals: Record<string, unknown>
  readonly screens: Record<string, string>
  /** padi's attention partition, verbatim — which terminals are asking,
   *  working, lingering, finished. Absent means nothing is asking of anyone,
   *  which is the ordinary fixture. */
  readonly urgency?: {
    readonly awaitingIds: ReadonlyArray<string>
    readonly finishedIds: ReadonlyArray<string>
    readonly workingIds: ReadonlyArray<string>
    readonly lingerIds: ReadonlyArray<string>
  }
  /** What this padi claims its surface version is. Absent means "the one this
   *  build speaks" — the ordinary case; a scenario about SKEW sets it. */
  readonly surfaceVersion?: string
}


/** What `screen.text` takes — padi's own input, spelled here because the fake
 *  reads two fields of it that the rest of this file never touches. */
interface ScreenTextInput {
  readonly id: string
  readonly startLine?: number
  readonly endLine?: number
}

/** THE LOCAL SUBSTITUTE for padi's `stateWatch` engine — ~thirty lines where
 *  the daemon is a hub, a retained buffer and a settle detector. It exists
 *  because this fake's fleet is STATIC: a record that never moves is one
 *  where every episode began at its `startedAt` and never ends, so the whole
 *  engine reduces to "honor the deadline once, then count the nag".
 *
 *  IT IS NOT A SECOND SEMANTICS — it is the WIRE's semantics: the spec answers
 *  what a subscription does with an already-standing match (a leading
 *  `snapshot` frame), when it counts (the daemon's observation clock, which
 *  this stream reads off `agent.startedAt` so `heldForMs: 0` and `60s` both
 *  answer a fixture whose agents started in 2023), and how the cap is said
 *  (`nag: { index, left }` on each nag event, `left` absent on an uncapped
 *  run). A scenario that edits a knob and waits for the re-lead — the
 *  doorbell's `held-for: 0s` gesture — works because a re-SUBSCRIPTION here
 *  is a fresh source, exactly as a changed question re-leads daemon-side. */
interface WatchInput {
  readonly states?: ReadonlyArray<string>
  readonly heldForMs?: number
  readonly nagMs?: number
  readonly nagCount?: number
  readonly ignoreIds?: ReadonlyArray<string>
  readonly id?: string
}

/** The fixture's own record shape, narrowed to the two fields this engine
 *  reads: the agent's word, and when padi says it began. */
interface AgentRecord {
  readonly agent?: { readonly state?: string; readonly startedAt?: number } | null
}

/** THE DAEMON'S SEQUENCE — one counter across subscriptions, as the wire's
 *  `seq` doc asks ("monotonic per-daemon"). */
let stateSeq = 0

const watchStates = (input: WatchInput): Stream.Stream<ReadonlyArray<PadiStateEvent>> =>
  Stream.callback<ReadonlyArray<PadiStateEvent>>((queue) =>
    Effect.gen(function*() {
      const wanted = new Set(input.states ?? WATCH_DEFAULT_STATES)
      const heldForMs = input.heldForMs ?? 0
      const ignored = new Set(input.ignoreIds ?? [])
      /** THE MATCHED SET, static: every terminal whose agent's bucket the
       *  question names, whose episode outlived the deadline, and that the
       *  scope does not exclude. */
      const matched: ReadonlyArray<{ readonly id: string; readonly state: string; readonly since: number }> =
        Object.entries(fleet.terminals)
          .filter(([id, record]: [string, unknown]) => {
            if ((input.id !== undefined && id !== input.id) || ignored.has(id)) return false
            const agent = (record as AgentRecord).agent
            if (agent?.state === undefined || agent.state === null) return false
            if (!wanted.has(agentBucket(agent.state as never))) return false
            return (agent.startedAt ?? Date.now()) + heldForMs <= Date.now()
          })
          .map(([id, record]: [string, unknown]) => {
            const agent = (record as AgentRecord).agent as NonNullable<AgentRecord["agent"]>
            return { id, state: agentBucket(agent.state as never), since: agent.startedAt ?? Date.now() }
          })
      const event = (
        kind: "snapshot" | "transition" | "nag",
        one: (typeof matched)[number],
        nag?: { readonly index: number; readonly left?: number },
      ): PadiStateEvent => {
        stateSeq += 1
        return {
          seq: stateSeq as never,
          id: one.id as never,
          kind,
          state: one.state as never,
          since: one.since as never,
          at: Date.now() as never,
          ...(nag === undefined ? {} : { nag }),
        } as never
      }
      // THE LEADING FRAME — even an EMPTY one: "nothing matches" is a frame,
      // not a silence (the spec's own sentence about the member's first act).
      Queue.offerUnsafe(queue, matched.map((one) => event("snapshot", one)))
      // THE NAG: one round per interval, a batch per round, until the cap —
      // and the stream's own scope closes the timers, so a cancelled
      // subscription's still-armed round dies with it rather than a timer
      // firing into a successor's queue.
      const timers: Array<ReturnType<typeof setTimeout>> = []
      if (input.nagMs !== undefined && matched.length > 0) {
        const cap = input.nagCount
        const arm = (index: number): void => {
          timers.push(setTimeout(() => {
            Queue.offerUnsafe(queue, matched.map((one) => event("nag", one, {
              index: index as never,
              ...(cap === undefined ? {} : { left: (cap - index) as never }),
            })))
            if (cap === undefined || index < cap) arm(index + 1)
          }, input.nagMs))
        }
        arm(1)
      }
      yield* Effect.addFinalizer(() => Effect.sync(() => timers.forEach(clearTimeout)))
    }),
  )

/**
 * KAVAL'S REAL CLAMP, and the fake is worth nothing without it.
 *
 * `getScreenText` (`kaval/src/ptyHost.ts`) is four lines and this is those four
 * lines: `end = min(buffer.length, endLine ?? length)`, `start = max(0,
 * startLine ?? 0)`, slice, join. Both bounds are ABSOLUTE line numbers into the
 * scrollback, and the only clamp is low-side — so `startLine` past the end
 * yields the EMPTY STRING rather than a tail.
 *
 * That is not a detail: this file's header claims the fake "differs from a real
 * padi in what it ANSWERS and in nothing else", and for a while it was false
 * for the one verb the door calls — the handler ignored the window entirely,
 * so olai's absolute-vs-tail confusion could not show up in any scenario. The
 * lanes fixture's screens are two and three lines long, so with the real clamp
 * a caller that asks for a 120-line "tail" gets nothing, and the scenario that
 * reads a screen fails.
 */
const windowOf = (screen: string, input: ScreenTextInput): string => {
  const lines = screen.split("\n")
  const end = Math.min(lines.length, input.endLine ?? lines.length)
  const start = Math.max(0, input.startLine ?? 0)
  return lines.slice(start, Math.max(start, end)).join("\n")
}

const [, , socketPath, fleetPath] = process.argv
if (socketPath === undefined || fleetPath === undefined) {
  console.error("usage: fake-padi.ts <socket-path> <fleet.json>")
  process.exit(2)
}

const fleet = JSON.parse(readFileSync(fleetPath, "utf8")) as Fleet
const surfaceVersion = fleet.surfaceVersion ?? PADI_SURFACE_VERSION

/**
 * THE CONTROL CORE, which is what the dial handshakes before it judges
 * anything. Frozen upstream — its schemas never move — which is what lets the
 * skew scenario be REFUSED on a readable hello rather than discovered as a
 * decode failure three calls later.
 */
const control = implementSurface(padiControlSibling, {
  cells: {
    version: { store: inMemoryStore({ controlCoreVersion: CONTROL_CORE_VERSION }) },
  },
  procedures: {
    core: {
      hello: () =>
        Effect.succeed({
          stateRoot: "/tmp/fake-padi",
          surfaceVersion,
          controlCoreVersion: CONTROL_CORE_VERSION,
          startedAt: 1_700_000_000_000,
        }),
      drain: () => Effect.void,
      controlVersion: () => Effect.succeed({ controlCoreVersion: CONTROL_CORE_VERSION }),
      clockNow: () => Effect.succeed({ epochMs: 1_700_000_000_000 }),
    },
  },
})

/**
 * PADI'S OWN SURFACE — the members olai reads, and a floor under all the
 * rest.
 *
 * `implementSurface` walks the WHOLE spec and refuses a member with no deps, so
 * a fake that supplied only `terminals` and `screen.text` would not boot. It
 * would also be a fake that quietly stopped booting the day padi grew a member,
 * which is not the kind of breakage worth having: what these scenarios are
 * about is three, and every other one existing is padi's business.
 *
 * So the floor is DERIVED from the spec rather than listed. Each cell gets its
 * own declared default, each collection an empty map, each stream and event a
 * source that never emits, and each procedure a refusal. Then the members
 * that matter are written over the top. A padi that grows a tenth cell changes
 * nothing here; a padi that changes what `terminals` HOLDS breaks these
 * scenarios, which is exactly the sensitivity a fixture should have.
 */
const spec = padiSurfaceSibling.spec as {
  cells?: Record<string, { default: unknown }>
  collections?: Record<string, unknown>
  streams?: Record<string, unknown>
  events?: Record<string, unknown>
  procedures?: Record<string, Record<string, unknown>>
}

const floor = <T,>(keys: Iterable<string>, one: (key: string) => T): Record<string, T> =>
  Object.fromEntries([...keys].map((key) => [key, one(key)]))

/** Nothing to say, forever — what a stream this fixture does not serve does.
 *  `watchStates` is spelled ABOVE the floor ({@link watchStates}), because a
 *  subscriber there is answered with its leading frame — an empty one is the
 *  honest "nothing", and `Stream.never` is the one thing it is not. */
const silent = () => Stream.never

/** Nothing is asking of anyone — the partition a fixture that says nothing
 *  about attention gets. The same four empty lists padi's own cell defaults to. */
const EMPTY_URGENCY = {
  awaitingIds: [],
  finishedIds: [],
  workingIds: [],
  lingerIds: [],
}

const padi = implementSurface(padiSurfaceSibling, {
  cells: {
    ...floor(Object.keys(spec.cells ?? {}), (key) => ({
      store: inMemoryStore(spec.cells?.[key]?.default),
    })),
    // THE ATTENTION PARTITION, from the fixture. padi computes this on the host
    // and every kolu surface reads its ANSWER rather than re-deriving one from
    // the records — which means a scenario about a terminal that is blocked on
    // you cannot be written by giving a fixture record an `awaiting_user`
    // agent. It has to be written here, where padi would have said so, and
    // that is the fixture being a real far end rather than a mock: the wire
    // carries exactly the two facts the row is painted from.
    urgency: { store: inMemoryStore(fleet.urgency ?? EMPTY_URGENCY) },
  },
  collections: {
    ...floor(Object.keys(spec.collections ?? {}), () => ({
      readAll: () => new Map(),
      upsert: () => {},
      remove: () => {},
    })),
    // THE FLEET this scenario is about — a plain map, served as `readAll`,
    // which is what a mirror's subscription is snapshotted from. Nothing here
    // ever moves a row: a scenario that wanted one to change mid-test would
    // grow a verb, and none does yet.
    terminals: {
      readAll: () => new Map(Object.entries(fleet.terminals)),
      upsert: () => {},
      remove: () => {},
    },
  },
  streams: {
    ...floor(Object.keys(spec.streams ?? {}), () => ({ source: silent })),
    // THE AGENT-STATE WATCH — the member the doorbell's watcher subscribes
    // to, served by the static-fleet engine above ({@link watchStates}). The
    // floor's `silent` would have answered it with a stream that never says
    // anything, which is the fixture LYING where padi would answer a leading
    // frame — so this one is spelled.
    watchStates: { source: (input: WatchInput) => watchStates(input) },
    /**
     * THE LIVE ATTACH — one snapshot frame, then the stream holds open.
     *
     * A SNAPSHOT AND THEN SILENCE is the honest fixture for a pane: it is what
     * a real padi sends when a terminal is not currently emitting, which is
     * most terminals most of the time. Holding open rather than ending matters
     * — an ending stream is a re-attach under olai's own policy
     * (`web/src/client/props/attaching.ts`), so a fixture that ended would
     * drive a loop the scenario never asked for.
     *
     * The screen text is the SAME fixture the snapshot read used, so a scenario
     * asserting what is on screen is asserting about one recorded terminal
     * rather than two.
     */
    terminalAttach: {
      source: ({ id }: { readonly id: string }) => {
        const screen = fleet.screens[id]
        // NO LIVE MIRROR ENDS THE ATTACH AT ONCE. A dormant terminal has no
        // screen to serialize, and what a client sees is a stream that
        // finishes without a frame — which is rule 3's case (a clean end is not
        // an exit) driven to its honest conclusion: the pane re-attaches, gets
        // the same nothing, and spends its budget saying so.
        //
        // NOT `Stream.fail`. A failure here never reached the client at all —
        // the pane sat silent until its first-frame deadline, which is a
        // TWENTY-FOUR SECOND path a fifteen-second step cannot see. An ending
        // stream is both the truer fixture and the fast one.
        if (screen === undefined) return Stream.fail(new TerminalNotFound({ id }))
        return Stream.concat(
          Stream.make({
            kind: "snapshot" as const,
            data: screen,
            topLine: 0,
            // THE GRID THE SCREEN WAS SERIALIZED AT (kolu 5.5). A fixture that
            // omitted it would exercise only the older-padi arm, which is the
            // one a live board never takes.
            grid: { cols: 100, rows: 30 },
          }),
          Stream.never,
        )
      },
    },
  },
  events: floor(Object.keys(spec.events ?? {}), () => ({ source: silent })),
  procedures: {
    ...floor(
      Object.keys(spec.procedures ?? {}),
      (group) =>
        floor(Object.keys(spec.procedures?.[group] ?? {}), () => () =>
          Effect.fail(new Error("this fake padi does not serve that verb"))),
    ),
    // THE ONE VERB the door calls. A terminal with no screen in the fixture is
    // padi's `TerminalNotFound` — a dormant record has no live mirror to read —
    // and it is what the refusal scenario is about.
    screen: {
      state: () => Effect.fail(new TerminalNotFound({ id: "" })),
      history: () => Effect.fail(new TerminalNotFound({ id: "" })),
      image: () => Effect.fail(new TerminalNotFound({ id: "" })),
      text: ({ input }: { input: ScreenTextInput }) => {
        const screen = fleet.screens[input.id]
        // THE DECLARED error, not a plain one: padi's `screen.text` says it
        // fails with `TerminalNotFound`, and a fixture that failed with
        // something else would send a DEFECT down the wire — which the
        // consumer would experience as a call that never settles rather than
        // as the refusal it is meant to be testing.
        if (screen === undefined) return Effect.fail(new TerminalNotFound({ id: input.id }))
        return Effect.succeed(windowOf(screen, input))
      },
    },
  },
} as never)

const listener = await serveOverUnixSocket({
  socketPath,
  // THE WHOLE DAEMON GROUP, which is both siblings' tags composed — and it is
  // what a real padi binds. The control sibling's group alone answers the
  // handshake and then refuses `surface/padi/terminals/keys` as an unknown
  // tag, which is a mirror that dials, connects, and dies one frame later.
  group: padiDaemonGroup,
  handlers: { ...control.handlers, ...padi.handlers },
  log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as never,
})

if (listener.outcome.kind !== "listening") {
  console.error(`fake-padi: could not bind ${socketPath}: ${JSON.stringify(listener.outcome)}`)
  process.exit(1)
}

// The READINESS FACT, not a timer: whoever spawned this waits for the line.
process.stdout.write("listening\n")

const stop = (): void => {
  listener.close()
  void control.close()
  void padi.close()
  process.exit(0)
}
process.on("SIGTERM", stop)
process.on("SIGINT", stop)
