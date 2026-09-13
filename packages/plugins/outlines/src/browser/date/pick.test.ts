/**
 * The picker's decisions, over the strings it has.
 *
 * The claim these hold is the format's own: a date is TEXT, so a day picked in
 * the browser reaches the wire as the ten characters that were picked, and a
 * time as the face that was typed with the offset spelled out — never a value
 * that has been through an instant on the way. The rest is the rule about
 * writes that would ask for nothing, and the one spelling of taking a date or
 * its time off.
 */

import { expect, test } from "bun:test"

import { datePick, noticeOf, type OffsetAt, pressOf, startsAt, valueOf } from "./pick.ts"

/** New York's two offsets, by month — a zone that moves its clocks, so the
 *  offset a pick is written with is visibly the moment's and not today's. */
const newYork: OffsetAt = (day) => {
  const month = Number(day.slice(5, 7))
  return month >= 4 && month <= 10 ? "-04:00" : "-05:00"
}

// ── what the boxes start with ──────────────────────────────────────────

test("an undated node starts both boxes empty", () => {
  expect(startsAt(undefined)).toEqual({ day: "", time: "" })
})

test("a dated node starts on its own day, with no time", () => {
  expect(startsAt("2026-08-10")).toEqual({ day: "2026-08-10", time: "" })
})

test("a stored datetime starts on its day and the time its face says", () => {
  // `@olai/format`'s own readings — slices, never a conversion into this
  // browser's zone: the boxes say what the file says.
  expect(startsAt("2026-08-11T15:40:03-07:00")).toEqual({ day: "2026-08-11", time: "15:40" })
})

// ── the value the boxes come to ────────────────────────────────────────

test("a day with no time is those ten characters and nothing else", () => {
  expect(valueOf(undefined, { day: "2026-09-01", time: "" }, newYork)).toBe("2026-09-01")
  // ...which is also how a time comes off a stored datetime.
  expect(valueOf("2026-09-01T09:30:00-04:00", { day: "2026-09-01", time: "" }, newYork))
    .toBe("2026-09-01")
})

test("a day and a time are written as a stamp is, in the moment's own offset", () => {
  expect(valueOf(undefined, { day: "2026-09-01", time: "09:30" }, newYork))
    .toBe("2026-09-01T09:30:00-04:00")
  // December is not written with September's offset.
  expect(valueOf("2026-09-01T09:30:00-04:00", { day: "2026-12-01", time: "09:30" }, newYork))
    .toBe("2026-12-01T09:30:00-05:00")
})

test("an unchanged face is the stored value verbatim, seconds and zone included", () => {
  // Reopening the picker must not rewrite a record nobody changed — not its
  // seconds, and not an offset written in some other zone.
  expect(valueOf("2026-08-11T15:40:03-07:00", { day: "2026-08-11", time: "15:40" }, newYork))
    .toBe("2026-08-11T15:40:03-07:00")
})

test("a changed face is written in this browser's zone", () => {
  expect(valueOf("2026-08-11T15:40:03-07:00", { day: "2026-08-11", time: "16:00" }, newYork))
    .toBe("2026-08-11T16:00:00-04:00")
})

test("no day is no date, whatever the time box holds", () => {
  expect(valueOf("2026-08-10T14:30:00-04:00", { day: "", time: "14:30" }, newYork)).toBe("")
  expect(valueOf(undefined, { day: "", time: "09:00" }, newYork)).toBe("")
})

// ── the edit ───────────────────────────────────────────────────────────

test("a value travels verbatim, to the node the caller named", () => {
  // Setting and CHANGING are this one case: the stored date is not an argument,
  // so which of the two a person thinks they are doing is a fact about the node
  // and nothing this function asks. Nor is the id — it travels as the caller
  // named it, which is how a pick at a mirror lands on the node the row shows.
  expect(datePick("herbs", "2026-09-01")).toEqual({
    verb: "date",
    id: "herbs",
    date: "2026-09-01",
  })
  expect(datePick("herbs", "2026-09-01T09:30:00-04:00")).toEqual({
    verb: "date",
    id: "herbs",
    date: "2026-09-01T09:30:00-04:00",
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
  expect(pressOf("2026-08-10T14:30:00-04:00", "")).toEqual({ label: "Clear date", writes: true })
})

test("an empty box on an UNDATED node is still waiting for a day", () => {
  // Nothing to clear, so the button does not offer to — and what a dead button
  // says is the verb the person came for. Said together, because these two
  // facts disagreed once: `Clear date` over a node with nothing to clear.
  expect(pressOf(undefined, "")).toEqual({ label: "Set date", writes: false })
})

test("nothing to write is nothing to press", () => {
  // The EDITOR's rule one field along (`../edit/draft.ts`: a commit that would
  // change nothing sends nothing) — not a fence on what may be written, which
  // the ops layer would accept from either face.
  expect(pressOf("2026-08-10", "2026-08-10")).toEqual({ label: "Set date", writes: false })
  expect(pressOf("2026-08-10T14:30:00-04:00", "2026-08-10T14:30:00-04:00"))
    .toEqual({ label: "Set date", writes: false })
})

test("setting and changing both write, under one name", () => {
  expect(pressOf(undefined, "2026-09-01")).toEqual({ label: "Set date", writes: true })
  expect(pressOf("2026-08-10", "2026-09-01")).toEqual({ label: "Set date", writes: true })
  expect(pressOf("2026-08-10", "2026-08-10T09:30:00-04:00"))
    .toEqual({ label: "Set date", writes: true })
})

test("taking the time off a datetime's own day says so", () => {
  expect(pressOf("2026-08-11T15:40:03-04:00", "2026-08-11"))
    .toEqual({ label: "Clear time", writes: true })
  // A different day as well is a new date, not only a cleared time.
  expect(pressOf("2026-08-11T15:40:03-04:00", "2026-08-12"))
    .toEqual({ label: "Set date", writes: true })
})

// ── what it says about a value the boxes cannot say whole ──────────────

test("a day, or a datetime in this browser's zone, needs no notice", () => {
  expect(noticeOf(undefined, newYork)).toBeUndefined()
  expect(noticeOf("2026-08-10", newYork)).toBeUndefined()
  expect(noticeOf("2026-08-10T14:30:00-04:00", newYork)).toBeUndefined()
  expect(noticeOf("2026-12-10T14:30:00-05:00", newYork)).toBeUndefined()
})

test("a datetime from another zone is quoted verbatim, with what a change writes", () => {
  expect(noticeOf("2026-08-11T15:40:03-07:00", newYork)).toBe(
    "Scheduled for 2026-08-11T15:40:03-07:00. A changed day or time is written " +
      "in this browser's time zone (-04:00).",
  )
  // A hand that wrote no zone at all is the same news.
  expect(noticeOf("2026-08-11T15:40", newYork)).toContain("(-04:00)")
})
