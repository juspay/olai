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

import { expect, test } from "bun:test"

import { lookOf, LOOK, type SurfaceReadout, type SurfaceReadoutStatus } from "./status.ts"

/** The states the table answers for, DERIVED from it — which is not a table
 *  checked against itself, because membership is already a type-level
 *  guarantee (`status.ts`'s `Record` over the framework's union). What is
 *  checked below is the VALUES: that no two states look alike. A hand-spelled
 *  list would let a sixth state force a table row and then quietly escape every
 *  sweep here, which is the half of the promise a type cannot make. */
const TABLED = Object.keys(LOOK) as ReadonlyArray<keyof typeof LOOK>

/** All five: the table's, plus the one whose look is written rather than
 *  stored. */
const STATES: ReadonlyArray<SurfaceReadoutStatus> = [...TABLED, "degraded"]

/** One of each, as the framework hands it over — `degraded` carries the names
 *  that make its sentence, and nothing else carries any.
 *
 *  `needsReload` is fixed rather than derived: which states are terminal is the
 *  readout's rule and pinned upstream, nothing here reads the bit (it is
 *  `Offline.tsx`'s, which draws the reload offer on the freeze it is true
 *  under), and re-deriving it in a fixture would be that rule
 *  living on as a second copy in a file about wording. */
const readoutOf = (status: SurfaceReadoutStatus): SurfaceReadout =>
  status === "degraded"
    ? { status, stopped: ["documents.keys"], needsReload: false }
    : { status, needsReload: false }

// The bug this pill was built around, in one assertion: a tab the server closed
// at the handshake — the wire retired, never to dial again — must not be drawn
// as a healthy one, nor as the transient drop it was once projected as.
test("a retired wire is drawn as neither live nor merely reconnecting", () => {
  expect(LOOK.retired.dot).not.toBe(LOOK.live.dot)
  expect(LOOK.retired.label).not.toBe(LOOK.live.label)
  expect(LOOK.retired.label).not.toBe(LOOK.reconnecting.label)
})

test("only a live connection is drawn as one", () => {
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
  for (const state of TABLED) expect(lookOf(readoutOf(state))).toBe(LOOK[state])
})
