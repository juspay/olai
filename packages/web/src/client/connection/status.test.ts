/**
 * The LOOK, and only the LOOK.
 *
 * Which state is TRUE is the framework's now (kolu#2160 folds the transport
 * with the health fact and pins that fold in its own suite): a live socket
 * under a dead subscription reads `degraded`, a pending first frame does not,
 * and `needsReload` travels on the readout. Re-asserting any of that here
 * would be the walk this PR deleted coming back as an assertion.
 *
 * What is olai's is what a reader SEES, and this is where that is held: every
 * state has an appearance, no two of them share one, and the state a retry
 * cannot fix is drawn like neither of the states it can. Pure, so it needs
 * neither a socket nor a browser.
 */

import type { SurfaceReadout, SurfaceReadoutStatus } from "@kolu/surface-app/solid"
import { expect, test } from "bun:test"

import { lookOf, LOOK } from "./status.ts"

/** Every state, spelled out rather than derived from `LOOK`'s own keys — a
 *  table checked against itself checks nothing, and the point is that this list
 *  and the framework's union agree (the `Record` in `status.ts` is what makes a
 *  divergence a type error). */
const STATES: ReadonlyArray<SurfaceReadoutStatus> = [
  "connecting",
  "live",
  "degraded",
  "reconnecting",
  "retired",
]

/** One of each, as the framework hands it over — `degraded` carries the names
 *  that make its sentence, and nothing else carries any. */
const readoutOf = (status: SurfaceReadoutStatus): SurfaceReadout =>
  status === "degraded"
    ? { status, stopped: ["documents.keys"], needsReload: false }
    : { status, needsReload: status === "retired" }

// The bug this pill was built around, in one assertion: a tab the server closed
// at the handshake — the wire retired, never to dial again — must not be drawn
// as a healthy one, nor as the transient drop it was once projected as.
test("a retired wire is drawn as neither live nor merely reconnecting", () => {
  expect(LOOK.retired.dot).not.toBe(LOOK.live.dot)
  expect(LOOK.retired.label).not.toBe(LOOK.live.label)
  expect(LOOK.retired.label).not.toBe(LOOK.reconnecting.label)
})

test("only a live connection is drawn as one", () => {
  expect(LOOK.live.dot).toBe("bg-done")
  for (const state of STATES.filter((s) => s !== "live")) {
    const look = lookOf(readoutOf(state))
    expect(look.dot).not.toBe(LOOK.live.dot)
    expect(look.label).not.toBe(LOOK.live.label)
  }
})

test("every state says something, and says it differently", () => {
  const looks = STATES.map((state) => lookOf(readoutOf(state)))
  expect(new Set(looks.map((look) => look.label)).size).toBe(STATES.length)
  expect(new Set(looks.map((look) => look.detail)).size).toBe(STATES.length)
})

// What stopped is NAMED. "Something is not arriving" is the least useful true
// thing available, and a reader cannot act on it.
test("the degraded detail names what stopped", () => {
  expect(
    lookOf({
      status: "degraded",
      stopped: ["documents.keys", "transcript"],
      needsReload: false,
    }).detail,
  ).toContain("documents.keys, transcript")
})

// One door for all five. The table answers four and cannot answer the fifth —
// its detail names what stopped — so a caller that had to know which shape a
// state was in would be the split this collapses.
test("every state is drawn through one function", () => {
  for (const state of STATES.filter((s) => s !== "degraded")) {
    expect(lookOf(readoutOf(state))).toBe(LOOK[state as keyof typeof LOOK])
  }
})
