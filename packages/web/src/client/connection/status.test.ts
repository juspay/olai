/**
 * The mapping is where this bug lived, so it is the part that is tested
 * directly: every lifecycle event the framework can report has to land on a
 * state, and the states a reader must not mistake for health have to not look
 * like it. Both halves are pure, so neither needs a socket or a browser.
 */

import type { ServerLifecycleEvent } from "@kolu/surface-app/solid"
import { expect, test } from "bun:test"

import { type Connection, connectionOf, LOOK, needsReload } from "./status.ts"

/** Every event the lifecycle can report, and what a reader should be told. The
 *  restarted pair is the point of the table: the same news arrives two
 *  physically different ways, and both are a page bound to a dead process. */
const EVENTS: ReadonlyArray<readonly [ServerLifecycleEvent, Connection]> = [
  [{ kind: "connecting" }, "connecting"],
  [{ kind: "connected", processId: "aa" }, "live"],
  [{ kind: "reconnected", processId: "aa" }, "live"],
  [{ kind: "disconnected" }, "lost"],
  [{ kind: "restarted", processId: "bb", transport: "open" }, "restarted"],
  [{ kind: "restarted", transport: "closed" }, "restarted"],
]

test("every lifecycle event lands on a state", () => {
  for (const [event, expected] of EVENTS) {
    expect(connectionOf(event)).toBe(expected)
  }
})

// The whole bug in one assertion: a tab the server closed at the handshake —
// the wire retired, never to dial again — must not read as a healthy one.
test("a retired wire is not a live connection", () => {
  const retired = connectionOf({ kind: "restarted", transport: "closed" })
  expect(retired).not.toBe("live")
  expect(LOOK[retired]).not.toEqual(LOOK.live)
  expect(needsReload(retired)).toBe(true)
})

test("a reconnect that landed on a different process is a restart too", () => {
  // The socket is OPEN here, which is exactly why the transport alone cannot
  // answer this: the page is talking to a server, just not the one it came from.
  const restarted = connectionOf({
    kind: "restarted",
    processId: "bb",
    transport: "open",
  })
  expect(restarted).toBe("restarted")
  expect(needsReload(restarted)).toBe(true)
})

test("only a live connection is drawn as one", () => {
  expect(LOOK.live.dot).toBe("bg-done")
  for (const state of ["connecting", "lost", "restarted"] as const) {
    expect(LOOK[state].dot).not.toBe(LOOK.live.dot)
    expect(LOOK[state].label).not.toBe(LOOK.live.label)
  }
})

test("a reload is offered for the state a retry cannot fix, and no other", () => {
  expect(needsReload("restarted")).toBe(true)
  for (const state of ["connecting", "live", "lost"] as const) {
    expect(needsReload(state)).toBe(false)
  }
})

test("every state says something, and says it differently", () => {
  const labels = new Set(Object.values(LOOK).map((look) => look.label))
  const details = new Set(Object.values(LOOK).map((look) => look.detail))
  expect(labels.size).toBe(Object.keys(LOOK).length)
  expect(details.size).toBe(Object.keys(LOOK).length)
})
