/**
 * The mapping is where this bug lived, so it is the part that is tested
 * directly: the state a retry cannot fix must not be drawn like the states it
 * can, and every state the wire can report must have an appearance. Pure, so
 * neither half needs a socket or a browser.
 */

import type { SurfaceHealth } from "@kolu/surface/solid"
import { expect, test } from "bun:test"

import {
  lookOf,
  LOOK,
  needsReload,
  readoutOf,
  type SurfaceConnectionStatus,
  unhealthy,
} from "./status.ts"

/** Every state the transport can report. Spelled out rather than derived from
 *  `LOOK`'s own keys — a table checked against itself checks nothing, and the
 *  point here is that this list and the framework's union agree (the `Record`
 *  below is what makes a divergence a type error). */
const STATES: ReadonlyArray<SurfaceConnectionStatus> = [
  "connecting",
  "live",
  "reconnecting",
  "retired",
]

// The whole bug in one assertion: a tab the server closed at the handshake —
// the wire retired, never to dial again — must not read as a healthy one, nor
// as the transient drop it was once projected as.
test("a retired wire is drawn as neither live nor merely reconnecting", () => {
  expect(LOOK.retired.dot).not.toBe(LOOK.live.dot)
  expect(LOOK.retired.label).not.toBe(LOOK.live.label)
  expect(LOOK.retired.label).not.toBe(LOOK.reconnecting.label)
  expect(needsReload("retired")).toBe(true)
})

test("only a live connection is drawn as one", () => {
  expect(LOOK.live.dot).toBe("bg-done")
  for (const state of STATES.filter((s) => s !== "live")) {
    expect(LOOK[state].dot).not.toBe(LOOK.live.dot)
    expect(LOOK[state].label).not.toBe(LOOK.live.label)
  }
})

test("a reload is offered for the state a retry cannot fix, and no other", () => {
  for (const state of STATES.filter((s) => s !== "retired")) {
    expect(needsReload(state)).toBe(false)
  }
})

test("every state says something, and says it differently", () => {
  const labels = new Set(STATES.map((state) => LOOK[state].label))
  const details = new Set(STATES.map((state) => LOOK[state].detail))
  expect(labels.size).toBe(STATES.length)
  expect(details.size).toBe(STATES.length)
})

// ── the state the transport cannot see ─────────────────────────────────
//
// A socket that is open and answering while a subscription over it is dead.
// The framework knows (`client.health()`); nothing in olai read it, and what
// that cost is a dead `documents.keys` rendering as a directory with no
// documents in it, under a green light claiming the files on disk reach this
// page as they change.

const fact = (subs: SurfaceHealth["subs"]): SurfaceHealth => ({ live: true, subs })
const sub = (name: string, error?: string) => ({
  name,
  pending: false,
  error: error === undefined ? undefined : new Error(error),
})

test("a live wire under a dead subscription is not drawn as live", () => {
  const stopped = unhealthy(fact([sub("outlines"), sub("documents.keys", "gone")]))
  expect(stopped).toEqual(["documents.keys"])
  expect(readoutOf("live", stopped)).toBe("degraded")
  expect(lookOf("live", stopped).dot).not.toBe(LOOK.live.dot)
  expect(lookOf("live", stopped).label).not.toBe(LOOK.live.label)
})

// What stopped is NAMED. "Something is not arriving" is the least useful true
// thing available, and a reader cannot act on it.
test("the degraded detail names what stopped", () => {
  expect(lookOf("live", ["documents.keys", "transcript"]).detail)
    .toContain("documents.keys, transcript")
})

// PENDING is not degraded, and that is a policy decision rather than an
// oversight: a first frame that has not arrived is what every page load looks
// like, and a pill that went amber for those would be amber most of the time.
test("a subscription still waiting for its first frame is not a fault", () => {
  const stopped = unhealthy(fact([{ name: "documents[a.md]", pending: true, error: undefined }]))
  expect(stopped).toEqual([])
  expect(readoutOf("live", stopped)).toBe("live")
})

// The other three already say something about the WIRE, and a subscription's
// error while the socket is down is a consequence rather than news.
test("only a live wire degrades; the other states speak for themselves", () => {
  for (const state of STATES.filter((s) => s !== "live")) {
    expect(readoutOf(state, ["documents.keys"])).toBe(state)
  }
})

// One door for all five. The table answers four and cannot answer the fifth —
// its detail names what stopped — so a caller that had to know which shape a
// state was in would be the split this collapses.
test("every state is drawn through one function", () => {
  for (const state of STATES) expect(lookOf(state, [])).toBe(LOOK[state])
})
