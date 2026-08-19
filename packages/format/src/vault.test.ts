/**
 * THE FIXTURE THE BENCHES QUOTE NUMBERS ABOUT, asserted to hold the shapes
 * those numbers are supposed to be about.
 *
 * `fixtures.testlib.ts`'s own header says it has no tests — it is a helper
 * module rather than a suite — and this file is the one exception, minted for a
 * reason worth writing down. `vaultOf` gained prose so that the tag index
 * would stop being an empty map in `patch.bench.ts` and `deriving.bench.ts`;
 * the first spelling of that used `which % 25 === 0` inside a loop that runs
 * `which` from 1 to 20, so it **never fired**. The vault had 3,920 notes and
 * not one `@` in it, `mentionedBy.size` was `0`, the patcher's own early return
 * fired on every edit, and the format README claimed the opposite beside the
 * numbers for a whole review cycle — until a reviewer derived the corpus and
 * counted.
 *
 * So this is not a test of a generator. It is the fence between a bench and a
 * false claim: an index nothing exercises prints *costs zero* where what it
 * printed was *was never asked*, and the two are indistinguishable in the
 * output. Every shape the benches' prose promises is asserted here, at THE SIZE
 * THEY RUN, so a fixture that quietly stops producing one fails a test rather
 * than a paragraph.
 */

import { expect, test } from "bun:test"

import { derive, tagPart, type TagSigil, tagText, type TitleTag } from "./derive.ts"
import { recordsOf, setOf, vaultOf } from "./fixtures.testlib.ts"
import { isMirror } from "./node.ts"

/** The benches' own defaults (`patch.bench.ts`'s `OLAI_BENCH_FILES` /
 *  `OLAI_BENCH_RECORDS`), which is the only size a claim about "the 1,000-file
 *  vault" can be checked at. */
const view = derive(recordsOf(setOf(Object.fromEntries(vaultOf({ files: 1000, records: 21 })))))

test("the vault is the directory the published numbers name", () => {
  expect(view.byFile.size).toBe(980)
  expect(view.nodes.length).toBe(21_552)
})

test("every index a bench prints a number about has something in it", () => {
  // The one that was empty, and the reason this file exists.
  expect(view.taggedBy.size).toBeGreaterThan(0)
  // ...and the rest of the shapes `vaultOf`'s header promises, so this fence
  // covers the next one to go quiet rather than only the one that did.
  expect(view.status.size).toBeGreaterThan(0)
  expect(view.after.size).toBeGreaterThan(0)
  expect(view.blocked.size).toBeGreaterThan(0)
  expect(view.mirrorsOf.size).toBeGreaterThan(0)
  expect(view.edgesTo.size).toBeGreaterThan(0)
  expect(view.namedBy.size).toBeGreaterThan(0)
  expect(view.children.size).toBeGreaterThan(0)
})

test("the prose is really there, and really names records", () => {
  const noted = view.nodes.filter((at) => !isMirror(at.node) && at.node.desc !== undefined)
  expect(noted.length).toBeGreaterThan(0)
  // A mention is a note that names a record, so there are fewer of them than
  // notes — a generator that put an `@` in every note would be measuring a
  // corpus nobody has.
  const mentions = noted.filter((at) => (at.node as { desc?: string }).desc?.includes("@"))
  expect(mentions.length).toBeGreaterThan(0)
  expect(mentions.length).toBeLessThan(noted.length)
  // ...and the words they write are ids the corpus really holds, so the READING
  // over this index answers with referrers rather than with dead keys.
  const mentioned = written("@")
  expect(mentioned.length).toBeGreaterThan(0)
  expect(mentioned.filter((tag) => view.byId.has(tag.tag)).length).toBe(mentioned.length)
})

/** The index's keys under one sigil, taken apart the way the format takes one
 *  apart ({@link tagPart}) — a fence that split a written key by hand would be
 *  the one file that cannot notice the encoding moving. */
const written = (sigil: TagSigil): ReadonlyArray<TitleTag> =>
  [...view.taggedBy.keys()].map(tagPart).filter((tag) => tag.sigil === sigil)

// BOTH SIGILS, because the index files both and a vault that wrote only the
// rarer one would print the fold's cheap negative as the cost of its walk —
// this file's own reason for existing, one namespace over. The `#` half is what
// the completion this index feeds is nearly all made of.
test("the titles really carry `#tags`, and the notes carry some too", () => {
  expect(written("#").length).toBeGreaterThan(20)
  // More records write a `#` than an `@`: the shape a real directory has, and
  // the one the completion's ordering is measured against.
  const entries = (sigil: TagSigil): number =>
    written(sigil).reduce((total, tag) => total + (view.taggedBy.get(tagText(tag))?.length ?? 0), 0)
  expect(entries("#")).toBeGreaterThan(entries("@"))
  // ...and a tag written in a NOTE is filed, which is the half of the fold a
  // title-only vault would leave unmeasured.
  const inNotes = view.nodes.filter((at) =>
    (at.node as { desc?: string }).desc?.includes("#") === true
  )
  expect(inNotes.length).toBeGreaterThan(0)
})
