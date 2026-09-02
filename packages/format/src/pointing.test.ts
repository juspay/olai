/**
 * THE LINKS INDEX ≡ THE WALK IT REPLACED — over generated corpora and over this
 * repository's own `docs/`.
 *
 * Two claims, and they are separate:
 *
 *   1. **THE ANSWERS.** For every address a directory can be asked about, at
 *      every revision, `referrersTo` over the index is the very list the SCAN
 *      produced (`./pointing.testlib.ts`'s reference arm, which is that
 *      function as it was written before `perf-doc-backlinks-index`). Same
 *      referrers, same order, same attribution — a `.md` body's link coming
 *      back as the document's own and an outline's as the record that wrote it.
 *
 *   2. **THE MAINTENANCE.** At every revision, the index a reading CARRIED is
 *      the index a rebuild would have made — {@link pointingOf} over the set as
 *      it now stands. That is `./patch.test.ts`'s oracle, for the value one
 *      field over: the patch is an optimisation held to the definition, and
 *      what says the two are the same is a property test over corpora and over
 *      the edits that move a link.
 *
 * THE REVISIONS ARE DRIVEN THE WAY THE STORE DRIVES THEM. Each one assembles
 * the decoded files and calls `reading(set, { read: previous, delta })` — which
 * is the door `@olai/ops`' batch fold comes through and the same one `validate`
 * uses inside itself, so the index is carried exactly as production carries it.
 * The DECODE IS CACHED, like a probe's: a file nobody edited decodes to the
 * same object one revision later, which is what makes "an entry nothing touched
 * is carried by identity" a fact a case can check rather than a hope.
 *
 * WHAT IS NOT HERE is what the index MEANS. Which links count, what a `see` is,
 * whether a mirror can carry one, what the trash is left out of — those are
 * `./backlinks.test.ts`'s and `./document.test.ts`'s, against fixtures small
 * enough to write down. This file holds two implementations to one answer and
 * has no opinion about what the answer is.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import { addressOf, printAddress } from "./address.ts"
import { referrersTo } from "./backlinks.ts"
import type { Document } from "./document.ts"
import { type Verdict, verdictOf } from "./verdict.ts"
import { seeded } from "./fixtures.testlib.ts"
import { pointingOf } from "./pointing.ts"
import {
  addressesIn,
  facesIn,
  linkyRevisions,
  linkyVault,
  type Revision,
  sampledAddresses,
  scannedReferrers,
} from "./pointing.testlib.ts"
import { decodedVault, vaultAt } from "./scope.testlib.ts"
import { assemble, nodesIn, type OutlineSet } from "./set.ts"
import { type Reading, reading } from "./validate.ts"

/** What one replay found. Equality on the two lists is the gate; every other
 *  field is a claim that the gate was asked anything at all. */
interface Report {
  /** The whole point: an address whose two arms disagreed, and where. */
  readonly divergences: ReadonlyArray<string>
  /** Revisions where the carried index was not the rebuilt one. */
  readonly stale: ReadonlyArray<string>
  readonly revisions: number
  /** Addresses asked, and how many of those found a referrer at all — a floor,
   *  because a corpus nothing points at anywhere compares two empty lists a
   *  thousand times and says nothing while doing it. */
  readonly asked: number
  readonly hits: number
  /** Revisions where the index was handed on UNCLONED, because no face moved —
   *  what "an edit costs what it touched" means for this value, and a floor and
   *  a ceiling both: none of them means every revision pays the corpus, all of
   *  them means the stream never moved a link. */
  readonly carried: number
  /** Keys the index ever held, at its widest — the other non-vacuity floor. */
  readonly keys: number
}

/**
 * Replay a stream of revisions, comparing both claims at each.
 *
 * `every` is how much of the address list a revision asks about: all of it for
 * a generated corpus, a sample for a vault read off disk, where the walk arm is
 * the very cost this node is about and a thousand ids times a hundred revisions
 * is that cost paid by the suite.
 */
const replay = (revisions: Iterable<Revision>, every = 1): Report => {
  const divergences: Array<string> = []
  const stale: Array<string> = []
  const decoded = new Map<string, Result.Result<Document, Verdict>>()
  let held: Revision = new Map()
  let previous: Reading | null = null
  let revisionsSeen = 0
  let asked = 0
  let hits = 0
  let carried = 0
  let keys = 0
  for (const revision of revisions) {
    revisionsSeen++
    const changed: Array<string> = []
    const removes: Array<string> = []
    for (const file of held.keys()) {
      if (!revision.has(file)) {
        decoded.delete(file)
        removes.push(file)
      }
    }
    const moved = new Map<string, string>()
    for (const [file, text] of revision) {
      if (held.get(file) !== text) moved.set(file, text)
    }
    for (const [file, one] of decodedVault(moved)) {
      decoded.set(file, one)
      changed.push(file)
    }
    held = revision
    const set = assemble(decoded)
    const at: Reading = previous === null ? reading(set) : reading(set, {
      read: previous,
      delta: {
        upserts: changed.map((file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const),
        removes,
      },
    })
    if (previous !== null && at.pointing === previous.pointing) carried++
    keys = Math.max(keys, at.pointing.size)

    // (2) THE MAINTENANCE: what was carried is what a rebuild would have made.
    const rebuilt = pointingOf(set.documents)
    if (!sameIndex(at.pointing, rebuilt)) {
      stale.push(`revision ${revisionsSeen}: ${storyOf(at.pointing, rebuilt)}`)
    }

    // (1) THE ANSWERS: the index arm against the walk arm, per address.
    const faces = facesIn(set)
    for (const address of every === 1 ? addressesIn(set) : sampledAddresses(set, every)) {
      asked++
      const found = referrersTo(address, at.pointing, at.derived)
      const walked = scannedReferrers(address, faces, at.derived)
      if (found.length > 0) hits++
      if (!sameReferrers(found, walked)) {
        divergences.push(
          `revision ${revisionsSeen}, ${printAddress(address)}: ` +
            `index ${said(found)} vs scan ${said(walked)}`,
        )
      }
    }
    previous = at
  }
  return { divergences, stale, revisions: revisionsSeen, asked, hits, carried, keys }
}

/** Two answers, compared the way a page would tell them apart: which document,
 *  and which record inside it, IN ORDER — the promise both arms make. */
const said = (found: ReadonlyArray<{ face: { path: string }; at?: { node: { id: string } } }>) =>
  found.map((one) => `${one.face.path}${one.at === undefined ? "" : `#${one.at.node.id}`}`).join(",")

const sameReferrers = (
  found: ReadonlyArray<{ face: { path: string }; at?: { node: { id: string } } }>,
  walked: ReadonlyArray<{ face: { path: string }; at?: { node: { id: string } } }>,
): boolean => {
  if (said(found) !== said(walked)) return false
  // …and the FACES themselves, not only which files they name: a referrer row
  // draws a title, and an index that carried the right paths with a stale face
  // on one of them would pass the line above.
  return found.every((one, at) => sameFaceValue(one.face, walked[at]?.face))
}

const sameFaceValue = (one: unknown, other: unknown): boolean =>
  JSON.stringify(one) === JSON.stringify(other)

/**
 * The two indexes, compared for what they HOLD.
 *
 * BY SORTED KEY, and deliberately: this index promises its VALUES in path order
 * and nothing at all about its keys, which is exactly what lets the patch add
 * and drop them in place ({@link ./pointing.ts}). Comparing key order here would
 * be this test holding the patch to a promise the index does not make.
 *
 * A KEY LEFT HOLDING NOTHING IS A FAILURE, not a harmless one — `size` is
 * compared, so an emptied key left standing where a rebuild would have had none
 * is caught rather than hidden behind two equal answers.
 */
const sameIndex = (
  found: ReadonlyMap<string, ReadonlyArray<{ path: string }>>,
  rebuilt: ReadonlyMap<string, ReadonlyArray<{ path: string }>>,
): boolean => {
  if (found.size !== rebuilt.size) return false
  for (const [key, own] of found) {
    const other = rebuilt.get(key)
    if (other === undefined || own.length !== other.length) return false
    if (own.some((face, at) => JSON.stringify(face) !== JSON.stringify(other[at]))) return false
  }
  return true
}

/** …and when they differ, WHICH key did it, because a property test that says
 *  only "not equal" over generated input is a test nobody can act on. */
const storyOf = (
  found: ReadonlyMap<string, ReadonlyArray<{ path: string }>>,
  rebuilt: ReadonlyMap<string, ReadonlyArray<{ path: string }>>,
): string => {
  const keys = new Set([...found.keys(), ...rebuilt.keys()])
  const wrong: Array<string> = []
  for (const key of keys) {
    const own = found.get(key)
    const other = rebuilt.get(key)
    const one = own === undefined ? "absent" : own.map((face) => face.path).join(",")
    const two = other === undefined ? "absent" : other.map((face) => face.path).join(",")
    if (one !== two) wrong.push(`\`${key}\`: carried ${one} — rebuilt ${two}`)
  }
  return wrong.join("; ")
}

const REVISIONS = 300

test("the index answers what the scan answered, over generated corpora", () => {
  const random = seeded(20260825)
  const report = replay(linkyRevisions(linkyVault(), random, REVISIONS))
  expect(report.divergences).toEqual([])
  expect(report.stale).toEqual([])
  // The run was asked something. Floors rather than exact figures: the corpus
  // is a fixture and these are claims that it is not a directory of empty
  // files being compared with itself.
  expect(report.revisions).toBe(REVISIONS + 1)
  expect(report.asked).toBeGreaterThan(5_000)
  expect(report.hits).toBeGreaterThan(1_000)
  expect(report.keys).toBeGreaterThan(5)
  // …and it really was CARRIED rather than rebuilt: both bounds, because all
  // of them would mean the stream never moved a link and none of them would
  // mean every revision pays for the whole directory.
  expect(report.carried).toBeGreaterThan(20)
  expect(report.carried).toBeLessThan(REVISIONS)
})

test("…and over this repository's own docs/, edited", () => {
  const vault = vaultAt("docs")
  const random = seeded(20260826)
  // A REAL directory, and the edits are the ones this stream can make to one:
  // its own files, renamed, removed and written back. Nothing is asserted about
  // what it CONTAINS — the vault changes, and a differential compares two
  // answers and holds no opinion about either.
  const report = replay(linkyRevisions(vault, random, 60), 37)
  expect(report.divergences).toEqual([])
  expect(report.stale).toEqual([])
  expect(report.asked).toBeGreaterThan(500)
  expect(report.hits).toBeGreaterThan(50)
  expect(report.carried).toBeGreaterThan(3)
})

// ── the rules the index keeps, written down ────────────────────────────

const readingOfVault = (files: Record<string, string>): Reading =>
  reading(assemble(decodedVault(new Map(Object.entries(files)))))

/** What points at one address, said as `path#record` — through the grammar's
 *  own constructor, so a case names a place the way every reader of this format
 *  names one. */
const pointedAt = (at: Reading, path: string, element: string | null = null): string => {
  const address = addressOf(path === "" ? null : path, element)
  if (address === null) throw new Error(`\`${path}#${element ?? ""}\` is not an address`)
  return said(referrersTo(address, at.pointing, at.derived))
}

// A heading link is a reference to the heading AND to the document it is in,
// which is the one place this index files a link under two keys. The reverse
// does not hold, and the second half of this case is what says so.
test("a link onto a heading is filed under the heading and under the document", () => {
  const at = readingOfVault({
    "a.org": `{"id":"n","ord":"a0","title":"see [the scope](brief.md#scope)"}`,
    "brief.md": "# Brief\n\n## Scope\n\n## Risks\n",
  })
  expect(pointedAt(at, "brief.md")).toBe("a.org#n")
  expect(pointedAt(at, "brief.md", "scope")).toBe("a.org#n")
  // …and asking about the heading is asking about the heading.
  expect(pointedAt(at, "brief.md", "risks")).toBe("")
})

// A document that writes both spellings points at the document ONCE: what asks
// this wants to know which files to draw, and a file is one file however many
// ways it says the word.
test("a face writing a document and one of its headings is one referrer", () => {
  const at = readingOfVault({
    "notes.md": "# Notes\n\n[whole](brief.md) and [part](brief.md#scope)\n",
    "brief.md": "# Brief\n\n## Scope\n",
  })
  expect(pointedAt(at, "brief.md")).toBe("notes.md")
})

// The keys are the address WRITTEN, which is what lets the three arms of the
// grammar share one map: a path's `#` is escaped and an id's is not — and an id
// is a slug besides, so `#odd.md` names a FILE and `#odd` names a node, under
// two keys that no concatenation could have kept apart.
test("a path that starts with a `#` is filed apart from the node arm", () => {
  const at = readingOfVault({
    "a.org": [
      `{"id":"points","ord":"a0","title":"at the file","doc":"#odd.md"}`,
      `{"id":"odd","ord":"a1","title":"a node called odd"}`,
      `{"id":"names","ord":"a2","title":"at the node","see":["odd"]}`,
    ].join("\n"),
    "#odd.md": "# Odd\n",
  })
  expect(pointedAt(at, "#odd.md")).toBe("a.org#points")
  expect(pointedAt(at, "", "odd")).toBe("a.org#names")
})

// The members are in PATH ORDER, which is the order the set holds its documents
// in — inherited from the walk on a rebuild and sorted for on a patch, and the
// two have to agree.
test("the referrers come back in path order, whichever way the index got there", () => {
  const body = "# Note\n\n[to](../target.md)\n"
  const target = "# Target\n"
  const first = readingOfVault({
    "b/two.md": body,
    "target.md": target,
    "a/one.md": body,
  })
  expect(pointedAt(first, "target.md")).toBe("a/one.md,b/two.md")
  // …and the same set reached by a PATCH that adds the file sorting FIRST,
  // which is where a re-file that appended rather than sorted would show.
  const before = readingOfVault({ "b/two.md": body, "target.md": target })
  const after = reading(
    assemble(
      decodedVault(
        new Map([["b/two.md", body], ["target.md", target], ["a/one.md", body]]),
      ),
    ),
    { read: before, delta: { upserts: [["a/one.md", { nodes: [] }]], removes: [] } },
  )
  expect(pointedAt(after, "target.md")).toBe("a/one.md,b/two.md")
})

// A `.md` whose BODY changed and whose FACE did not is a file whose name, links,
// tags and properties are where they were — so the index hands its entry on
// UNTOUCHED, which is what keeps the page that read it from being redrawn.
test("a body write that leaves the face alone carries the index by reference", () => {
  const before = readingOfVault({
    "a.org": `{"id":"n","ord":"a0","title":"n","doc":"brief.md"}`,
    "brief.md": "# Brief\n\nthe first draft\n",
  })
  const files = decodedVault(
    new Map([
      ["a.org", `{"id":"n","ord":"a0","title":"n","doc":"brief.md"}`],
      ["brief.md", "# Brief\n\nthe second draft\n"],
    ]),
  )
  const after = reading(assemble(files), {
    read: before,
    delta: { upserts: [["brief.md", { nodes: [] }]], removes: [] },
  })
  // A DIFFERENT document object — the file really was re-decoded — and the same
  // index, by identity.
  expect(after.set.documents[1]).not.toBe(before.set.documents[1])
  expect(after.pointing).toBe(before.pointing)
  // …and the claim is not vacuous: the index has something in it to carry.
  expect(pointedAt(before, "brief.md")).toBe("a.org#n")
})

// …and the other side of the same rule: a body write that MOVES a link moves
// the index, and the key it left goes away rather than standing empty.
test("a body write that moves a link re-files it, and an emptied key goes away", () => {
  const before = readingOfVault({
    "notes.md": "# Notes\n\n[to](one.md)\n",
    "one.md": "# One\n",
    "two.md": "# Two\n",
  })
  expect(pointedAt(before, "one.md")).toBe("notes.md")
  const files = decodedVault(
    new Map([
      ["notes.md", "# Notes\n\n[to](two.md)\n"],
      ["one.md", "# One\n"],
      ["two.md", "# Two\n"],
    ]),
  )
  const after = reading(assemble(files), {
    read: before,
    delta: { upserts: [["notes.md", { nodes: [] }]], removes: [] },
  })
  expect(pointedAt(after, "one.md")).toBe("")
  expect(pointedAt(after, "two.md")).toBe("notes.md")
  // The key is GONE rather than holding an empty list, which is what a rebuild
  // would have and is the line another copy of this gets wrong.
  expect(after.pointing.has("one.md")).toBe(false)
})
