/**
 * THE TABLE'S ROW ENTRIES ≡ `namedBy`, AND ITS TAG ENTRIES ≡ `taggedBy` — over
 * generated directories, and over one written small enough to read.
 *
 * The one table ({@link ./pointing.ts}) files what the derivation's two reverse
 * indexes file, out of the same two functions: a record's fields are
 * {@link targetsOf} on both sides and a record's tags are {@link writtenTags} on
 * both sides. While the two live side by side, this is what says they agree —
 * the same ids, the same records, the same fields; the same tags, the same
 * records — so the readers that move from one to the other move to an answer
 * that was already proved to be the one they had.
 *
 * COMPARED AS SETS PER KEY, which is the promise both shapes make and no more:
 * `namedBy` holds one entry per record with the fields it named the id with,
 * and the table holds one source per record per key with the ways it says it.
 * Nothing here compares key ORDER — neither value promises one — and nothing
 * compares the ways the table files that are not fields: a link onto a row is
 * in the table's `rows` part and has never been in `namedBy`.
 *
 * THE TABLE IS READ AS A REVISION CARRIED IT, not as a rebuild made it: the
 * streams below replay their edits through the same door the store comes
 * through, so a carry that dropped a field entry fails here as well as in
 * `./pointing.test.ts`'s differential.
 *
 * WHAT IS NOT HERE is what either value MEANS — which fields exist, what a
 * mirror is, which tags count as references. Those are `./derive.test.ts`'s and
 * `./backlinks.test.ts`'s. This file holds two shapes to one answer.
 */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { addressOf } from "./address.ts"
import { referencesOf } from "./backlinks.ts"
import { type Document } from "./document.ts"
import { seeded, settled, vaultOf } from "./fixtures.testlib.ts"
import { linkyRevisions, linkyVault, type Revision } from "./pointing.testlib.ts"
import { decodedVault } from "./scope.testlib.ts"
import { assemble, nodesIn } from "./set.ts"
import { type Reading, reading } from "./validate.ts"
import { type Verdict } from "./verdict.ts"

/** The ways that are a record naming another by a FIELD — the four
 *  {@link targetsOf} answers with, which are what `namedBy` holds. */
const FIELDS = ["mirror", "after", "blocks", "see"] as const

/** One record, said the way both shapes can say it: where it is written. A
 *  file and a line name one record in a set, and two records of one file can
 *  never share a line. */
const recordSaid = (file: string, line: number, fields: ReadonlyArray<string>): string =>
  `${file}:${line} ${fields.join("+")}`

/** The table's ROWS part, as what names each id with a field. */
const tableNamings = (at: Reading): ReadonlyMap<string, ReadonlySet<string>> => {
  const found = new Map<string, Set<string>>()
  for (const [id, sources] of at.pointing.rows) {
    for (const source of sources) {
      // A BODY'S LINK onto a row is a source here and was never a naming: the
      // fields are a record's, and a `.md` has none.
      if (source.at === undefined) continue
      const fields = FIELDS.filter((field) => source.ways.includes(field))
      if (fields.length === 0) continue
      const held = found.get(id) ?? new Set<string>()
      held.add(recordSaid(source.at.file, source.at.line, fields))
      found.set(id, held)
    }
  }
  return found
}

/** …and `Derived.namedBy`, said the same way. */
const derivedNamings = (at: Reading): ReadonlyMap<string, ReadonlySet<string>> => {
  const found = new Map<string, Set<string>>()
  for (const [id, namings] of at.derived.namedBy) {
    const held = new Set<string>()
    for (const naming of namings) {
      held.add(recordSaid(naming.at.file, naming.at.line, FIELDS.filter((field) => naming.fields.includes(field))))
    }
    found.set(id, held)
  }
  return found
}

/** The table's TAGS part, as the records that WRITE each tag — the `tag` way,
 *  which is the records' own prose; a body's `@` mention is filed there too,
 *  with the way `mention`, and `taggedBy` has never held one. */
const tableTaggings = (at: Reading): ReadonlyMap<string, ReadonlySet<string>> => {
  const found = new Map<string, Set<string>>()
  for (const [tag, sources] of at.pointing.tags) {
    for (const source of sources) {
      if (source.at === undefined || !source.ways.includes("tag")) continue
      const held = found.get(tag) ?? new Set<string>()
      held.add(`${source.at.file}:${source.at.line}`)
      found.set(tag, held)
    }
  }
  return found
}

/** …and `Derived.taggedBy`, said the same way. */
const derivedTaggings = (at: Reading): ReadonlyMap<string, ReadonlySet<string>> => {
  const found = new Map<string, Set<string>>()
  for (const [tag, records] of at.derived.taggedBy) {
    found.set(tag, new Set(records.map((located) => `${located.file}:${located.line}`)))
  }
  return found
}

/** Where two of those disagree, and about what — a property test that said only
 *  "not equal" over a generated corpus is one nobody can act on. */
const differences = (
  found: ReadonlyMap<string, ReadonlySet<string>>,
  wanted: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyArray<string> => {
  const wrong: Array<string> = []
  for (const key of new Set([...found.keys(), ...wanted.keys()])) {
    const one = [...(found.get(key) ?? [])].sort().join(", ")
    const other = [...(wanted.get(key) ?? [])].sort().join(", ")
    if (one !== other) wrong.push(`\`${key}\`: table ${one || "nothing"} — derivation ${other || "nothing"}`)
  }
  return wrong
}

/** What one replay found: the disagreements, and the floors that say the run
 *  was asked anything at all. */
interface Report {
  readonly wrong: ReadonlyArray<string>
  readonly revisions: number
  /** Ids the table filed a field entry under, at its widest. */
  readonly ids: number
  readonly tags: number
  /** Which of the four field ways the corpus actually exercised — a corpus
   *  that writes no `blocks` proves nothing about `blocks`. */
  readonly fields: ReadonlySet<string>
}

/**
 * Replay a stream of revisions through the store's own door — each reading
 * follows the one before it, with the delta the probe would have sent — and
 * compare the two shapes at every one of them.
 */
const replay = (revisions: Iterable<Revision>): Report => {
  const wrong: Array<string> = []
  const decoded = new Map<string, Result.Result<Document, Verdict>>()
  const fields = new Set<string>()
  let held: Revision = new Map()
  let previous: Reading | null = null
  let revisionsSeen = 0
  let ids = 0
  let tags = 0
  for (const revision of revisions) {
    revisionsSeen++
    const removes: Array<string> = []
    for (const file of held.keys()) {
      if (revision.has(file)) continue
      decoded.delete(file)
      removes.push(file)
    }
    const moved = new Map<string, string>()
    for (const [file, text] of revision) if (held.get(file) !== text) moved.set(file, text)
    const changed: Array<string> = []
    for (const [file, one] of decodedVault(moved)) {
      decoded.set(file, one)
      changed.push(file)
    }
    held = revision
    const set = assemble(TEST_CLAIMS, decoded)
    const at: Reading = previous === null ? reading(TEST_CLAIMS, set) : reading(TEST_CLAIMS, set, {
      read: previous,
      delta: {
        upserts: changed.map((file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const),
        removes,
      },
    })
    const namings = tableNamings(at)
    const taggings = tableTaggings(at)
    ids = Math.max(ids, namings.size)
    tags = Math.max(tags, taggings.size)
    for (const own of namings.values()) {
      for (const said of own) for (const field of FIELDS) if (said.includes(field)) fields.add(field)
    }
    for (const said of differences(namings, derivedNamings(at))) {
      wrong.push(`revision ${revisionsSeen}, rows: ${said}`)
    }
    for (const said of differences(taggings, derivedTaggings(at))) {
      wrong.push(`revision ${revisionsSeen}, tags: ${said}`)
    }
    previous = at
  }
  return { wrong, revisions: revisionsSeen, ids, tags, fields }
}

// The corpus with links in every shape the format has — `see` edges, mirrors,
// title and note links, wikilinks and bodies — edited by the stream that moves
// a link, renames a file, removes one and brings it back.
test("the table's rows are `namedBy` and its tags are `taggedBy`, over the linky corpus", () => {
  const report = replay(linkyRevisions(linkyVault(), seeded(20260825), 60))
  expect(report.wrong).toEqual([])
  expect(report.revisions).toBe(61)
  expect(report.ids).toBeGreaterThan(3)
  // The ways this corpus is written in: a `see` on a fifth of its records, and
  // a placement on a tenth of them.
  expect([...report.fields].sort()).toEqual(["mirror", "see"])
})

// …and the vault the patcher's and the tag index's benches run on, which is
// written the other way round: `after` edges, placements reaching into the file
// before, `#topic` tags in titles and `@id` mentions in notes.
test("the table's rows are `namedBy` and its tags are `taggedBy`, over the generated vault", () => {
  const vault = settled(vaultOf({ files: 40, records: 12 }))
  const report = replay([vault])
  expect(report.wrong).toEqual([])
  expect(report.ids).toBeGreaterThan(20)
  expect(report.tags).toBeGreaterThan(5)
  expect([...report.fields].sort()).toEqual(["after", "mirror"])
})

// ── one directory, written down ────────────────────────────────────────

/** A house and a garden: every field a record can name another with, both tag
 *  sigils, in a title and in a note, and a `.md` that writes the same words in
 *  prose. Small enough to say what every entry of the table should be. */
const HOUSE: Revision = new Map([
  [
    "house.olai",
    [
      `{"id":"kitchen","ord":"a0","title":"the kitchen #upkeep"}`,
      `{"id":"tap","ord":"a1","parent":"kitchen","title":"fix the dripping tap","after":["kitchen"],"blocks":["beds"],"desc":"ask @gardener about the washer"}`,
      `{"id":"shelf","ord":"a2","parent":"kitchen","title":"a shelf for the jars #upkeep","see":["beds"],"blocks":["kitchen"]}`,
      `{"id":"standing","ord":"a3","mirror":"beds"}`,
    ].join("\n"),
  ],
  [
    "garden.olai",
    [
      `{"id":"beds","ord":"a0","title":"the raised beds #upkeep"}`,
      `{"id":"herbs","ord":"a1","parent":"beds","title":"herbs by the door @gardener","see":["tap"],"after":["beds"]}`,
    ].join("\n"),
  ],
  [
    "notes.md",
    "# The house\n\n@gardener keeps the #upkeep list, and the [kitchen](house.olai#kitchen) wants a shelf.\n",
  ],
])

const readingOf = (revision: Revision): Reading =>
  reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decodedVault(new Map(revision))))

/** What the table's rows hold under one id, as `file:line way+way`. */
const rowsAt = (at: Reading, id: string): ReadonlyArray<string> =>
  (at.pointing.rows.get(id) ?? []).map((source) =>
    `${source.at === undefined ? source.face.path : `${source.at.file}:${source.at.line}`} ${source.ways.join("+")}`
  )

/** …and what the tags part holds under one tag. */
const tagsAt = (at: Reading, tag: string): ReadonlyArray<string> =>
  (at.pointing.tags.get(tag) ?? []).map((source) =>
    `${source.at === undefined ? source.face.path : `${source.at.file}:${source.at.line}`} ${source.ways.join("+")}`
  )

/** Who **Referenced by** lists for a node, as `file#id` or a path. */
const referrersOf = (at: Reading, id: string): ReadonlyArray<string> =>
  referencesOf(at, addressOf(TEST_CLAIMS, null, id)!).map((one) =>
    "path" in one.source ? `${String(one.source.path)} ${one.ways.join("+")}` : `${one.source.file}#${one.source.node.id} ${one.ways.join("+")}`
  )

test("every field a record names a row with is in the table's rows, under the row's id", () => {
  const at = readingOf(HOUSE)
  // The four fields, each under the id it names: the placement with `mirror`,
  // the two ordering fields, and the `see`.
  expect(rowsAt(at, "beds")).toEqual([
    "garden.olai:2 after",
    "house.olai:2 blocks",
    "house.olai:3 see",
    "house.olai:4 mirror",
  ])
  // …and one record naming one id with two fields is ONE source with two ways,
  // which is `namedBy`'s own rule read through the table.
  expect(rowsAt(at, "kitchen")).toEqual([
    "house.olai:2 after",
    "house.olai:3 blocks",
    "notes.md link",
  ])
  expect(rowsAt(at, "tap")).toEqual(["garden.olai:2 see"])
  // …and the whole of it is `namedBy`, which is where `blocks` — the field
  // neither generated corpus writes — is held to the derivation's own answer.
  expect(differences(tableNamings(at), derivedNamings(at))).toEqual([])
})

test("a record's tags are in the table's tags with the way `tag`, and a body's `@` is a mention", () => {
  const at = readingOf(HOUSE)
  // BOTH SIGILS from a record, title and note alike — the whole of what
  // `taggedBy` holds, in the table's own shape.
  expect(tagsAt(at, "#upkeep")).toEqual([
    "garden.olai:1 tag",
    "house.olai:1 tag",
    "house.olai:3 tag",
  ])
  expect(tagsAt(at, "@gardener")).toEqual([
    "garden.olai:2 tag",
    "house.olai:2 tag",
    "notes.md mention",
  ])
  // A BODY'S `#topic` IS FILED NOWHERE, exactly as `taggedBy` holds none: the
  // tag list is a promise about rows, and `notes.md` writes `#upkeep` in prose.
  expect(tagsAt(at, "#upkeep").some((said) => said.startsWith("notes.md"))).toBe(false)
  expect(differences(tableTaggings(at), derivedTaggings(at))).toEqual([])
})

test("the new ways are filed and not counted: Referenced by says what it always said", () => {
  const at = readingOf(HOUSE)
  // `beds` is named by an `after`, a `blocks`, a `see` and a placement. Only
  // the `see` is a thing somebody SAID about it.
  expect(referrersOf(at, "beds")).toEqual(["house.olai#shelf see"])
  // …and `kitchen` is ordered by two records of its own file and linked by one
  // body: the link counts, the ordering does not.
  expect(referrersOf(at, "kitchen")).toEqual(["notes.md link"])
  // A `see` and a mention from one record is one referrer with two ways, which
  // is the merge the reading does across two parts of the table.
  expect(referrersOf(at, "tap")).toEqual(["garden.olai#herbs see"])
})
