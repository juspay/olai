/**
 * The health dot's fold: worst tone wins, `quiet` never colours it, and the
 * name quotes each readout's own label, alarms first.
 */
import { expect, test } from "bun:test"

import { lookOf } from "@olai/web/client/connection/status.ts"

import { nameOf, tipOf, worstOf } from "./health.ts"
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
