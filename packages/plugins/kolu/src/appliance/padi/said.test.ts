import { expect, test } from "bun:test"

import type { KoluLink, WatchPulse } from "olai-plugin-kolu/appliance/wire"

import { beatOf, padiSaid } from "./said.ts"

const T0 = 1_700_000_000_000

const connectedLink: KoluLink = {
  status: "connected",
  socket: "/tmp/padi.sock",
  told: true,
  stateRoot: "",
  surfaceVersion: "v10",
  speaks: "v10",
  since: new Date(T0 - 86_400).toISOString(),
}

const pulse = (ageMs: number, everyMs: number): WatchPulse => ({
  at: new Date(T0 - ageMs).toISOString(),
  everyMs,
})

test("the beat speaks plainly while it is fresh — the inspection sentence", () => {
  const said = padiSaid(connectedLink, pulse(120_000, 60_000), T0)
  expect(said.beat?.kind).toBe("fresh")
  expect(said.beat?.said).toBe("Checked in 2m ago")
  expect(said.detail).toBe("Connected · Checked in 2m ago")
  expect(said.label).toBe("kolu")
  expect(said.tone).toBe("healthy")
})

test("the register crosses at `everyMs * 2`, the pill's house margin", () => {
  const half = pulse(60_000, 30_000)
  const over = pulse(120_001, 30_000)
  expect(beatOf(half, T0).kind).toBe("fresh")
  expect(beatOf(over, T0).kind).toBe("quiet")
  expect(beatOf(half, T0).said).toBe("Checked in 1m ago")
  expect(beatOf(over, T0).said).toBe("No check-in for 2m")
})

test("the quiet register is loud enough to name the piece that went down", () => {
  const said = padiSaid(connectedLink, pulse(47 * 60_000, 60_000), T0)
  expect(said.beat?.kind).toBe("quiet")
  expect(said.beat?.said).toBe("No check-in for 47m")
  expect(said.tone).toBe("notice")
  expect(said.detail).toBe("Connected · No check-in for 47m")
})

test("a fresh link that never stamped is not a quiet one — the pre-beat face", () => {
  const said = padiSaid(connectedLink, null, T0)
  expect(said.beat).toBeNull()
  expect(said.detail).toBe("Connected. Terminals on this page are live.")
})

test("the beat says nothing once the link has failed — the fault is the link's", () => {
  const absent: KoluLink = { ...connectedLink, status: "absent" }
  const said = padiSaid(absent, pulse(5_000, 30_000), T0)
  expect(said.beat).toBeNull()
  expect(said.tone).toBe("quiet")
  expect(padiSaid({ ...connectedLink, status: "skew" }).tone).toBe("alarm")
})
