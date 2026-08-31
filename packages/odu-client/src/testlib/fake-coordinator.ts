#!/usr/bin/env bun
/**
 * A COORDINATOR THAT IS NOT ODU — the run a chip draws, standing on a real
 * unix socket, so a face can be photographed without a CI run on the machine.
 *
 * `@olai/kolu-client`'s `fake-padi.ts` one appliance over, and deliberately the
 * same shape — including WHICH PACKAGE it sits in. This is `@olai/odu-client`
 * and not `@olai/plugin-odu` because it imports `@odu/run-client`, and that
 * specifier is confined to this package by a fence with no exceptions. A
 * fixture is not an exemption: the fake serves odu's own surface, so it
 * genuinely IS a thing that knows odu exists, and it belongs behind the same
 * wall the dial does. fake-padi sits in `kolu-client` rather than `kolu-ui`
 * for exactly this reason.
 *
 * The shape: it serves the REAL surface (`@odu/run-client`'s own `oduSurface`)
 * over the REAL `serveOverUnixSocket`, at the path odu itself binds
 * (`<checkout>/.ci/odu.sock`). Nothing about the dial is faked — what is faked
 * is only WHO IS BEHIND IT.
 *
 * ## Why this exists at all, when the dial is already injectable
 *
 * `@olai/odu-client`'s `DialRun` is injectable and the unit tests hand it a
 * function; that is the right seam for a test and the wrong one for EVIDENCE.
 * A screenshot has to be of the packaged path — the real `olai web`, dialling a
 * real socket with a real `connect(2)`, projecting through the real
 * `project.ts` — or it is a photograph of a mock, and the one thing a person
 * looks at evidence to learn is that the product works.
 *
 * So the injectable stays what a unit test spends, and this is what a serve
 * meets. The two do not overlap: nothing here is imported by the suite.
 *
 * ## What it serves, and what it declines to
 *
 * `nodes` and `header` — the two cells `runs.ts` follows, and the whole of what
 * a chip and a matrix draw. `nodeLog` is declared by the surface and is NOT
 * offered anything to say: no olai face reads it (`@olai/odu-client`'s README
 * says why the log is not on the wire), so a fixture for it would be a shape
 * with no reader. The procedures answer `{ok:false}` rather than being absent,
 * because a run that refuses a rerun is a state odu has and a run with no
 * `rerun` verb is not one.
 *
 * The state is STATIC. A run that advanced on a timer would make every
 * screenshot a different screenshot, and what evidence has to be is the same
 * picture twice.
 *
 * Usage: `fake-coordinator.ts <socket-path>` — prints `listening` on stdout
 * when it is bound, which is the READINESS FACT whoever spawned it waits for
 * rather than a timer.
 */

import { chmodSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

import { oduSurface } from "@odu/run-client/surface"
import { implementSurface, inMemoryStore } from "@kolu/surface/server"
import { serveOverUnixSocket } from "@kolu/surface/unix-socket"
import { Effect, Stream } from "effect"

const socketPath = process.argv[2]
if (socketPath === undefined) {
  console.error("fake-coordinator: usage: fake-coordinator.ts <socket-path>")
  process.exit(1)
}

/** One RUNNING node and three settled ones — a run mid-flight, which is the
 *  only state that draws every part of the face at once: the chip's live
 *  duration ticks off `startedAt`, the tally counts what has settled, and the
 *  matrix has a red cell to colour. A run that had finished would draw a
 *  verdict and no clock; one that had not started would draw nothing. */
const STARTED = 1756557600000

const nodes = {
  name: "check",
  sha7: "1f67aff",
  dirty: false,
  seq: 1,
  order: ["typecheck@linux", "test@linux", "e2e@linux", "nix@linux"],
  nodes: {
    "typecheck@linux": {
      id: "typecheck@linux",
      name: "typecheck",
      command: "just typecheck",
      needs: [],
      status: "ok",
      exitCode: 0,
      startedAt: STARTED,
      durationMs: 41_000,
    },
    "test@linux": {
      id: "test@linux",
      name: "test",
      command: "just test",
      needs: ["typecheck@linux"],
      status: "ok",
      exitCode: 0,
      startedAt: STARTED + 41_000,
      durationMs: 79_000,
    },
    "e2e@linux": {
      id: "e2e@linux",
      name: "e2e",
      command: "just e2e",
      needs: ["typecheck@linux"],
      status: "running",
      exitCode: null,
      startedAt: STARTED + 41_000,
      durationMs: null,
    },
    "nix@linux": {
      id: "nix@linux",
      name: "nix",
      command: "just nix",
      needs: [],
      status: "failed",
      exitCode: 1,
      startedAt: STARTED,
      durationMs: 12_000,
    },
  },
} as const

const header = {
  commitUrl: null,
  lanes: [{ state: "leased", platform: "linux", host: "this-host" }],
  hostsSource: "hosts.json",
  startedAt: STARTED,
} as const

// The socket's own directory is odu's convention (`.ci/`), and a coordinator
// that could not make it would be a coordinator that never bound — so this is
// the same `mkdir -p` odu does rather than a precondition on the caller.
//
// 0700, and the chmod is SEPARATE from the mkdir because a directory that
// already existed keeps the mode it had. `serveOverUnixSocket` refuses to bind
// under a directory anyone else can enter (`dir-not-private`) — a unix socket's
// only access control is the path to it, so the framework checks the path
// rather than trusting the caller. Refused rather than warned, which is right,
// and is why this line is not optional tidiness.
const dir = dirname(socketPath)
mkdirSync(dir, { recursive: true, mode: 0o700 })
chmodSync(dir, 0o700)

// `implementSurface` walks the WHOLE spec and refuses a member with no deps, so
// every declared member is answered here even where olai reads none of it —
// the cast is fake-padi's, for fake-padi's reason: this is a fixture standing
// in a spec's shape, not a second implementation of odu.
const run = implementSurface(oduSurface, {
  cells: {
    nodes: { store: inMemoryStore(nodes) },
    header: { store: inMemoryStore(header) },
  },
  streams: {
    // Offered and empty: the member exists on odu's surface and no olai face
    // reads it. A stream that never emits is the honest answer for a log
    // nobody asked for; refusing would be a different claim. `source` is the
    // shape `implementSurface` takes for a stream that produces on its own.
    nodeLog: { source: () => Stream.empty },
  },
  procedures: {
    node: {
      rerun: () => Effect.succeed({ ok: false }),
      cancel: () => Effect.succeed({ ok: false }),
    },
    run: { cancel: () => Effect.succeed({ ok: false }) },
    lane: { cancel: () => Effect.succeed({ ok: false }) },
  },
} as never)

const listener = await serveOverUnixSocket({
  socketPath,
  group: oduSurface.group,
  handlers: run.handlers,
  log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as never,
})

if (listener.outcome.kind !== "listening") {
  console.error(
    `fake-coordinator: could not bind ${socketPath}: ${JSON.stringify(listener.outcome)}`,
  )
  process.exit(1)
}

process.stdout.write("listening\n")

const stop = (): void => {
  listener.close()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
