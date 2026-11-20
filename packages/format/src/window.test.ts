import { expect, test } from "bun:test"

import { NOTHING_PENDING, type Pending } from "./committing.ts"
import { armedOn, flurryOf, QUIET_MS } from "./window.ts"

const READY: Pending = {
  ...NOTHING_PENDING,
  repo: { _tag: "Ready", branch: "main" },
}

const WAITING: Pending = {
  ...READY,
  changes: [{ file: "house.olai", id: "order", title: "order", fields: [], sort: "edited" }],
}

test("only `auto`, an unpaused loop, no hold and a ready repository arm the window", () => {
  expect(armedOn("auto", null, false, WAITING)).toBe(flurryOf(WAITING))
  expect(armedOn("manual", null, false, WAITING)).toBe("")
  expect(armedOn("off", null, false, WAITING)).toBe("")
  expect(armedOn("auto", "git refused the commit", false, WAITING)).toBe("")
  expect(armedOn("auto", null, true, WAITING)).toBe("")
  expect(armedOn("auto", null, false, { ...WAITING, repo: { _tag: "Off" } })).toBe("")
})

test("a hold is a term of the rule rather than a second check beside it", () => {
  expect(armedOn("auto", null, false, WAITING)).not.toBe("")
  expect(armedOn("auto", null, true, WAITING)).toBe("")
})

test("a ready repository with nothing waiting is not armed", () => {
  expect(armedOn("auto", null, false, READY)).toBe("")
})

test("the key is a function of what is WAITING, so a survey that says nothing new costs nothing", () => {
  expect(flurryOf(READY)).toBe("")
  expect(flurryOf(WAITING)).toBe(flurryOf({ ...WAITING }))
  expect(flurryOf(WAITING)).not.toBe(flurryOf({
    ...WAITING,
    outlines: [{ file: "house.olai", path: "house.olai", how: "modified", from: null }],
  }))
  expect(QUIET_MS).toBe(15_000)
})
