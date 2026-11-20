import { expect, test } from "bun:test"
import type { Forecast, NodeAgentRow } from "../../wire.ts"

import { nodeAgentOf, saidOf, sleepWords } from "./sleeping.ts"

const row = (over: Partial<NodeAgentRow> = {}): NodeAgentRow => ({
  id: "install",
  kind: "node",
  beside: false,
  file: "house.olai",
  title: "install the cabinets",
  engine: "one-engine",
  session: "sess-1",
  memory: 3,
  standing: "asleep",
  waiting: 0,
  said: null,
  seen: null,
  sleeps: false,
  sleep: null,
  ...over,
})

test("a node agent's conversation finds its row, and a plain chat finds none", () => {
  expect(nodeAgentOf([row()], { agent: "one-engine", session: "sess-1" })?.id).toBe("install")
  expect(nodeAgentOf([row()], { agent: "another-engine", session: "sess-1" })).toBeUndefined()
  expect(nodeAgentOf([row()], { agent: "one-engine", session: "sess-2" })).toBeUndefined()
  expect(nodeAgentOf([row()], undefined)).toBeUndefined()
  expect(nodeAgentOf([], { agent: "one-engine", session: "sess-1" })).toBeUndefined()
})

test("a note's chat is never a sleep row, however it is seated", () => {
  const note = row({ kind: "note", id: "/notes/plan.md", file: "notes/plan.md", title: "plan", memory: 0 })
  expect(nodeAgentOf([note], { agent: "one-engine", session: "sess-1" })).toBeUndefined()
  expect(nodeAgentOf([note, row()], { agent: "one-engine", session: "sess-1" })?.id).toBe("install")
})

test("the switch says which way the mark is, in the two words a person reads", () => {
  expect(sleepWords(nodeAgentOf([row()], { agent: "one-engine", session: "sess-1" })!.sleeps)).toBe("Off")
  expect(sleepWords(nodeAgentOf([row({ sleeps: true })], { agent: "one-engine", session: "sess-1" })!.sleeps)).toBe("On")
})

const NOW = Date.parse("2026-10-12T09:00:00Z")
const HOUR = 3_600_000

const forecast = (next: Forecast["next"], over: Partial<Forecast> = {}): Forecast => ({
  lastSlept: new Date(NOW - 3 * HOUR).toISOString(),
  after: 6 * HOUR,
  floor: 5,
  latest: 7 * 24 * HOUR,
  next,
  ...over,
})

test("the item says when it last slept, when it will next, and on what rhythm", () => {
  const off = saidOf(null, NOW)
  expect([off.kind, off.switch, off.said]).toEqual(["off", false, []])
  expect(off.title).toContain("sleep is off in _olai/Settings.olai")

  expect(saidOf(forecast({ kind: "unmarked" }), NOW)).toMatchObject({ switch: true, said: ["last 3h ago"] })
  expect(saidOf(forecast({ kind: "unmarked" }, { lastSlept: null }), NOW).said).toEqual([])

  expect(saidOf(forecast({ kind: "unbound" }), NOW)).toMatchObject({ switch: true, said: ["no conversation yet"] })

  expect(saidOf(forecast({ kind: "unchanged" }), NOW).said).toEqual(["last 3h ago", "nothing new to tidy"])
  expect(saidOf(forecast({ kind: "little", rows: 2 }), NOW).said).toEqual(["last 3h ago", "too little to tidy · 2 of 5 rows"])
  expect(saidOf(forecast({ kind: "busy" }), NOW).said).toEqual(["last 3h ago", "when this chat is quiet"])

  expect(saidOf(forecast({ kind: "running" }), NOW).said).toEqual(["last 3h ago", "tidying now"])

  expect(saidOf(forecast({ kind: "due", at: new Date(NOW + 4 * HOUR).toISOString(), rows: 6 }), NOW).said)
    .toEqual(["last 3h ago", "next in 4h if left alone"])
  expect(saidOf(forecast({ kind: "due", at: new Date(NOW).toISOString(), rows: 6 }), NOW).said)
    .toEqual(["last 3h ago", "due now"])
  expect(saidOf(forecast({ kind: "due", at: new Date(NOW + 4 * HOUR).toISOString(), rows: 6 }, { lastSlept: null }), NOW).said)
    .toEqual(["never", "next in 4h if left alone"])

  const skipped = saidOf(forecast({ kind: "skipped", until: new Date(NOW + HOUR).toISOString() }), NOW)
  expect(skipped.said[0]).toBe("last pass failed")
  expect(skipped.said[1]).toMatch(/^not before \d{2}:\d{2}$/)

  expect(saidOf(forecast({ kind: "unchanged" }), NOW).title)
    .toBe("olai tidies this chat’s memory after 6 h alone, once 5 rows have moved since the last pass or any moved row has waited 7 d (sleep-after, sleep-floor, sleep-latest in _olai/Settings.olai)")
})
