/**
 * ONE PREDICATE, TWO CONSEQUENCES — and the point of the test is that they are
 * the same one.
 *
 * `reachable` says whether a question can be sent, and `./Offline.tsx` freezes
 * the app under an overlay for exactly its `false` (§5b's ruling). A browser is
 * what shows the overlay; WHICH STATES it covers is a table, and a table
 * belongs in a unit test — the e2e suite re-asserting it through a real socket
 * would be the waste the e2e principle cuts.
 */

import { expect, test } from "bun:test"

import { reachable } from "./reaching.ts"
import type { SurfaceReadout, SurfaceReadoutStatus } from "./status.ts"

const readoutOf = (status: SurfaceReadoutStatus): SurfaceReadout =>
  status === "degraded"
    ? { status, stopped: ["documents.keys"], needsReload: false }
    : { status, needsReload: status === "retired" }

// The three the overlay covers, named one at a time rather than as "not live":
// each is a separate decision, and `connecting` is the one somebody would be
// tempted to let through because it is on the way to health rather than away
// from it. It is a dead wire like the others — there is nowhere to send a
// question — and §5b names it as one of the three the overlay draws its words
// from.
test("a wire that cannot carry a question freezes the app", () => {
  for (const status of ["connecting", "reconnecting", "retired"] as const) {
    expect(reachable(readoutOf(status))).toBe(false)
  }
})

// The line worth arguing, held so it cannot be lost to a tidy-up: a socket that
// is fine under a subscription that stopped still LANDS a procedure. Freezing
// the app for it would take the whole page away over a stream the pill already
// names — a half-alive page is what §5b forbids, and a frozen one over a live
// socket is the same lie the other way round.
test("a live socket carries a question, degraded or not", () => {
  expect(reachable(readoutOf("live"))).toBe(true)
  expect(reachable(readoutOf("degraded"))).toBe(true)
})
