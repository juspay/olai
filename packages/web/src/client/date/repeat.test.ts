/**
 * The repeat picker's decisions, over the two strings it has.
 *
 * The claim these hold is the format's own: the grammar is spelled in the
 * file, so what a person chooses is what the record will hold, character for
 * character — and the list they choose FROM is the format's, not a second one
 * written here. The rest is the rule about writes that would ask for nothing,
 * and the one spelling of stopping a recurrence.
 */

import { REPEAT_RULES } from "@olai/format"
import { expect, test } from "bun:test"

import { noticeOf, pressOf, repeatPick, startsAt } from "./repeat.ts"

// ── what the box starts with ───────────────────────────────────────────

test("a node that does not repeat starts on the empty option", () => {
  expect(startsAt(undefined)).toBe("")
})

test("a repeating node starts on its own rule, verbatim", () => {
  expect(startsAt("every week on monday")).toBe("every week on monday")
})

// A rule this build's list does not hold seeds NOTHING rather than an invented
// selection — and `noticeOf` is what says so out loud.
test("a rule the list cannot show starts empty, and is said out loud", () => {
  expect(startsAt("every 2 weeks")).toBe("")
  expect(noticeOf("every 2 weeks")).toContain("every 2 weeks")
  expect(noticeOf("every week on monday")).toBeUndefined()
  expect(noticeOf(undefined)).toBeUndefined()
})

// ── the edit it sends ──────────────────────────────────────────────────

test("a chosen rule crosses as the words that were chosen", () => {
  expect(repeatPick("bins", "every week on monday")).toEqual({
    verb: "repeat",
    id: "bins",
    repeat: "every week on monday",
  })
})

// ONE constructor for both doors: the empty option and the menu's `Stop
// repeating` are the same edit, so they cannot come to disagree about how "no
// rule" is spelled on the wire.
test("the empty option is `null`, which is what `Stop repeating` sends", () => {
  expect(repeatPick("bins", "")).toEqual({ verb: "repeat", id: "bins", repeat: null })
})

// ── the button ─────────────────────────────────────────────────────────

test("the button is dead when pressing it would ask for nothing", () => {
  // Nothing chosen over a node that does not repeat…
  expect(pressOf(undefined, "")).toEqual({ label: "Set repeat", writes: false })
  // …and the rule it already carries.
  expect(pressOf("every day", "every day")).toEqual({ label: "Set repeat", writes: false })
})

test("an emptied box over a repeating node is `Stop repeating`, and it writes", () => {
  expect(pressOf("every day", "")).toEqual({ label: "Stop repeating", writes: true })
})

test("a new rule writes, whether or not there was one before", () => {
  expect(pressOf(undefined, "every month")).toEqual({ label: "Set repeat", writes: true })
  expect(pressOf("every day", "every month")).toEqual({ label: "Set repeat", writes: true })
})
