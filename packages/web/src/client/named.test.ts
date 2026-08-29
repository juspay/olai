/**
 * The seam `followName` actually changed: whether this tab sends `app.get`,
 * and what one landing writes.
 *
 * A table, not an effect — bun's default Solid resolution never re-runs
 * one, and the interesting cases are the states of the wire, which
 * `shouldAsk` already folds. The case that would have been a reconnect
 * reset is here: `retired` is not an open, so a restart does not land a
 * second start on this page (`./connection/reaching.ts`).
 */

import { expect, test } from "bun:test"

import type { SurfaceReadout, SurfaceReadoutStatus } from "./connection/status.ts"
import { landingOf, shouldAsk } from "./named.ts"

const STARTED = "2026-08-29T09:31:00.000Z"

const readoutOf = (status: SurfaceReadoutStatus): SurfaceReadout =>
  status === "degraded"
    ? { status, stopped: ["documents.keys"], needsReload: false }
    : { status, needsReload: status === "retired" }

test("a live wire with no landing yet is an ask", () => {
  expect(shouldAsk(readoutOf("live"), undefined, false)).toBe(true)
  expect(shouldAsk(readoutOf("degraded"), undefined, false)).toBe(true)
})

test("a failed ask is not a settled one — in-flight is the only hold", () => {
  expect(shouldAsk(readoutOf("live"), undefined, true)).toBe(false)
  expect(shouldAsk(readoutOf("live"), undefined, false)).toBe(true)
})

test("a retired wire never asks — a restart does not land a second start on this page", () => {
  expect(shouldAsk(readoutOf("retired"), undefined, false)).toBe(false)
  expect(shouldAsk(readoutOf("connecting"), undefined, false)).toBe(false)
  expect(shouldAsk(readoutOf("reconnecting"), undefined, false)).toBe(false)
})

test("after a landing, live again or retired does not re-ask", () => {
  const landed = "olai [desk]"
  expect(shouldAsk(readoutOf("live"), landed, false)).toBe(false)
  expect(shouldAsk(readoutOf("degraded"), landed, false)).toBe(false)
  expect(shouldAsk(readoutOf("retired"), landed, false)).toBe(false)
})

test("one landing writes the name and the start together", () => {
  expect(landingOf({ hostname: "desk", startedAt: STARTED })).toEqual({
    called: "olai [desk]",
    startedAt: STARTED,
  })
})
