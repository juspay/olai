/**
 * THE GATE: the sharing says exactly what rebuilding says, and the pre-check is
 * never wrong about it.
 *
 * Three claims, and the file is in that order.
 *
 *   1. **THE DIFFERENTIAL.** One op corpus, a room of tabs, both wirings: every
 *      tab holds the same answer at every revision and frames the same
 *      revisions ({@link ./standing.testlib.ts}).
 *   2. **THE HARNESS CAN FAIL.** Three deliberately broken wirings — a
 *      pre-check that never fires a rebuild, a share that crosses two requests,
 *      a share that never rolls — are each caught. A differential that cannot
 *      see the failure it is aimed at is not evidence, which is
 *      `@olai/server`'s `published.equivalence.test.ts` rule one layer down.
 *   3. **THE PRE-CHECK'S NEGATIVE SPACE.** Every question at every revision:
 *      the tape asked AND the answer rebuilt anyway. A tape that said "nothing
 *      moved" over an answer that moved is the wrong page this mechanism could
 *      produce, and there are none.
 *
 * AND A FLOOR UNDER ALL THREE, because a harness that ran nothing would pass
 * every one of them: the corpus is asserted to hold the shapes it claims, and
 * the shared arm is asserted to have actually shared and carried.
 */

import { expect, test } from "bun:test"

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

/** One corpus for the whole file, built once: forty files, twelve records each,
 *  two hundred revisions of every shape the vocabulary has. Small enough that
 *  the suite is a second and wide enough that every arm of the corpus fires,
 *  which the first test asserts rather than assumes. */
const REVISIONS: ReadonlyArray<Revision> = corpusOf(
  vaultFor({ files: 40, records: 12 }),
  { steps: 200 },
)
const TABS = tabsOver((REVISIONS[0] as Revision).reading)

/** How many revisions of the corpus say a given kind of thing — the floor
 *  check's instrument. */
const saying = (word: string): number =>
  REVISIONS.filter((revision) => revision.says.includes(word)).length

test("the corpus holds every shape it claims to", () => {
  // A CORPUS THAT NEVER MOVED A MARK would prove the pre-check right about a
  // revision it never saw. One line per arm, so a generator that quietly
  // stopped producing one fails here rather than passing everything below.
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
  // A TORN FILE reaches the readings as a `broken` entry, which is one of the
  // two things a page reading is a function of and the one this corpus would
  // otherwise never produce. (That it is a REVISION at all rather than a
  // refusal is the format's own rule: a file that will not parse keeps its
  // place in the set. `corpusOf` throws on a step that really did publish
  // nothing, so a corpus quietly replaying one directory cannot get this far.)
  expect(tornIn(REVISIONS).length).toBeGreaterThan(0)
})

test("every tab holds and frames exactly what rebuilding would give it", () => {
  const report = differential(REVISIONS, TABS)
  expect(report.divergences).toEqual([])
  expect(report.frames).toEqual([])
  // …over a run that really did ask: four tabs, seventeen open questions, one
  // ask each per revision.
  expect(report.asks).toBeGreaterThan(2000)
})

test("the shared arm actually shared, and the rebuilding arm actually did not", () => {
  // THE VACUOUS PASS this closes: a wiring that shared nothing would satisfy
  // every equality above by doing all the work twice. The counts are read off
  // the answers by identity from outside the module, so they are a measurement
  // rather than something `standing.ts` says about itself.
  const rebuilt = watching(rebuilding(() => FIXED), REVISIONS, TABS)
  const answered = watching(standing(() => FIXED), REVISIONS, TABS)
  expect(rebuilt.shared).toBe(0)
  expect(rebuilt.carried).toBe(0)
  expect(answered.shared).toBeGreaterThan(0)
  expect(answered.carried).toBeGreaterThan(0)
  // Two tabs hold the same three questions and a third shares two of them, so
  // the share alone is about a third of the asks; with the carry, what is left
  // is the answers this corpus genuinely had to build. A LOOSE floor on
  // purpose — the exact fraction is a fact about this corpus and belongs in the
  // bench, and a tight one here would fail the day somebody adds a step shape.
  // What it fences is the vacuous pass: a wiring that reused nothing.
  const built = answered.asks - answered.shared - answered.carried
  expect(built).toBeLessThan(answered.asks / 3)
})

test("the differential catches a pre-check that never fires a rebuild", () => {
  const report = differential(REVISIONS, TABS, { shared: deaf })
  expect(report.divergences.length).toBeGreaterThan(0)
  // …and it catches it as a SWALLOWED FRAME as well, which is the half a
  // comparison of held values could miss if the wrong answer happened to
  // coincide with the right one at the end.
  expect(report.frames.length).toBeGreaterThan(0)
})

test("the differential catches a share that crosses two requests", () => {
  // The failure a run with one question open would never see: the second tab is
  // shown the first tab's page, and both pages are perfectly valid answers to
  // somebody's question.
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
  // THE CLAIM. Every one of these is a revision where the tape said the answer
  // could not have moved and the rebuilt answer agreed.
  expect(negative.wrong).toEqual([])
  // …and the floor under it: a pre-check that never fired would report no
  // wrongs by never having said anything.
  expect(negative.asked).toBeGreaterThan(1000)
  expect(negative.held).toBeGreaterThan(negative.asked / 4)
})
