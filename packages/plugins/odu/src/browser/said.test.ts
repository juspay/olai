import { expect, test } from "bun:test"

import type { OduLink } from "olai-plugin-odu/appliance/wire"

import { oduSaid } from "./said.ts"

const link = (over: Partial<OduLink>): OduLink => ({
  status: "absent",
  origin: "http://127.0.0.1:18440",
  refusal: "",
  since: "2026-09-12T00:00:00.000Z",
  ...over,
})

test("connected is the quiet face", () => {
  const said = oduSaid(link({ status: "connected" }))
  expect(said.label).toBe("odu")
  expect(said.tone).toBe("healthy")
  expect(said.detail).toBe("Connected to http://127.0.0.1:18440")
})

test("absent names the origin and the fix, and never colours the dot", () => {
  const said = oduSaid(link({ status: "absent" }))
  expect(said.label).toBe("No odu")
  expect(said.detail).toContain("http://127.0.0.1:18440")
  expect(said.detail).toContain("odu web --background")
  expect(said.tone).toBe("quiet")
})

test("an olai watching no odu at all says so rather than naming a blank origin", () => {
  expect(oduSaid(link({ status: "absent", origin: "" })).detail).toBe("odu isn't set up")
})

test("a refused service is an alarm, and says what odu said", () => {
  // The sentence is odu's whole one — which contract disagreed and what each
  // side reads — because this face never made that comparison and has no
  // business composing words about it. No run can be read until one side moves,
  // so the dot is red.
  const said = oduSaid(link({
    status: "skew",
    refusal:
      "the odu service at http://127.0.0.1:18440 serves the ci row at 99.0; "
      + "this build reads ci 2.4 — upgrade the daemon (`odu web --upgrade`) or this build.",
  }))
  expect(said.label).toBe("odu: update needed")
  expect(said.tone).toBe("alarm")
  expect(said.detail).toContain("serves the ci row at 99.0")
  expect(said.detail).toContain("this build reads ci 2.4")
})
