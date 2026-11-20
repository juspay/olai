import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { agendaOf, owedIn } from "./agenda.ts"
import { datedDays, datedOn } from "./dates.ts"
import { derive, tagPart, type TagSigil, tagText, type TitleTag } from "./derive.ts"
import { recordsOf, setOf, vaultOf } from "./fixtures.testlib.ts"
import { isRegular } from "./node.ts"
import { datesOf, monthOf } from "./occasion.ts"

const view = derive(TEST_CLAIMS, recordsOf(setOf(Object.fromEntries(vaultOf({ files: 1000, records: 21 })))))

test("the vault is the directory the published numbers name", () => {
  expect(view.byFile.size).toBe(981)
  expect(view.nodes.length).toBe(21_551)
})

test("both settling marks are in it, dated and bare", () => {
  const marks = view.nodes.filter(isRegular).map((at) => at.node)
  const carrying = (mark: "done" | "cancelled", value: "instant" | "bare"): number =>
    marks.filter((node) =>
      value === "bare" ? node[mark] === true : typeof node[mark] === "string"
    ).length

  for (const mark of ["done", "cancelled"] as const) {
    expect(carrying(mark, "instant")).toBeGreaterThan(0)
    expect(carrying(mark, "bare")).toBeGreaterThan(0)
  }

  const onDays = marks.filter((node) =>
    datesOf(node).some((dated) => dated.occasion === "cancelled")
  )
  expect(onDays.length).toBeGreaterThan(0)
})

test("every index a bench prints a number about has something in it", () => {
  expect(view.taggedBy.size).toBeGreaterThan(0)
  expect(view.byDay.size).toBeGreaterThan(0)
  expect(view.status.size).toBeGreaterThan(0)
  expect(view.after.size).toBeGreaterThan(0)
  expect(view.blocked.size).toBeGreaterThan(0)
  expect(view.mirrorsOf.size).toBeGreaterThan(0)
  expect(view.edgesTo.size).toBeGreaterThan(0)
  expect(view.namedBy.size).toBeGreaterThan(0)
  expect(view.children.size).toBeGreaterThan(0)
})

test("the prose is really there, and really names records", () => {
  const noted = view.nodes.filter((at) => isRegular(at) && at.node.desc !== undefined)
  expect(noted.length).toBeGreaterThan(0)
  const mentions = noted.filter((at) => (at.node as { desc?: string }).desc?.includes("@"))
  expect(mentions.length).toBeGreaterThan(0)
  expect(mentions.length).toBeLessThan(noted.length)
  const mentioned = written("@")
  expect(mentioned.length).toBeGreaterThan(0)
  expect(mentioned.filter((tag) => view.byId.has(tag.tag)).length).toBe(mentioned.length)
})

const written = (sigil: TagSigil): ReadonlyArray<TitleTag> =>
  [...view.taggedBy.keys()].map(tagPart).filter((tag) => tag.sigil === sigil)

test("the titles really carry `#tags`, and the notes carry some too", () => {
  expect(written("#").length).toBeGreaterThan(20)
  const entries = (sigil: TagSigil): number =>
    written(sigil).reduce((total, tag) => total + (view.taggedBy.get(tagText(tag))?.length ?? 0), 0)
  expect(entries("#")).toBeGreaterThan(entries("@"))
  const inNotes = view.nodes.filter((at) =>
    (at.node as { desc?: string }).desc?.includes("#") === true
  )
  expect(inNotes.length).toBeGreaterThan(0)
})

test("the vault is really scheduled, over a span with months in it", () => {
  const dated = view.nodes.filter(isRegular).filter((at) => datesOf(at.node).length > 0)
  expect(dated.length).toBeGreaterThan(1000)
  expect(view.byDay.size).toBeGreaterThan(300)
  expect(view.byDay.size).toBeLessThan(dated.length)
  const finished = dated.filter((at) =>
    datesOf(at.node).some((one) => one.occasion === "done")
  )
  expect(finished.length).toBeGreaterThan(0)
  expect(finished.length).toBeLessThan(dated.length)
})

test("the readings over the day index have something to answer", () => {
  const months = new Set([...view.byDay.keys()].map(monthOf))
  expect(months.size).toBeGreaterThan(12)
  const busiest = [...view.byDay.entries()].sort(([, one], [, other]) =>
    other.length - one.length
  )[0] as readonly [string, ReadonlyArray<unknown>]
  expect(datedDays(view, monthOf(busiest[0])).length).toBeGreaterThan(20)
  expect(datedOn(view, busiest[0]).length).toBeGreaterThan(0)
  expect(owedIn(agendaOf(view, "2026-01-15"))).toBeGreaterThan(0)
})
