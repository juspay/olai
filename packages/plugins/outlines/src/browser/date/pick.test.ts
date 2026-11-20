import { expect, test } from "bun:test"

import { inZone } from "@olai/format/testlib"

import {
  browserInstantAt,
  type Chosen,
  datePick,
  type InstantAt,
  noticeOf,
  pressOf,
  startsAt,
  valueOf,
} from "./pick.ts"

const newYork: InstantAt = (day, time) => {
  const month = Number(day.slice(5, 7))
  return `${day}T${time}:00${month >= 4 && month <= 10 ? "-04:00" : "-05:00"}`
}

const skipping: InstantAt = (day, time) =>
  day === "2026-03-08" && time === "02:30" ? "2026-03-08T03:30:00-04:00" : newYork(day, time)

const notice = (stored: string | undefined, chosen: Chosen, instantAt: InstantAt = newYork) =>
  noticeOf(stored, chosen, valueOf(stored, chosen, instantAt), instantAt)

test("an undated node starts both boxes empty", () => {
  expect(startsAt(undefined)).toEqual({ day: "", time: "" })
})

test("a dated node starts on its own day, with no time", () => {
  expect(startsAt("2026-08-10")).toEqual({ day: "2026-08-10", time: "" })
})

test("a stored datetime starts on its day and the time its face says", () => {
  expect(startsAt("2026-08-11T15:40:03-07:00")).toEqual({ day: "2026-08-11", time: "15:40" })
})

test("a datetime written with a space starts on its time too", () => {
  expect(startsAt("2026-08-13 14:00")).toEqual({ day: "2026-08-13", time: "14:00" })
  expect(valueOf("2026-08-13 14:00", { day: "2026-08-13", time: "14:00" }, newYork))
    .toBe("2026-08-13 14:00")
  expect(pressOf("2026-08-13 14:00", "2026-08-13 14:00")).toEqual({ label: "Set date", writes: false })
})

test("a day with no time is those ten characters and nothing else", () => {
  expect(valueOf(undefined, { day: "2026-09-01", time: "" }, newYork)).toBe("2026-09-01")
  expect(valueOf("2026-09-01T09:30:00-04:00", { day: "2026-09-01", time: "" }, newYork))
    .toBe("2026-09-01")
})

test("a day and a time are written as a stamp is, in the moment's own offset", () => {
  expect(valueOf(undefined, { day: "2026-09-01", time: "09:30" }, newYork))
    .toBe("2026-09-01T09:30:00-04:00")
  expect(valueOf("2026-09-01T09:30:00-04:00", { day: "2026-12-01", time: "09:30" }, newYork))
    .toBe("2026-12-01T09:30:00-05:00")
})

test("an unchanged face is the stored value verbatim, seconds and zone included", () => {
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

test("a face the zone skips is written as the instant it becomes, whole", () => {
  expect(valueOf(undefined, { day: "2026-03-08", time: "02:30" }, skipping))
    .toBe("2026-03-08T03:30:00-04:00")
})

test("the browser's resolver writes the moment's own offset", () => {
  inZone("America/New_York", () => {
    expect(browserInstantAt("2026-09-01", "09:30")).toBe("2026-09-01T09:30:00-04:00")
    expect(browserInstantAt("2026-12-01", "09:30")).toBe("2026-12-01T09:30:00-05:00")
  })
})

test("a time the clock skips is moved forward whole, never an hour back", () => {
  inZone("America/New_York", () => {
    const written = browserInstantAt("2026-03-08", "02:30")
    expect(written).toBe("2026-03-08T03:30:00-04:00")
    expect(Date.parse(written)).toBeGreaterThan(Date.parse("2026-03-08T01:59:00-05:00"))
  })
})

test("a time the clock repeats is written as one of its two instants, consistently", () => {
  inZone("America/New_York", () => {
    const written = browserInstantAt("2026-11-01", "01:30")
    expect(written).toMatch(/^2026-11-01T01:30:00-0[45]:00$/)
  })
})

test("a year under a hundred is that year", () => {
  inZone("America/New_York", () => {
    expect(browserInstantAt("0050-06-01", "12:00").slice(0, 16)).toBe("0050-06-01T12:00")
  })
})

test("a value travels verbatim, to the node the caller named", () => {
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
  expect(datePick("order", "")).toEqual({ verb: "date", id: "order", date: null })
})

test("an emptied box is spelled with the menu's own words", () => {
  expect(pressOf("2026-08-10", "")).toEqual({ label: "Clear date", writes: true })
  expect(pressOf("2026-08-10T14:30:00-04:00", "")).toEqual({ label: "Clear date", writes: true })
})

test("an empty box on an UNDATED node is still waiting for a day", () => {
  expect(pressOf(undefined, "")).toEqual({ label: "Set date", writes: false })
})

test("nothing to write is nothing to press", () => {
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

test("a value nobody can read writes nothing, under the verb the person came for", () => {
  expect(pressOf("2026-08-10T14:30:00-04:00", null)).toEqual({ label: "Set date", writes: false })
  expect(pressOf(undefined, null)).toEqual({ label: "Set date", writes: false })
})

test("taking the time off a datetime's own day says so", () => {
  expect(pressOf("2026-08-11T15:40:03-04:00", "2026-08-11"))
    .toEqual({ label: "Clear time", writes: true })
  expect(pressOf("2026-08-11T15:40:03-04:00", "2026-08-12"))
    .toEqual({ label: "Set date", writes: true })
})

test("a day, or a datetime in this browser's zone, needs no notice", () => {
  expect(notice(undefined, { day: "", time: "" })).toBeUndefined()
  expect(notice("2026-08-10", { day: "2026-08-10", time: "" })).toBeUndefined()
  expect(notice("2026-08-10T14:30:00-04:00", { day: "2026-08-10", time: "14:30" })).toBeUndefined()
  expect(notice("2026-08-10T14:30:00-04:00", { day: "2026-12-10", time: "14:30" })).toBeUndefined()
})

test("`Z` is the same offset as `+00:00`, not another zone", () => {
  const utc: InstantAt = (day, time) => `${day}T${time}:00+00:00`
  expect(notice("2026-08-10T14:30:00Z", { day: "2026-08-10", time: "14:30" }, utc)).toBeUndefined()
})

test("a datetime from another zone is quoted verbatim, naming no offset until one is chosen", () => {
  expect(notice("2026-08-11T15:40:03-07:00", { day: "2026-08-11", time: "15:40" })).toBe(
    "Scheduled for 2026-08-11T15:40:03-07:00. A new day or time is saved " +
      "in your time zone.",
  )
  expect(notice("2026-08-11 15:40", { day: "2026-08-11", time: "15:40" }))
    .toContain("Scheduled for 2026-08-11 15:40.")
})

test("with the draft changed, it quotes exactly what pressing writes", () => {
  expect(notice("2026-08-11T15:40:03-07:00", { day: "2026-12-01", time: "15:40" })).toBe(
    "Scheduled for 2026-08-11T15:40:03-07:00. This saves " +
      "2026-12-01T15:40:00-05:00, in your time zone.",
  )
  expect(notice("2026-08-11T15:40:03-07:00", { day: "2026-08-11", time: "" })).toBeUndefined()
})

test("a face the zone skips is quoted as the value it becomes, before it is written", () => {
  expect(notice(undefined, { day: "2026-03-08", time: "02:30" }, skipping)).toBe(
    "There is no 02:30 on 2026-03-08 in your time zone, so this saves " +
      "2026-03-08T03:30:00-04:00.",
  )
})
