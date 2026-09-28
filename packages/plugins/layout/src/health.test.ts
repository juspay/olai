/**
 * The health dot's fold: worst tone wins, `quiet` never colours it, and the
 * name quotes each readout's own label, alarms first.
 */
import { expect, test } from "bun:test"

import { lookOf } from "@olai/web/client/connection/status.ts"

import { nameOf, tipOf, worstFirst, worstOf } from "./health.ts"
import type { BarStatus, BarTone } from "./slots.ts"

const retired = lookOf({ status: "retired", needsReload: true })

test("nothing standing, and nothing but quiet rows, is healthy", () => {
  expect(worstOf([])).toBe("healthy")
  expect(worstOf([{ tone: "quiet", label: "no git here" }, { tone: "quiet", label: "no kolu" }])).toBe("healthy")
  expect(nameOf([{ tone: "quiet", label: "no git here" }])).toBe("Status: all good")
})

test("the worst tone wins, whatever order the rows stand in", () => {
  const notice: BarStatus = { tone: "notice", label: "3 uncommitted" }
  const alarm: BarStatus = { tone: "alarm", label: "kolu skew" }
  expect(worstOf([notice, { tone: "healthy", label: "live" }])).toBe("notice")
  expect(worstOf([notice, alarm])).toBe("alarm")
  expect(worstOf([alarm, notice])).toBe("alarm")
})

test("the name quotes the news in the readouts' own words, alarms first", () => {
  const statuses: ReadonlyArray<BarStatus> = [
    { tone: "notice", label: "3 uncommitted" },
    { tone: "healthy", label: "kolu" },
    retired,
  ]
  expect(nameOf(statuses)).toBe(`Status: ${retired.label} · 3 uncommitted`)
  expect(tipOf(statuses).split("\n")[1]).toBe(`${retired.label} — ${retired.detail}`)
})

// The popover's order: worst first, the quiet last, and rows of one tone in
// the order they came (the connection first, then mount order).
test("rows stand worst first, and keep their order within a tone", () => {
  const rows: ReadonlyArray<BarStatus> = [
    { tone: "healthy", label: "connection" },
    { tone: "quiet", label: "no kolu" },
    { tone: "notice", label: "9 uncommitted" },
    { tone: "healthy", label: "odu" },
    { tone: "alarm", label: "xyne error" },
    { tone: "notice", label: "kolu · no check-in" },
  ]
  expect(worstFirst(rows, (row) => row.tone).map((row) => row.label)).toEqual([
    "xyne error", "9 uncommitted", "kolu · no check-in", "connection", "odu", "no kolu",
  ])
  // Nothing wrong: the order is the order they came in.
  const calm = rows.filter((row) => row.tone === "healthy")
  expect(worstFirst(calm, (row) => row.tone)).toEqual(calm)
})

// THE INVARIANT the one-tone rule exists for: whenever the dot is not green,
// some row in the popover wears a dot of exactly its colour — because the dot
// is folded from the very tones the rows paint. Every mix of up to three rows,
// so no ordering or combination can break it.
test("a dot that is not green always has a row of its colour", () => {
  const TONES: ReadonlyArray<BarTone> = ["healthy", "quiet", "notice", "alarm"]
  const rows = (n: number): ReadonlyArray<ReadonlyArray<BarTone>> =>
    n === 0 ? [[]] : rows(n - 1).flatMap((rest) => TONES.map((tone) => [tone, ...rest]))
  for (const tones of [0, 1, 2, 3].flatMap(rows)) {
    const worst = worstOf(tones.map((tone) => ({ tone, label: tone })))
    if (worst !== "healthy") expect(tones).toContain(worst)
  }
})
