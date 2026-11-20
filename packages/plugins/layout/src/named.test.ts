import { expect, test } from "bun:test"

import type { SurfaceReadout, SurfaceReadoutStatus } from "@olai/web/client/connection/status.ts"
import { ASKING, landingOf, shouldAsk, WAITING } from "./named.ts"

const STARTED = "2026-08-29T09:31:00.000Z"

const readoutOf = (status: SurfaceReadoutStatus): SurfaceReadout =>
  status === "degraded"
    ? { status, stopped: ["documents.keys"], needsReload: false, presentingDown: false }
    : { status, needsReload: status === "retired", presentingDown: false }

test("a live wire with no landing yet is an ask", () => {
  expect(shouldAsk(readoutOf("live"), WAITING)).toBe(true)
  expect(shouldAsk(readoutOf("degraded"), WAITING)).toBe(true)
})

test("a failed ask is not a settled one — in-flight is the only hold", () => {
  expect(shouldAsk(readoutOf("live"), ASKING)).toBe(false)
  expect(shouldAsk(readoutOf("live"), WAITING)).toBe(true)
})

test("a retired wire never asks — a restart does not land a second start on this page", () => {
  expect(shouldAsk(readoutOf("retired"), WAITING)).toBe(false)
  expect(shouldAsk(readoutOf("connecting"), WAITING)).toBe(false)
  expect(shouldAsk(readoutOf("reconnecting"), WAITING)).toBe(false)
})

test("after a landing, live again or retired does not re-ask", () => {
  const landed = landingOf({ hostname: "desk", startedAt: STARTED })
  expect(shouldAsk(readoutOf("live"), landed)).toBe(false)
  expect(shouldAsk(readoutOf("degraded"), landed)).toBe(false)
  expect(shouldAsk(readoutOf("retired"), landed)).toBe(false)
})

test("one landing writes the name and the start together", () => {
  expect(landingOf({ hostname: "desk", startedAt: STARTED })).toEqual({
    phase: "landed",
    called: "olai [desk]",
    startedAt: STARTED,
  })
})
