/**
 * THE TABLE ≡ WHAT THE RECORDS SAY — its row entries against {@link targetsOf}
 * read forwards, its tag entries against {@link writtenTags}, over generated
 * directories and over one written small enough to read.
 *
 * The one table ({@link ./pointing.ts}) is a fold over the DOCUMENTS of a set;
 * what it files under a row and under a tag is what the records themselves say,
 * read backwards. This file holds the two together: a walk of every record on
 * one side, the table's own parts on the other, at every revision of a stream.
 * It is the shape `../patch.test.ts` has with `derive` — a walk is the
 * definition and the fold is the optimisation — for the value that used to be
 * two indexes on the derivation and is now one table beside it.
 *
 * COMPARED AS SETS PER KEY, which is the promise the table makes and no more:
 * one source per record per key, with the ways it says it. Nothing here
 * compares key ORDER — the table promises none — and nothing compares the ways
 * that are not a record's fields: a link onto a row is in the `rows` part too,
 * and a link is not a relation.
 *
 * THE TABLE IS READ AS A REVISION CARRIED IT, not as a rebuild made it: the
 * streams below replay their edits through the same door the store comes
 * through, so a carry that dropped a field entry fails here as well as in
 * `./pointing.test.ts`'s differential.
 *
 * WHAT IS NOT HERE is what any of it MEANS — which fields exist, what a mirror
 * is, which tags count as references. Those are `../derive.test.ts`'s and
 * `./referring.test.ts`'s. This file holds two readings to one answer.
 */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { addressOf } from "../address.ts"
import { referencesOf } from "./referring.ts"
import { derive, writtenTags } from "../derive.ts"
import { type Document } from "../document.ts"
import { FIXTURE_FILE, nodesOf, seeded, settled, vaultOf } from "../fixtures.testlib.ts"
import { targetsOf } from "../node.ts"
import { namersOf, type Pointing, pointingOf, propertied, type Source, taggersOf } from "./pointing.ts"
import { PARTS } from "./written.ts"
import { referenceKeys } from "../typing.ts"
import { linkyRevisions, linkyVault, type Revision } from "./pointing.testlib.ts"
import { decodedVault } from "../scope.testlib.ts"
import { assemble, nodesIn } from "../set.ts"
import { type Reading, reading } from "../validate.ts"
import { type Verdict } from "../verdict.ts"

/** The ways that are a record naming another by a FIELD — the four
 *  {@link targetsOf} answers with. */
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

/** …and the same thing read FORWARDS: every record of the set, through
 *  {@link targetsOf}, with a record naming one id twice folded into one entry
 *  the way the fold folds it. The independent arm — a walk of the records,
 *  where the table is a fold over the documents. */
const walkedNamings = (at: Reading): ReadonlyMap<string, ReadonlySet<string>> => {
  const found = new Map<string, Set<string>>()
  for (const located of at.derived.nodes) {
    const fields = new Map<string, Set<string>>()
    for (const [field, id] of targetsOf(located.node)) {
      const own = fields.get(id) ?? new Set<string>()
      own.add(field)
      fields.set(id, own)
    }
    for (const [id, own] of fields) {
      const held = found.get(id) ?? new Set<string>()
      held.add(recordSaid(located.file, located.line, FIELDS.filter((field) => own.has(field))))
      found.set(id, held)
    }
  }
  return found
}

/** The table's TAGS part, as the records that WRITE each tag — the `tag` way,
 *  which is the records' own prose; a body's `@` mention is filed there too,
 *  with the way `mention`, which is no `tag` entry. */
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

/** …and the same thing read FORWARDS: every record's own prose, through
 *  {@link writtenTags}, which is what a tag the fold filed has to be. */
const walkedTaggings = (at: Reading): ReadonlyMap<string, ReadonlySet<string>> => {
  const found = new Map<string, Set<string>>()
  for (const located of at.derived.nodes) {
    for (const tag of writtenTags(located.node)) {
      const held = found.get(tag) ?? new Set<string>()
      held.add(`${located.file}:${located.line}`)
      found.set(tag, held)
    }
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
    if (one !== other) wrong.push(`\`${key}\`: table ${one || "nothing"} — records ${other || "nothing"}`)
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
    for (const said of differences(namings, walkedNamings(at))) {
      wrong.push(`revision ${revisionsSeen}, rows: ${said}`)
    }
    for (const said of differences(taggings, walkedTaggings(at))) {
      wrong.push(`revision ${revisionsSeen}, tags: ${said}`)
    }
    previous = at
  }
  return { wrong, revisions: revisionsSeen, ids, tags, fields }
}

// The corpus with links in every shape the format has — `see` edges, mirrors,
// title and note links, wikilinks and bodies — edited by the stream that moves
// a link, renames a file, removes one and brings it back.
test("the table's rows and tags are what the records say, over the linky corpus", () => {
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
test("the table's rows and tags are what the records say, over the generated vault", () => {
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
  // which is the one rule for a record's fields, read through the table.
  expect(rowsAt(at, "kitchen")).toEqual([
    "house.olai:2 after",
    "house.olai:3 blocks",
    "notes.md link",
  ])
  expect(rowsAt(at, "tap")).toEqual(["garden.olai:2 see"])
  // …and the whole of it is `targetsOf` read forwards, which is where `blocks`
  // — the field neither generated corpus writes — is held to the records' own
  // answer.
  expect(differences(tableNamings(at), walkedNamings(at))).toEqual([])
})

test("a record's tags are in the table's tags with the way `tag`, and a body's `@` is a mention", () => {
  const at = readingOf(HOUSE)
  // BOTH SIGILS from a record, title and note alike — the whole of what the
  // records' prose writes, in the table's own shape.
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
  // A BODY'S `#topic` IS FILED NOWHERE as a `tag`: the
  // tag list is a promise about rows, and `notes.md` writes `#upkeep` in prose.
  expect(tagsAt(at, "#upkeep").some((said) => said.startsWith("notes.md"))).toBe(false)
  expect(differences(tableTaggings(at), walkedTaggings(at))).toEqual([])
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

// ── the tags part across a carry ───────────────────────────────────────
//
// What the derivation's tag index was held to while it existed, asked of the
// table that holds those entries now and of the CARRY that moves them: a word
// typed into a note has to appear under a key nothing else in the revision
// mentions, and taking it out has to leave no key standing. The carry is
// `repointed` over the two sets, which is the step a revision really takes
// ({@link ../validate.ts}).

/** The table one corpus leaves, and the table a carry makes of the next —
 *  held to a rebuild of the same corpus, so a case says what moved and the
 *  carry is checked while it says it.
 *
 *  THROUGH THE READING DOOR, which is the step a revision really takes: both
 *  of the table's passes run in the order {@link ../validate.ts} runs them, so
 *  a property entry — filed after the derivation, off the declarations — is
 *  carried here exactly as the store carries it. The delta names every file of
 *  the new corpus, which is the widest a probe can send and the one a test
 *  need not reconstruct. */
const carried = (before: Revision, after: Revision): { readonly table: Pointing; readonly rebuilt: Pointing } => {
  const was = assemble(TEST_CLAIMS, decodedVault(new Map(before)))
  const decoded = decodedVault(new Map(after))
  const now = assemble(TEST_CLAIMS, decoded)
  const read = reading(TEST_CLAIMS, was)
  return {
    table: reading(TEST_CLAIMS, now, {
      read,
      delta: {
        upserts: [...decoded.keys()].map((file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const),
        removes: [...before.keys()].filter((file) => !after.has(file)),
      },
    }).pointing,
    rebuilt: reading(TEST_CLAIMS, now).pointing,
  }
}

/** The records filed under one tag with the way `tag`, as their ids. */
const taggedWith = (table: Pointing, tag: string): ReadonlyArray<string> =>
  taggersOf(table, tag).map((at) => at.node.id)

const QUIET: Revision = new Map([
  ["a.olai", `{"id":"cook","ord":"a","title":"cook"}`],
  ["b.olai", `{"id":"note","ord":"a","title":"a note"}`],
])

const writing = (corpus: Revision, file: string, text: string): Revision =>
  new Map([...corpus, [file, text]])

test("a word typed into a note reaches the table, and taking it out empties the key", () => {
  const said = writing(QUIET, "b.olai", `{"id":"note","ord":"a","title":"a note","desc":"see @cook first"}`)
  const there = carried(QUIET, said)
  expect(taggedWith(there.table, "@cook")).toEqual(["note"])
  expect(taggedWith(there.rebuilt, "@cook")).toEqual(["note"])

  // ...and out again. A key nothing says any more GOES, rather than standing
  // empty where a rebuild would have had no key at all.
  const quiet = carried(said, QUIET)
  expect(quiet.table.tags.has("@cook")).toBe(false)
  expect(quiet.rebuilt.tags.has("@cook")).toBe(false)
})

test("one record writing a tag twice is one entry, in the title and in the note", () => {
  const both = writing(QUIET, "b.olai", `{"id":"note","ord":"a","title":"about @cook","desc":"and again: @cook"}`)
  const there = carried(QUIET, both)
  expect(taggedWith(there.table, "@cook")).toEqual(["note"])
  expect(there.table.tags.get("@cook")?.length).toBe(1)
})

// A carry that moved `#cook` and `@cook` as one key would answer both of these
// with the same list, and a rebuild would agree with it — the fold would have
// collided them too. So the assertion is on the KEYS, and it is here rather
// than left to a generator because it is the whole reason this part is keyed by
// the written form.
test("the two sigils are two keys, and an edit moves only the one it wrote", () => {
  const both: Revision = new Map([
    ["a.olai", `{"id":"cook","ord":"a","title":"cook"}`],
    ["b.olai", `{"id":"topic","ord":"a","title":"about #cook"}`],
    ["deep/c.olai", `{"id":"note","ord":"a","title":"ask @cook"}`],
  ])
  const table = pointingOf(TEST_CLAIMS, assemble(TEST_CLAIMS, decodedVault(new Map(both))).documents)
  expect(taggedWith(table, "#cook")).toEqual(["topic"])
  expect(taggedWith(table, "@cook")).toEqual(["note"])

  const quiet = carried(both, writing(both, "b.olai", `{"id":"topic","ord":"a","title":"about nothing"}`))
  expect(quiet.table.tags.has("#cook")).toBe(false)
  // The mention is in a file the revision never touched, and it is still filed.
  expect(taggedWith(quiet.table, "@cook")).toEqual(["note"])
})

// ── what the table files, written down ─────────────────────────────────
//
// The cases the derivation's two reverse indexes were held to while they
// existed, asked of the table that holds those entries now. They moved
// verbatim in what they assert: the same fixtures, the same answers, read
// through `namersOf` and the `tag` way instead of through `namedBy` and
// `taggedBy`.

/** One file's records, as the table over them. */
const filed = (contents: string): Pointing =>
  pointingOf(
    TEST_CLAIMS,
    assemble(TEST_CLAIMS, decodedVault(new Map([[FIXTURE_FILE, contents]]))).documents,
  )

/** What the table says about an id, as `record field,field` per namer — one
 *  string rather than a nested literal, so what an assertion is about is the
 *  records and their reasons rather than the shape they arrive in. */
const namers = (table: Pointing, id: string): ReadonlyArray<string> =>
  namersOf(table, id).map((one) => `${one.at.node.id} ${one.fields.join(",")}`)

// The rows part is the format's own `targetsOf` read backwards, and it is RAW
// — what the records SAY, before a chain is followed or `blocks` is normalised
// into `after`. That is the point of it being filed at all beside the
// canonical maps: the ops layer refuses to retire a placement something still
// names, and those maps have filed every one of those edges at the node the
// placement shows, where a refusal about the PLACEMENT could never find them.
test("a record is filed under the id it wrote, not the node that id means", () => {
  const contents = `{"id":"x","ord":"a","title":"x"}\n` +
    `{"id":"m","ord":"b","mirror":"x"}\n` +
    `{"id":"a","ord":"c","title":"a","after":["m"],"see":["m"]}\n` +
    `{"id":"b","ord":"d","title":"b","blocks":["m"]}`
  const table = filed(contents)
  // One entry per RECORD, with the fields in declaration order: a node naming
  // the same id twice is one dependent with two reasons, not two dependents.
  expect(namers(table, "m")).toEqual(["a after,see", "b blocks"])
  // `see` is in here and in nothing else — no derivation reads it, and a
  // reverse reading that left it out would let a write land that should not.
  expect(derive(TEST_CLAIMS, nodesOf(contents)).edgesTo.has("m")).toBe(false)
  // The placement's own claim on the node it shows is an entry like any other.
  expect(namers(table, "x")).toEqual(["m mirror"])
})

// One field naming an id twice is still one field: a reader listing it twice
// would be reporting the shape of the file rather than what it means.
test("a field naming the same id twice is named once", () => {
  const table = filed(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"a","ord":"b","title":"a","after":["x","x"],"see":["x"]}`,
  )
  expect(namers(table, "x")).toEqual(["a after,see"])
})

// The tags part is keyed by a TAG rather than by an id: what a title or a note
// writes after a sigil, filed exactly as it is written. Whether an `@` tag
// names a node — whether the mention is a REFERENCE — is asked at the read
// (`./referring.ts`), so that minting a node does not have to re-walk every
// note in the directory.
test("a tag is filed under the tag as written, in prose of either kind", () => {
  const table = filed(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"a","ord":"b","title":"about @x"}\n` +
      `{"id":"b","ord":"c","title":"b","desc":"and @x again, and @alice"}`,
  )
  expect(taggedWith(table, "@x")).toEqual(["a", "b"])
  // A word nothing declares files exactly the same way: this part is about
  // what the prose SAYS, and `@alice` is a tag until somebody is called that.
  expect(taggedWith(table, "@alice")).toEqual(["b"])
})

// The keys used to be sigil-stripped, so a topic and a mention spelled the
// same word were one entry and neither reader could tell them apart.
test("a `#topic` and an `@person` spelled alike are two keys", () => {
  const table = filed(
    `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"a","ord":"b","title":"ask @herbs"}\n` +
      `{"id":"b","ord":"c","title":"filed under #herbs"}`,
  )
  expect(taggedWith(table, "@herbs")).toEqual(["a"])
  expect(taggedWith(table, "#herbs")).toEqual(["b"])
  // ...and the bare word is neither of them, which is what a stripped key was.
  expect(table.tags.has("herbs")).toBe(false)
})

test("a record writing one tag twice is one entry of it", () => {
  const table = filed(
    `{"id":"x","ord":"a","title":"x"}\n` +
      `{"id":"a","ord":"b","title":"@x and @x","desc":"still @x"}`,
  )
  expect(taggedWith(table, "@x")).toEqual(["a"])
})

test("a mirror tags nothing, having no prose to tag with", () => {
  const table = filed(`{"id":"x","ord":"a","title":"x"}\n{"id":"m","ord":"b","mirror":"x"}`)
  expect(table.tags.size).toBe(0)
})

test("the alphabet is the title's own, and a sigil inside a word starts nothing", () => {
  const table = filed(
    `{"id":"a","ord":"a","title":"write to sam@herbs.example"}\n` +
      `{"id":"b","ord":"b","title":"filed under #herbs"}\n` +
      `{"id":"c","ord":"c","title":"(@herbs) and @work/olai"}`,
  )
  // The bracket opens a word, the `.` ends one, and `/` is part of a tag name
  // — `titleTagRe`'s rules, inherited rather than restated here. The `#` in the
  // middle record is claimed wherever it is written, which is the asymmetry
  // that regex owns and this part inherits whole.
  expect(taggedWith(table, "@herbs")).toEqual(["c"])
  expect(taggedWith(table, "#herbs")).toEqual(["b"])
  expect(taggedWith(table, "@work/olai")).toEqual(["c"])
})

// ── the property entries, and the step that files them ─────────────────
//
// The table's SECOND step ({@link ./pointing.ts}): a value under a key this
// vault declares `doc`, `ref` or `node` names a file or a row, and which keys
// those are is read off the derivation — so the entries are filed after it,
// and re-filed when a file moves OR when the declarations themselves do. What
// is held here is that the carry and a rebuild agree in BOTH cases, which the
// first step's own differential cannot reach: a revision that changes only a
// declaration moves no file at all.

/** A vault that declares one referring key, the record that writes a value
 *  under it, and a `.md` for a `doc` value to name. */
const DECLARING: Revision = new Map([
  ["_olai/Properties.olai", `{"id":"prop-bed","ord":"a0","title":"bed","custom":{"type":"node"}}`],
  ["garden.olai", `{"id":"herbs","ord":"a0","title":"the herb bed"}`],
  ["notes.olai", `{"id":"sowing","ord":"a0","title":"sowing notes","custom":{"bed":"herbs"}}`],
  ["brief.md", "# The brief\n\nnothing points anywhere.\n"],
])

/** The declared property keys one entry was filed with, or `undefined` where
 *  the entry is not one a declared value wrote — which is what the table's
 *  arms say and these readings tell apart. */
const propsOf = (source: Source | undefined): ReadonlyArray<string> | undefined =>
  source?.counts === "outright" ? source.props : undefined

/** Those keys as both printers below say them: nothing at all for a source
 *  that named its target another way. */
const keysOf = (source: Source): string => {
  const props = propsOf(source)
  return props === undefined || props.length === 0 ? "" : ` [${props.join(",")}]`
}

/** The whole table, written down — every entry of every part, so a carry that
 *  differs from a rebuild anywhere says where. */
const wholeOf = (table: Pointing): ReadonlyArray<string> =>
  PARTS.flatMap((part) =>
    [...table[part]].map(([key, sources]) =>
      `${part} ${key}: ${
        sources.map((source) =>
          `${source.at === undefined ? source.face.path : `${source.at.file}:${source.at.line}`}` +
          ` ${source.ways.join("+")}${keysOf(source)}`
        ).join(", ")
      }`
    ).sort()
  )

/** What the table's FILES part holds under one path, the way {@link rowsAt}
 *  reads the rows. */
const filesAt = (at: Reading, path: string): ReadonlyArray<string> =>
  (at.pointing.files.get(path) ?? []).map((source) =>
    `${source.at === undefined ? source.face.path : `${source.at.file}:${source.at.line}`} ${
      source.ways.join("+")
    }${keysOf(source)}`
  )

test("a declared `node` value is filed under the row it names, with the way `property`", () => {
  const at = readingOf(DECLARING)
  expect(rowsAt(at, "herbs")).toEqual(["notes.olai:1 property"])
  expect(propsOf(at.pointing.rows.get("herbs")?.[0])).toEqual(["bed"])
  // …and **Referenced by** counts it, which is the behaviour this stage adds.
  expect(referrersOf(at, "herbs")).toEqual(["notes.olai#sowing property"])
})

test("a declared `doc` value is filed under the file it resolves to", () => {
  const at = readingOf(
    writing(
      writing(
        DECLARING,
        "_olai/Properties.olai",
        `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc"}}`,
      ),
      "notes.olai",
      `{"id":"sowing","ord":"a0","title":"sowing notes","custom":{"brief":"brief.md"}}`,
    ),
  )
  expect(filesAt(at, "brief.md")).toEqual(["notes.olai:1 property [brief]"])
  // A key nobody declared names nothing: the same value under `note` is text.
  const text = readingOf(
    writing(DECLARING, "notes.olai", `{"id":"sowing","ord":"a0","title":"sowing notes","custom":{"note":"brief.md"}}`),
  )
  expect(text.pointing.files.has("brief.md")).toBe(false)
})

test("one record naming one target under two keys is one source carrying both", () => {
  const at = readingOf(
    writing(
      writing(
        DECLARING,
        "_olai/Properties.olai",
        `{"id":"prop-bed","ord":"a0","title":"bed","custom":{"type":"node"}}\n` +
          `{"id":"prop-next","ord":"a1","title":"next","custom":{"type":"ref"}}`,
      ),
      "notes.olai",
      `{"id":"sowing","ord":"a0","title":"sowing notes","custom":{"bed":"herbs","next":"herbs"}}`,
    ),
  )
  expect(rowsAt(at, "herbs")).toEqual(["notes.olai:1 property"])
  expect(propsOf(at.pointing.rows.get("herbs")?.[0])).toEqual(["bed", "next"])
  // …and one referrer, saying it one way.
  expect(referrersOf(at, "herbs")).toEqual(["notes.olai#sowing property"])
})

test("a record that links a file and names it in a property is one source with two ways", () => {
  const at = readingOf(
    writing(
      writing(
        DECLARING,
        "_olai/Properties.olai",
        `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc"}}`,
      ),
      "notes.olai",
      `{"id":"sowing","ord":"a0","title":"sowing notes","desc":"[the brief](brief.md)","custom":{"brief":"brief.md"}}`,
    ),
  )
  expect(filesAt(at, "brief.md")).toEqual(["notes.olai:1 link+property [brief]"])
  // …and the document's page lists it once, saying both — asked with the
  // FILE's address, where `referrersOf` above asks with a row's.
  expect(
    referencesOf(at, addressOf(TEST_CLAIMS, "brief.md", null)!).map((one) =>
      `${"path" in one.source ? String(one.source.path) : `${one.source.file}#${one.source.node.id}`} ${
        one.ways.join("+")
      }`
    ),
  ).toEqual(["notes.olai#sowing link+property"])
})

// THE REVISION THAT MOVES NO FILE: a declaration edit is one record in one
// outline, and every value of that key in the vault means something else than
// it did. The carry has to re-file them all, and a rebuild is the oracle.
test("a revision that only changes a declaration re-files the property entries", () => {
  const undeclared = writing(
    DECLARING,
    "_olai/Properties.olai",
    `{"id":"prop-bed","ord":"a0","title":"bed","custom":{"type":"text"}}`,
  )
  // Declared: the entry arrives, and the carried table is the rebuilt one.
  const declared = carried(undeclared, DECLARING)
  expect(wholeOf(declared.table)).toEqual(wholeOf(declared.rebuilt))
  expect(declared.table.rows.get("herbs")?.map((source) => source.ways.join("+")))
    .toEqual(["property"])

  // …and taking the declaration back out takes the entry with it, leaving no
  // key standing where a rebuild would have had none.
  const back = carried(DECLARING, undeclared)
  expect(wholeOf(back.table)).toEqual(wholeOf(back.rebuilt))
  expect(back.table.rows.has("herbs")).toBe(false)
})

// …and the ordinary revision, where the declarations stand and a FILE moves:
// the file that moved is re-read and every other file's entries are the ones
// they were.
test("a file that moves re-files its property entries and leaves the rest alone", () => {
  const also = writing(
    DECLARING,
    "lanes.olai",
    `{"id":"lane","ord":"a0","title":"a lane","custom":{"bed":"herbs"}}`,
  )
  const both = carried(DECLARING, also)
  expect(wholeOf(both.table)).toEqual(wholeOf(both.rebuilt))
  // PATH ORDER across the two files, which the second step sorts for: the
  // arriving entry lands beside the one that was already there.
  expect(both.table.rows.get("herbs")?.map((source) => `${source.at?.file}:${source.at?.line}`))
    .toEqual(["lanes.olai:1", "notes.olai:1"])

  // …and the value taken out of the moved file goes, while the untouched
  // file's entry stays.
  const quiet = carried(also, writing(also, "lanes.olai", `{"id":"lane","ord":"a0","title":"a lane"}`))
  expect(wholeOf(quiet.table)).toEqual(wholeOf(quiet.rebuilt))
  expect(quiet.table.rows.get("herbs")?.map((source) => `${source.at?.file}:${source.at?.line}`))
    .toEqual(["notes.olai:1"])
})

// The guard, as a behaviour rather than as a comment: a vault that declares no
// reference key is handed the very table the first step made.
test("a vault that declares no reference key is handed the table uncloned", () => {
  const plain: Revision = new Map([
    ["_olai/Properties.olai", `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`],
    ["notes.olai", `{"id":"sowing","ord":"a0","title":"sowing notes","custom":{"pr":"194"}}`],
  ])
  const at = readingOf(plain)
  const first = pointingOf(TEST_CLAIMS, at.set.documents)
  expect(referenceKeys(at.derived).size).toBe(0)
  expect(propertied(first, TEST_CLAIMS, referenceKeys(at.derived), at.set.documents)).toBe(first)
})
