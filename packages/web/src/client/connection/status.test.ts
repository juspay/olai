import { expect, test } from "bun:test"

import { frozenLookOf, isFrozen, lookOf, LOOK, type SurfaceReadout, type SurfaceReadoutStatus } from "./status.ts"

const TABLED = Object.keys(LOOK) as ReadonlyArray<keyof typeof LOOK>

const STATES: ReadonlyArray<SurfaceReadoutStatus> = [...TABLED, "degraded"]

const readoutOf = (status: SurfaceReadoutStatus, presentingDown = false): SurfaceReadout =>
  status === "degraded"
    ? { status, stopped: ["documents.keys"], needsReload: false, presentingDown: false }
    : { status, needsReload: false, presentingDown }

test("a retired wire is drawn as neither live nor merely reconnecting", () => {
  expect(LOOK.retired.tone).not.toBe(LOOK.live.tone)
  expect(LOOK.retired.label).not.toBe(LOOK.live.label)
  expect(LOOK.retired.label).not.toBe(LOOK.reconnecting.label)
})

test("only a live connection is drawn as one", () => {
  for (const state of STATES.filter((s) => s !== "live")) {
    const look = lookOf(readoutOf(state))
    expect(look.tone).not.toBe(LOOK.live.tone)
    expect(look.label).not.toBe(LOOK.live.label)
  }
})

test("every state has its one tone", () => {
  expect(Object.fromEntries(STATES.map((state) => [state, lookOf(readoutOf(state)).tone]))).toEqual({
    connecting: "quiet",
    live: "healthy",
    reconnecting: "notice",
    retired: "alarm",
    degraded: "notice",
  })
})

test("every state says something, and says it differently", () => {
  const looks = STATES.map((state) => lookOf(readoutOf(state)))
  expect(new Set(looks.map((look) => look.label)).size).toBe(STATES.length)
  expect(new Set(looks.map((look) => look.detail)).size).toBe(STATES.length)
})

test("the degraded detail names what stopped", () => {
  expect(
    lookOf({
      status: "degraded",
      stopped: ["documents.keys", "transcript"],
      needsReload: false,
      presentingDown: false,
    }).detail,
  ).toContain("documents.keys, transcript")
})

test("the degraded detail names plugin rows, not raw stream ids", () => {
  const look = lookOf({
    status: "degraded",
    stopped: ["git/git", "git/pending", "kolu/git"],
    needsReload: false,
    presentingDown: false,
  })
  expect(look.detail).toContain("(git, kolu)")
  expect(look.detail).not.toContain("git/pending")
  expect(lookOf({
    status: "degraded",
    stopped: ["git/git", "git/pending"],
    needsReload: false,
    presentingDown: false,
  }).detail).toContain("(git)")
})

test("every state is drawn through one function", () => {
  for (const state of TABLED) expect(lookOf(readoutOf(state))).toBe(LOOK[state])
})

test("the connection's words are plain", () => {
  expect(LOOK.live.label).toBe("Connected")
  expect(LOOK.connecting.label).toBe("Connecting…")
  expect(LOOK.reconnecting.label).toBe("Reconnecting…")
  expect(LOOK.retired.label).toBe("The server restarted")
})

test("the freeze card says what happened, then what is being done", () => {
  expect(frozenLookOf({ status: "reconnecting", needsReload: false, presentingDown: true }))
    .toEqual({ title: "Connection lost", line: "Reconnecting…" })
  expect(frozenLookOf({ status: "connecting", needsReload: false, presentingDown: false })).toEqual({ title: "Connecting…" })
  expect(frozenLookOf({ status: "retired", needsReload: true, presentingDown: true }))
    .toEqual({ title: "The server restarted", line: "Reload the page to keep working." })
})

test("the dot's tone: live is healthy, a first connect is quiet, only a replaced server is an alarm", () => {
  expect(lookOf(readoutOf("live")).tone).toBe("healthy")
  expect(lookOf(readoutOf("connecting")).tone).toBe("quiet")
  expect(lookOf(readoutOf("retired")).tone).toBe("alarm")
  for (const state of STATES.filter((s) => s !== "live" && s !== "connecting" && s !== "retired")) {
    expect(lookOf(readoutOf(state)).tone).toBe("notice")
  }
})

test("the freeze waits for the readout's presenting bit, not a local state list", () => {
  expect(isFrozen(readoutOf("reconnecting"), false)).toBe(false)
  expect(isFrozen(readoutOf("connecting"), false)).toBe(false)
  expect(isFrozen(readoutOf("reconnecting", true), false)).toBe(true)
  expect(isFrozen(readoutOf("retired", true), false)).toBe(true)
  expect(isFrozen(readoutOf("live"), true)).toBe(false)
  expect(isFrozen(readoutOf("degraded"), true)).toBe(false)
})

test("a roster change this page asked for freezes at once, and only while down", () => {
  expect(isFrozen(readoutOf("reconnecting"), true)).toBe(true)
  expect(isFrozen(readoutOf("connecting"), true)).toBe(true)
  expect(isFrozen(readoutOf("live"), true)).toBe(false)
})
