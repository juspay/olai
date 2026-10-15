/**
 * THE QUIET WINDOW'S RULE, on its own — no timer, no git, no repository.
 *
 * The loop in `olai-plugin-git` runs it twice (when it arms and when it fires)
 * and the browser asks it once (`willRecord`), so what is asserted here is the
 * one expression all three of them read rather than any of the three.
 */
import { expect, test } from "bun:test"

import { NOTHING_PENDING, type Pending } from "./committing.ts"
import { armedOn, flurryOf, QUIET_MS } from "./window.ts"

const READY: Pending = {
  ...NOTHING_PENDING,
  repo: { _tag: "Ready", branch: "main" },
}

/** One waiting outline, which is the only thing that makes the answer non-empty. */
const WAITING: Pending = {
  ...READY,
  // A NODE-LEVEL ROW: `changes` is what changed in the set (`./changes.ts`),
  // and `outlines` is the file list a selection ticks.
  changes: [{ file: "house.olai", id: "order", title: "order", fields: [], sort: "edited" }],
}

test("only `auto`, an unpaused loop, no hold and a ready repository arm the window", () => {
  expect(armedOn("auto", null, false, WAITING)).toBe(flurryOf(WAITING))
  // ... and each of the three other terms alone empties it.
  expect(armedOn("manual", null, false, WAITING)).toBe("")
  expect(armedOn("off", null, false, WAITING)).toBe("")
  expect(armedOn("auto", "git refused the commit", false, WAITING)).toBe("")
  expect(armedOn("auto", null, true, WAITING)).toBe("")
  expect(armedOn("auto", null, false, { ...WAITING, repo: { _tag: "Off" } })).toBe("")
})

test("a hold is a term of the rule rather than a second check beside it", () => {
  // WHICH IS THE WHOLE POINT OF IT BEING A PARAMETER: the loop asks this
  // expression at the moment it fires as well as when it arms, so a hold that is
  // taken or released inside a window is honoured by the same sentence that
  // honours the policy and the pause. The arms above already read the held case
  // as part of the whole rule; what is here is the ONE thing they cannot show —
  // that taking a hold is what empties a window that was armed a line earlier.
  expect(armedOn("auto", null, false, WAITING)).not.toBe("")
  expect(armedOn("auto", null, true, WAITING)).toBe("")
})

test("a ready repository with nothing waiting is not armed", () => {
  // The bug the panel's `willRecord` was fixed for: an empty list under
  // `commit: auto` is not a promise to commit anything.
  expect(armedOn("auto", null, false, READY)).toBe("")
})

test("the key is a function of what is WAITING, so a survey that says nothing new costs nothing", () => {
  expect(flurryOf(READY)).toBe("")
  expect(flurryOf(WAITING)).toBe(flurryOf({ ...WAITING }))
  expect(flurryOf(WAITING)).not.toBe(flurryOf({
    ...WAITING,
    outlines: [{ file: "house.olai", path: "house.olai", how: "modified", from: null }],
  }))
  // The span is a product decision and is asserted where it lives rather than
  // described in a test's own number.
  expect(QUIET_MS).toBe(15_000)
})
