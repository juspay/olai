import { expect, mock, test } from "bun:test"

import { padiSaid } from "../appliance/padi/said.ts"

type KoluLink = Parameters<typeof padiSaid>[0]
type WatchPulse = NonNullable<Parameters<typeof padiSaid>[1]>

mock.module(new URL("../appliance/index.ts", import.meta.url).pathname, () => ({ padiSaid }))
const { padiStatus } = await import("./status.ts")

const T0 = 1_700_000_000_000

const connected: KoluLink = {
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

const fleet = (link: KoluLink, beat: WatchPulse | null = null) => ({
  link: () => link,
  pulse: () => beat,
  now: () => T0,
})

test("a connected padi with no beat yet is healthy, in the row's own words", () => {
  expect(padiStatus(fleet(connected))).toEqual({
    tone: "healthy",
    label: "kolu",
    detail: "Connected. Terminals on this page are live.",
  })
})

test("a fresh beat stays healthy, and the label does not grow", () => {
  const status = padiStatus(fleet(connected, pulse(120_000, 60_000)))
  expect(status.tone).toBe("healthy")
  expect(status.label).toBe("kolu")
  expect(status.detail).toBe("Connected · Checked in 2m ago")
})

test("a watcher gone quiet is a notice, and the dot's name says how long", () => {
  const status = padiStatus(fleet(connected, pulse(47 * 60_000, 60_000)))
  expect(status.tone).toBe("notice")
  expect(status.label).toBe("kolu · No check-in for 47m")
  expect(status.detail).toBe("Connected · No check-in for 47m")
})

test("a version skew is an alarm naming both versions", () => {
  const status = padiStatus(fleet({ ...connected, status: "skew", surfaceVersion: "v9" }))
  expect(status.tone).toBe("alarm")
  expect(status.label).toBe("kolu: update needed")
  expect(status.detail).toContain("padi v9, olai v10")
})

test("no padi at all is quiet: it never colours the dot, whatever the old pulse said", () => {
  const absent: KoluLink = { ...connected, status: "absent", told: false }
  const status = padiStatus(fleet(absent, pulse(47 * 60_000, 60_000)))
  expect(status.tone).toBe("quiet")
  expect(status.label).toBe("No kolu")
  expect(status.detail).toBe("kolu isn't running at /tmp/padi.sock")
  expect(padiStatus(fleet({ ...absent, socket: "" })).detail).toBe("kolu isn't set up")
})
