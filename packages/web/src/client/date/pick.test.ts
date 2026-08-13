/**
 * The picker's decisions, over the two strings it has.
 *
 * The claim these hold is the format's own: a date is TEXT, so a day picked in
 * the browser reaches the wire as the ten characters that were picked — never
 * a value that has been through an instant on the way. The rest is the rule
 * about writes that would ask for nothing, and the one spelling of taking a
 * date off.
 */

import { expect, test } from "bun:test"

import { datePick, noticeOf, pressOf, startsAt } from "./pick.ts"

// ── what the box starts with ───────────────────────────────────────────

test("an undated node starts the box empty", () => {
  expect(startsAt(undefined)).toBe("")
})

test("a dated node starts on its own day, verbatim", () => {
  expect(startsAt("2026-08-10")).toBe("2026-08-10")
})

test("a stored datetime starts on the day it falls on", () => {
  // `@olai/format`'s own reading — the first ten characters, the rule the
  // calendar and the agenda already read dates with.
  expect(startsAt("2026-08-11T15:40:03-04:00")).toBe("2026-08-11")
})

// ── the edit ───────────────────────────────────────────────────────────

test("a picked day travels as those ten characters and nothing else", () => {
  // The whole of docs/format.md's rule at this seam: no parse, no format, no
  // instant. What was picked is what the record will hold.
  //
  // Setting and CHANGING are this one case: the stored date is not an argument,
  // so which of the two a person thinks they are doing is a fact about the node
  // and nothing this function asks. Nor is the id — it travels as the caller
  // named it, which is how a pick at a mirror lands on the node the row shows.
  expect(datePick("herbs", "2026-09-01")).toEqual({
    verb: "date",
    id: "herbs",
    date: "2026-09-01",
  })
})

test("an emptied box is the menu's own clear, to the field", () => {
  // `•••` → `Clear date` sends exactly this (`../menu/verbs.ts`), and that is
  // the point: the picker absorbs the gesture rather than spelling it twice.
  expect(datePick("order", "")).toEqual({ verb: "date", id: "order", date: null })
})

// ── the button: what it says and whether it does anything ─────────────

test("an emptied box is spelled with the menu's own words", () => {
  expect(pressOf("2026-08-10", "")).toEqual({ label: "Clear date", writes: true })
})

test("an empty box on an UNDATED node is still waiting for a day", () => {
  // Nothing to clear, so the button does not offer to — and what a dead button
  // says is the verb the person came for. Said together, because these two
  // facts disagreed once: `Clear date` over a node with nothing to clear.
  expect(pressOf(undefined, "")).toEqual({ label: "Set date", writes: false })
})

test("nothing to write is nothing to press", () => {
  // The other no-op: the date already stored. The EDITOR's rule one field
  // along (`../edit/draft.ts`: a commit that would change nothing sends
  // nothing) — not a fence on what may be written, which the ops layer would
  // accept from either face.
  expect(pressOf("2026-08-10", "2026-08-10")).toEqual({
    label: "Set date",
    writes: false,
  })
})

test("setting and changing both write, under one name", () => {
  expect(pressOf(undefined, "2026-09-01")).toEqual({ label: "Set date", writes: true })
  expect(pressOf("2026-08-10", "2026-09-01")).toEqual({ label: "Set date", writes: true })
})

test("the day of a stored datetime is still a change", () => {
  // Two different records: writing the day drops the time, which is a write
  // and is exactly what the notice below warns about.
  expect(pressOf("2026-08-11T15:40:03-04:00", "2026-08-11")).toEqual({
    label: "Set date",
    writes: true,
  })
})

// ── what it says about a value the box cannot hold ─────────────────────

test("an ordinary day needs no notice", () => {
  expect(noticeOf(undefined)).toBeUndefined()
  expect(noticeOf("2026-08-10")).toBeUndefined()
})

test("a datetime is quoted verbatim, with what a pick would do to it", () => {
  expect(noticeOf("2026-08-11T15:40:03-04:00")).toBe(
    "Scheduled for 2026-08-11T15:40:03-04:00. Picking a day writes that day, " +
      "and the time goes with it.",
  )
})
