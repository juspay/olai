/**
 * PUBLISHING CARRIES ITS MAPS, and publishes exactly what walking them
 * published.
 *
 * The claim of `perf-published-maps` is an equivalence, so the shape of this
 * file is a differential and not a table of expectations: `./published.testlib.ts`
 * holds the projection as it was — three walks of the directory, three fresh
 * maps per revision — and a fake subscriber that folds every frame BY IDENTITY,
 * which is the reader a carried map can starve. Every case here replays an op
 * corpus against both and asserts the same thing: an EMPTY divergence list,
 * plus enough counting to say the run was not vacuous.
 *
 * FOUR CORPORA, and each is here because the ones before it cannot reach what
 * it holds:
 *
 *   - the CORNERS, written by hand ({@link CORNERS}) — a file born before the
 *     whole vault and after all of it, a `.html` whose body the set does not
 *     keep, a file that breaks and mends, a file that will not open and then
 *     opens, a path deleted and written again, the pair `byPath` and a plain
 *     code-point sort disagree about (a file and a directory sharing a name),
 *     and the one this file did not have until it cost a day: a file that
 *     leaves in a revision the store cannot NAME (`Step.forgotten`, which is
 *     what a `resync` produces). A generator produces those at random or not at
 *     all;
 *   - a GENERATED vault with steps drawn off it, for size and for the shapes at
 *     rates — hundreds of saves, dozens of births, `git pull`-shaped revisions
 *     that move a dozen files at once;
 *   - THE REAL VAULT, this repository's `docs/`, edited: files people actually
 *     grew, in a directory with an archive in it;
 *   - and the two MUTANTS, which is how the harness is held to being able to
 *     see the failure at all.
 *
 * WHAT IS NOT ASSERTED HERE is anything about what either side SAYS — that is
 * `./published.test.ts`'s, which pins the projection's own promises against
 * fixtures small enough to write down. This file holds two implementations to
 * one answer and has no opinion about what that answer is.
 */

import { vaultOf } from "@olai/format/testlib"
import { vaultAt } from "@olai/format/testlib/scope"
import { expect, test } from "bun:test"

import { publishedOf } from "./published.ts"
import {
  differential,
  misplacing,
  publishedAsWalked,
  REFUSED,
  type Report,
  revisionsOf,
  type Step,
  stepsOver,
  swallowing,
} from "./published.testlib.ts"

/** The gate, in one place: no divergence, and the run was not vacuous. Both
 *  arms of the thing under test have to have been reached — a corpus that never
 *  carried a map, or never rebuilt one, proves the equivalence of half of it. */
const holds = (report: Report, floors: {
  readonly upserts: number
  readonly removes: number
  readonly reused: number
  readonly rebuilt: number
  /** How many keys an open reader was never told had gone — the residue a
   *  revision the store cannot name leaves, on both projections alike. A floor
   *  rather than a ceiling: it says the corpus REACHED the shape that broke
   *  this change once, not that the shape is acceptable. */
  readonly phantom: number
}): void => {
  // AN EQUALITY TO THE EMPTY LIST rather than a count, so a failure names the
  // revision, the collection, the file and what each side said — a differential
  // whose failure message is `expected 3 to be 0` is a differential nobody can
  // act on at four in the morning.
  expect(report.divergences).toEqual([])
  expect(report.upserts).toBeGreaterThan(floors.upserts)
  expect(report.removes).toBeGreaterThan(floors.removes)
  expect(report.reused).toBeGreaterThan(floors.reused)
  expect(report.rebuilt).toBeGreaterThan(floors.rebuilt)
  expect(report.phantom).toBeGreaterThanOrEqual(floors.phantom)
}

// ── the corners ────────────────────────────────────────────────────────

const HOUSE = '{"id":"kitchen","ord":"a0","title":"kitchen"}'
const GARDEN = '{"id":"garden","ord":"a0","title":"garden"}'

/**
 * A DIRECTORY WITH EVERY KIND IN IT, including the two path shapes that decide
 * whether a born key lands where the set puts it.
 *
 * `wing.olai` and `wing/kitchen.olai` are the pair a plain code-point sort and
 * `byPath` disagree about (`.` is 0x2E and `/` is 0x2F), and the projection now
 * finds a file by binary search over that order — so a set holding both is the
 * one corpus where a search using the wrong comparator would look in the wrong
 * half.
 */
const CORNERS: ReadonlyMap<string, string> = new Map([
  ["house.olai", HOUSE],
  ["garden.olai", GARDEN],
  ["wing.olai", '{"id":"wing","ord":"a0","title":"the wing"}'],
  ["wing/kitchen.olai", '{"id":"wingkitchen","ord":"a0","title":"the wing kitchen"}'],
  ["notes.md", "# hello"],
  ["report.html", ""],
  ["data/sales.csv", "a,b\n1,2"],
  ["art/handle.png", ""],
])

/**
 * ...and the edits, one revision each, every one of them a shape the generator
 * below reaches only by luck or not at all. The comment on a step is what it is
 * here for.
 */
const CORNER_STEPS: ReadonlyArray<Step> = [
  // A SAVE of an outline: its own collection and the heads move, the documents
  // hear nothing.
  { writes: [["house.olai", `${HOUSE}\n{"id":"sink","parent":"kitchen","ord":"a1","title":"sink"}`]] },
  // A SAVE of a `.md`: the documents and the heads move, the outlines hear
  // nothing — the mirror image, and the revision that used to rebuild all three.
  { writes: [["notes.md", "# hello again"]] },
  // A `.html` THAT CHANGED: its head is upserted and its documents entry is
  // withheld, because writing a `null` over a key somebody is showing would
  // blank the page. The body is owed instead.
  { writes: [["report.html", ""]] },
  // A FILE BORN INTO THE MIDDLE of the listing.
  { writes: [["shed.olai", '{"id":"shed","ord":"a0","title":"the shed"}']] },
  // ...AND ONE BORN BEFORE THE WHOLE VAULT, which is the placement a map that
  // appended would get wrong and a map that appended to the END of a
  // three-file set would still look right about.
  { writes: [["aaa.md", "# first of all"]] },
  // ...AND ONE AFTER ALL OF IT, so the arm that WOULD look right is exercised
  // beside the two that would not.
  { writes: [["zzz.olai", '{"id":"zzz","ord":"a0","title":"last of all"}']] },
  // A FILE THAT LEAVES.
  { deletes: ["garden.olai"] },
  // A FILE THAT BREAKS: it keeps its key, its records go, its errors arrive.
  { writes: [["house.olai", '{"id":"kitchen"']] },
  // ...and MENDS.
  { writes: [["house.olai", HOUSE]] },
  // A FILE THAT WILL NOT OPEN — the one breakage that reaches
  // `DocumentEntry.refused`, which no amount of bad JSONL produces.
  { writes: [["notes.md", REFUSED]] },
  // ...and opens again.
  { writes: [["notes.md", "# readable once more"]] },
  // A REVISION THAT MOVES NOTHING: every map is carried, every subscriber hears
  // nothing, and the two sides had better still agree about all of it.
  {},
  // THE `git pull` SHAPE: several files re-decoded, one born, one gone, in one
  // revision.
  {
    writes: [
      ["house.olai", `${HOUSE}\n{"id":"pantry","parent":"kitchen","ord":"a2","title":"pantry"}`],
      ["wing.olai", '{"id":"wing","ord":"a0","title":"the wing, rebuilt"}'],
      ["notes.md", "# pulled"],
      ["wing/attic.olai", '{"id":"attic","ord":"a0","title":"the attic"}'],
    ],
    deletes: ["shed.olai"],
  },
  // A PATH DELETED AND WRITTEN AGAIN, in two revisions: the second is a BIRTH
  // of a key the collection held a moment ago, which is the one case where
  // "was it there before?" and "is it there now?" answer differently.
  { deletes: ["aaa.md"] },
  { writes: [["aaa.md", "# back again"]] },
  // A DIRECTORY EMPTIED under a file of the same name — the byPath pair, taken
  // apart.
  { deletes: ["wing/kitchen.olai"] },
  // A RESYNC: the file goes and the store names NOBODY as removed, because the
  // stamp table the diff would have been taken against was thrown away first
  // (`Step.forgotten`). This is the one shape every corpus in this file missed
  // and an e2e scenario caught — a projection that trusts `removed` for
  // membership keeps the key for the life of the process.
  { forgotten: ["zzz.olai"] },
  // ...and the same for a bodied file, which is the other collection.
  { forgotten: ["data/sales.csv"] },
  // ...and one that leaves unannounced while another ARRIVES in the same
  // revision, so the file count does not move: the departure has to be caught
  // by the arriving key rather than by the count.
  { writes: [["late.olai", '{"id":"late","ord":"a0","title":"arrived"}']], forgotten: ["wing/attic.olai"] },
  // ...and a `.csv` and a picture, which are bodied files the set keeps nothing
  // of and which owe nobody a body.
  { writes: [["data/sales.csv", "a,b\n3,4"], ["art/handle.png", ""]] },
  { deletes: ["art/handle.png"] },
]

test("the corners a generator cannot reach publish the same frames", () => {
  holds(
    differential(CORNERS, CORNER_STEPS, publishedOf),
    { upserts: 20, removes: 3, reused: 10, rebuilt: 10, phantom: 3 },
  )
})

// ── size, and the shapes at rates ──────────────────────────────────────

/** A generated vault with the OTHER kinds beside the outlines — `vaultOf` mints
 *  `.olai` and nothing else, and a directory of nothing but outlines is one
 *  where the documents collection is empty and half the projection is never
 *  asked anything. */
const generated = (files: number, records: number): ReadonlyMap<string, string> => {
  const vault = new Map(vaultOf({ files, records }))
  for (let at = 0; at < files / 4; at++) {
    vault.set(`note${at}/page${at}.md`, `# page ${at}\n\nsome prose about the kitchen.\n`)
    if (at % 3 === 0) vault.set(`note${at}/saved${at}.html`, "")
    if (at % 5 === 0) vault.set(`note${at}/data${at}.csv`, "a,b\n1,2")
  }
  return vault
}

test("a generated vault under two hundred writes publishes the same frames", () => {
  const vault = generated(120, 20)
  const steps = stepsOver([...vault.keys()], { steps: 200 })
  // The corpus really is what it says: a run whose steps all landed on one file
  // would satisfy the floors below having exercised one shape.
  expect(vault.size).toBeGreaterThan(140)
  expect(steps.length).toBeGreaterThan(200)
  holds(
    differential(vault, steps, publishedOf),
    { upserts: 300, removes: 10, reused: 200, rebuilt: 40, phantom: 1 },
  )
})

// ── the real vault ─────────────────────────────────────────────────────

/**
 * `docs/`, from this file's own position in the tree — the same directory
 * `@olai/format`'s scope differential reads, and reached through the same
 * reader (`vaultAt`), so there is one answer here to "what files does a served
 * directory hold".
 *
 * A relative walk rather than a repository root resolved from git, because what
 * is wanted is the directory beside this package and not whatever a checkout
 * happens to be called.
 */
const DOCS = new URL("../../../docs", import.meta.url).pathname

test("this repository's own vault, edited, publishes the same frames", () => {
  const vault = vaultAt(DOCS)
  // A live directory, so nothing asserted here is about its contents — but a
  // run over an empty one would compare nothing, so the floor is about it being
  // a vault rather than about it being this one.
  expect(vault.size).toBeGreaterThan(10)
  holds(
    differential(vault, stepsOver([...vault.keys()], { steps: 80, seed: 77 }), publishedOf),
    { upserts: 100, removes: 3, reused: 80, rebuilt: 20, phantom: 1 },
  )
})

// ── the harness can see the hazard ─────────────────────────────────────

/**
 * THE MUTATION PROOF, and it is two of them because the harness makes two
 * claims and they are caught by different halves.
 *
 * A differential that never fails is a differential that proves nothing, and
 * "would it have caught the bug?" is not a question a reader should have to
 * answer by reading the comparator. So each failure a carried map makes
 * possible is injected into the projection and the harness is asserted to
 * report it, in the words it would use.
 */
test("a reused shell that swallows a delta is caught, and named", () => {
  const report = differential(CORNERS, CORNER_STEPS, swallowing(publishedOf))
  expect(report.divergences.length).toBeGreaterThan(0)
  // THE DELTA HALF is what sees it: the collection is internally consistent —
  // what it holds is exactly what it said — so `readAll` alone would go on
  // agreeing while a reader folding by identity quietly kept yesterday's file.
  expect(report.divergences.join("\n")).toContain("the delta a reader was offered")
  expect(report.divergences.join("\n")).toContain("the delta a reader accepted")
})

test("a born key appended rather than placed is caught by the snapshot alone", () => {
  const report = differential(CORNERS, CORNER_STEPS, misplacing(publishedOf))
  expect(report.divergences.length).toBeGreaterThan(0)
  // ...and by NOTHING ELSE. Not one delta differs — the frames are identical,
  // every value is right, and the only thing that moved is the order a FRESH
  // subscriber's snapshot arrives in. This is the mutant the `readAll` half of
  // the comparison exists for, and it is the failure this change actually
  // risks: `Map` appends, and the order of `entries` is the set's.
  expect(report.divergences.join("\n")).toContain("`readAll` of heads at the end")
  expect(report.divergences.join("\n")).not.toContain("the delta a reader")
})

test("the reference agrees with itself, so a divergence is never the harness", () => {
  // The control: the same corpus with the walk on both sides. A harness whose
  // comparator was itself order-sensitive in a way neither projection is would
  // report divergences here, and every case above would be measuring it.
  const report = differential(CORNERS, CORNER_STEPS, publishedAsWalked)
  expect(report.divergences).toEqual([])
  // ...and it reuses NOTHING, which is the other half of the control: the
  // counter that says the carrying happened is reading the candidate and not
  // something both sides do.
  expect(report.reused).toBe(0)
})

// ── a write that must produce a delta, produces it ─────────────────────

/**
 * THE INVALIDATION TEST, and it is not the differential's job: two projections
 * that both dropped a delta would agree perfectly. So this asks the production
 * door directly — after a write, is the file's entry NEW, is it upserted, and
 * is every neighbour's entry the very object it was published with?
 *
 * The identity half is the point. `rev` moving is easy to assert and easy to be
 * right about by accident; what a carried map risks is handing back the SHELL a
 * reader already has, and only `toBe` sees that.
 */
test("a write moves the file's entry and nothing else's, in every collection", () => {
  const revisions = revisionsOf(CORNERS, [
    { writes: [["house.olai", `${HOUSE}\n{"id":"sink","parent":"kitchen","ord":"a1","title":"sink"}`]] },
    { writes: [["notes.md", "# hello again"]] },
  ])
  const first = publishedOf(revisions[0]!, null)
  const wasHouse = first.outlines.entries.get("house.olai")
  const wasWing = first.outlines.entries.get("wing.olai")
  const wasNotesHead = first.heads.entries.get("notes.md")

  const second = publishedOf(revisions[1]!, first)
  // THE OUTLINE THAT MOVED: a delta, at the new revision, carrying an entry
  // that is not the one the wire holds.
  expect(second.outlines.upserts.map(([path]) => path)).toEqual(["house.olai"])
  expect(second.outlines.entries.get("house.olai")).not.toBe(wasHouse)
  expect(second.outlines.entries.get("house.olai")?.rev).toBe(2)
  expect(second.outlines.upserts[0]?.[1]).toBe(second.outlines.entries.get("house.olai")!)
  // ...and its HEAD, which is the member a reader watches for "the file moved".
  expect(second.heads.upserts.map(([path]) => path)).toEqual(["house.olai"])
  // THE NEIGHBOURS: the very objects, so a fold keyed on identity sees nothing
  // move — which is the whole reason an untouched file is not rebuilt.
  expect(second.outlines.entries.get("wing.olai")).toBe(wasWing!)
  expect(second.heads.entries.get("notes.md")).toBe(wasNotesHead!)
  expect(second.documents.upserts).toEqual([])

  const third = publishedOf(revisions[2]!, second)
  // THE DOCUMENT THAT MOVED, the other way round: its own collection and its
  // head, and the outlines hear nothing.
  expect(third.documents.upserts.map(([path]) => path)).toEqual(["notes.md"])
  expect(third.documents.entries.get("notes.md")?.text).toBe("# hello again")
  expect(third.heads.entries.get("notes.md")).not.toBe(wasNotesHead)
  expect(third.outlines.upserts).toEqual([])
})
