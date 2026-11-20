import { expect, test } from "bun:test"
import { NO_KINDS } from "@olai/format"

import {
  corpusOf,
  crossed,
  deaf,
  differential,
  FIXED,
  frozen,
  negativeSpace,
  questionsOf,
  type Revision,
  tabsOver,
  tornIn,
  vaultFor,
  watching,
} from "./standing.testlib.ts"
import { rebuilding, standing } from "./standing.ts"

const REVISIONS: ReadonlyArray<Revision> = corpusOf(
  vaultFor({ files: 40, records: 12 }),
  { steps: 200 },
)
const TABS = tabsOver((REVISIONS[0] as Revision).reading)

const saying = (word: string): number =>
  REVISIONS.filter((revision) => revision.says.includes(word)).length

test("the corpus holds every shape it claims to", () => {
  expect(REVISIONS.length).toBeGreaterThan(150)
  for (const shape of ["retitle in", "mark in", "day in", "tag in", "edge in"]) {
    expect([shape, saying(shape) > 0]).toEqual([shape, true])
  }
  for (const shape of ["record born in", "record gone from", "file born", "file gone"]) {
    expect([shape, saying(shape) > 0]).toEqual([shape, true])
  }
  for (const shape of ["torn", "mended", "document", "re-read"]) {
    expect([shape, saying(shape) > 0]).toEqual([shape, true])
  }
  expect(tornIn(REVISIONS).length).toBeGreaterThan(0)
})

test("every tab holds and frames exactly what rebuilding would give it", () => {
  const report = differential(REVISIONS, TABS)
  expect(report.divergences).toEqual([])
  expect(report.frames).toEqual([])
  expect(report.asks).toBeGreaterThan(2000)
}, { timeout: 15_000 })

test("the shared arm actually shared, and the rebuilding arm actually did not", () => {
  const rebuilt = watching(rebuilding(() => FIXED, NO_KINDS), REVISIONS, TABS)
  const answered = watching(standing(() => FIXED, NO_KINDS), REVISIONS, TABS)
  expect(rebuilt.shared).toBe(0)
  expect(rebuilt.carried).toBe(0)
  expect(answered.shared).toBeGreaterThan(0)
  expect(answered.carried).toBeGreaterThan(0)
  const built = answered.asks - answered.shared - answered.carried
  expect(built).toBeLessThan(answered.asks / 2)
})

test("the differential catches a pre-check that never fires a rebuild", () => {
  const report = differential(REVISIONS, TABS, { shared: deaf })
  expect(report.divergences.length).toBeGreaterThan(0)
  expect(report.frames.length).toBeGreaterThan(0)
})

test("the differential catches a share that crosses two requests", () => {
  const report = differential(REVISIONS, TABS, { shared: crossed })
  expect(report.divergences.length).toBeGreaterThan(0)
})

test("the differential catches a share that never rolls the revision", () => {
  const report = differential(REVISIONS, TABS, { shared: frozen })
  expect(report.divergences.length).toBeGreaterThan(0)
  expect(report.frames.length).toBeGreaterThan(0)
})

test("the pre-check is never wrong: nothing it held had moved", () => {
  const negative = negativeSpace(REVISIONS, questionsOf(TABS))
  expect(negative.wrong).toEqual([])
  expect(negative.asked).toBeGreaterThan(1000)
  expect(negative.held).toBeGreaterThan(negative.asked / 4)
})
