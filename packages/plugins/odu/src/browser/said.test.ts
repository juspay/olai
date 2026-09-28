import { expect, test } from "bun:test"

import type { OduLink } from "olai-plugin-odu/appliance/wire"

import { oduSaid, oduStatus } from "./said.ts"

const link = (over: Partial<OduLink>): OduLink => ({
  status: "absent",
  origin: "http://127.0.0.1:18440",
  protocolVersion: null,
  speaks: "1.3",
  since: "2026-09-12T00:00:00.000Z",
  ...over,
})

test("connected is the quiet face", () => {
  const said = oduSaid(link({ status: "connected", protocolVersion: "1.3" }))
  expect(said.label).toBe("odu")
  expect(said.detail).toBe("Connected to http://127.0.0.1:18440")
})

test("absent names the origin and the fix", () => {
  const said = oduSaid(link({ status: "absent" }))
  expect(said.label).toBe("No odu")
  expect(said.detail).toContain("http://127.0.0.1:18440")
  expect(said.detail).toContain("odu web --background")
})

test("an olai watching no odu at all says so rather than naming a blank origin", () => {
  expect(oduSaid(link({ status: "absent", origin: "" })).detail).toBe("odu isn't set up")
})

test("skew names both versions", () => {
  const said = oduSaid(link({ status: "skew", protocolVersion: "2.0" }))
  expect(said.label).toBe("odu: update needed")
  expect(said.detail).toContain("odu 2.0")
  expect(said.detail).toContain("olai 1.3")
})

// ── the readout as the health dot reads it ─────────────────────────────

test("connected is healthy, in the row's own words", () => {
  const up = link({ status: "connected", protocolVersion: "1.3" })
  expect(oduStatus(up)).toEqual({ tone: "healthy", label: "odu", detail: oduSaid(up).detail })
})

test("a skew is an alarm: no run can be read until one side moves", () => {
  const skew = link({ status: "skew", protocolVersion: "2.0" })
  expect(oduStatus(skew)).toEqual({ tone: "alarm", label: "odu: update needed", detail: oduSaid(skew).detail })
})

test("no odu is quiet — set up or not, it never colours the dot", () => {
  expect(oduStatus(link({ status: "absent" }))).toMatchObject({ tone: "quiet", label: "No odu" })
  expect(oduStatus(link({ status: "absent", origin: "" }))).toMatchObject({ tone: "quiet", label: "No odu" })
})
