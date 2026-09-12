import { expect, test } from "bun:test"

import type { OduLink } from "olai-plugin-odu/appliance/wire"

import { oduSaid } from "./said.ts"

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
  expect(said.detail).toContain("http://127.0.0.1:18440")
})

test("absent names the origin and the fix", () => {
  const said = oduSaid(link({ status: "absent" }))
  expect(said.label).toBe("no odu")
  expect(said.detail).toContain("odu web --background")
})

test("skew names both versions", () => {
  const said = oduSaid(link({ status: "skew", protocolVersion: "2.0" }))
  expect(said.label).toBe("odu skew")
  expect(said.detail).toContain("2.0")
  expect(said.detail).toContain("1.3")
})
