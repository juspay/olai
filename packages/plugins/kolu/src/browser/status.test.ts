/**
 * THE PADI READOUT AS THE HEALTH DOT READS IT — every arm of `padiStatus`.
 *
 * The dot wears the worst tone standing in the bar, so which tone each link
 * state maps to is the whole of kolu's say in it: a skew is broken, a watcher
 * gone quiet wants attention, no padi at all is nothing wrong. The label and
 * sentence are the row's own (`padiSaid`), so the dot's name and the row
 * cannot disagree.
 */

import { expect, mock, test } from "bun:test"

import type { KoluLink, WatchPulse } from "olai-plugin-kolu/appliance/wire"

import { padiSaid } from "../appliance/padi/said.ts"

// `./status.ts` reaches `padiSaid` through the appliance's one door
// (`../appliance/index.ts`), which also re-exports the terminal door's Solid
// components and their vendored `@kolu/*` UI. None of that is under test here,
// and a unit test should not have to load a browser's worth of UI to check a
// tone table — so the door is stood in for with the one export `status.ts`
// reads, the real `padiSaid`, before `status.ts` is loaded.
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

/** The three accessors the status reads, fixed at one instant. */
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
  // A stale pulse from before the link died must not turn quiet into notice.
  const status = padiStatus(fleet(absent, pulse(47 * 60_000, 60_000)))
  expect(status.tone).toBe("quiet")
  expect(status.label).toBe("No kolu")
  expect(status.detail).toBe("kolu isn't running at /tmp/padi.sock")
  // ...and an olai watching no socket at all says so rather than naming a blank.
  expect(padiStatus(fleet({ ...absent, socket: "" })).detail).toBe("kolu isn't set up")
})
