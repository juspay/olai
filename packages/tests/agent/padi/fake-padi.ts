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
 * grown one member: it serves the CONTROL sibling AND `terminals` and
 * `screen.text`, which is exactly the slice olai reads.
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
import { CONTROL_CORE_VERSION } from "@kolu/surface-daemon"
import {
  PADI_SURFACE_VERSION,
  padiControlSibling,
  padiDaemonGroup,
  padiSurfaceSibling,
  TerminalNotFound,
} from "@kolu/padi-client/surface"
import { Effect, Stream } from "effect"

/** What the fixture hands over: the terminals, and what each one's screen
 *  says. Two maps rather than one record with the screen on it, because padi's
 *  own record does not carry a screen — a snapshot is a VERB there, and a
 *  fixture that put the text on the record would be modelling a padi that does
 *  not exist. */
interface Fleet {
  readonly terminals: Record<string, unknown>
  readonly screens: Record<string, string>
  /** What this padi claims its surface version is. Absent means "the one this
   *  build speaks" — the ordinary case; a scenario about SKEW sets it. */
  readonly surfaceVersion?: string
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
 * PADI'S OWN SURFACE — the two members olai reads, and a floor under all the
 * rest.
 *
 * `implementSurface` walks the WHOLE spec and refuses a member with no deps, so
 * a fake that supplied only `terminals` and `screen.text` would not boot. It
 * would also be a fake that quietly stopped booting the day padi grew a member,
 * which is not the kind of breakage worth having: what these scenarios are
 * about is two members, and every other one existing is padi's business.
 *
 * So the floor is DERIVED from the spec rather than listed. Each cell gets its
 * own declared default, each collection an empty map, each stream and event a
 * source that never emits, and each procedure a refusal. Then the two members
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
 *  Not an error: a subscriber to `watchStates` here is not wrong, there is
 *  simply nothing happening. */
const silent = () => Stream.never

const padi = implementSurface(padiSurfaceSibling, {
  cells: floor(Object.keys(spec.cells ?? {}), (key) => ({
    store: inMemoryStore(spec.cells?.[key]?.default),
  })),
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
  streams: floor(Object.keys(spec.streams ?? {}), () => ({ source: silent })),
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
      text: ({ input }: { input: { id: string } }) => {
        const screen = fleet.screens[input.id]
        // THE DECLARED error, not a plain one: padi's `screen.text` says it
        // fails with `TerminalNotFound`, and a fixture that failed with
        // something else would send a DEFECT down the wire — which the
        // consumer would experience as a call that never settles rather than
        // as the refusal it is meant to be testing.
        return screen === undefined
          ? Effect.fail(new TerminalNotFound({ id: input.id }))
          : Effect.succeed(screen)
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
