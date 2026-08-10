/**
 * The mapping is where this bug lived, so it is the part that is tested
 * directly: the state a retry cannot fix must not be drawn like the states it
 * can, and every state the wire can report must have an appearance. Pure, so
 * neither half needs a socket or a browser.
 */

import { expect, test } from "bun:test"

import { LOOK, needsReload, type SurfaceConnectionStatus } from "./status.ts"

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
