/**
 * WHAT A DOCUMENT'S PAGE COSTS PER WRITE — the walk against the index, on a
 * directory with links all through it.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), for `./patch.bench.ts`'s reason: a
 * timing that fails a lane on a busy machine teaches nobody anything, and a
 * number quoted in a docstring that nothing re-runs is the unreproducible
 * laptop sample this repository has already retired once.
 *
 * THE COST THE ROADMAP NAMED (`perf-doc-backlinks-index`) is a page's, and it
 * was paid on every published revision: the reverse reading tested every link
 * of every face in the directory, per revision, per tab sitting on any `.md`
 * or `.html` page. So the arms are the two halves of what a revision costs
 * that page, and BOTH are printed — because this index is a TRADE and printing
 * one half would be quoting the good one. The walk cost a page and nothing per
 * write; the index costs a page much less and every revision something.
 *
 *   - `read` — answering "who points here" once, BOTH arms printed so the
 *     trade is stated whole. The `scan` arm is the walk as it stood
 *     (`./pointing.testlib.ts`, one copy, shared with the differential); the
 *     `index` arm is the same question off the carried map, `pointingAt` —
 *     one lookup, and the entry found is already the record-granular answer
 *     (which record wrote it, and where in the body), because the fold files
 *     one entry per source with its `at` rather than one per file.
 *   - `read (unpointed)` — the same question about a page NOTHING points at,
 *     which is most pages in most directories. It is the row that shows the
 *     shape of the change rather than one corpus's constant: the scan's cost is
 *     the DIRECTORY's and does not care how many referrers there are, and the
 *     index's is the ANSWER's.
 *   - `write` — carrying the index across one edit, measured over a stream of
 *     them. `rebuild` is {@link pointingOf} over the whole directory, which is
 *     what a first load costs; `carry` is {@link repointed} over the two sets,
 *     which is the step a revision actually takes.
 *
 * WHAT THE READ ARM NO LONGER PAYS, said here so the ratio is read for what it
 * is: the walk that opened an outline and asked its records which of THEM
 * wrote the link (`recordLinks`) is AT THE FOLD — it names the `at` the index
 * carries, so a read is lookups over the map, however many sources answer.
 * What a revision still pays is the fold's own cost ({@link repointed}) and
 * nothing per page.
 *
 * THE VAULT IS GENERATED (`./pointing.testlib.ts`'s `linkyVault`) rather than
 * read, so the figure is reproducible and is about a stated shape: outlines
 * whose records carry `see` edges and links in titles and
 * notes, and `.md` bodies with links and headings in their prose. Size it with
 * OLAI_BENCH_OUTLINES / OLAI_BENCH_BODIES / OLAI_BENCH_RECORDS /
 * OLAI_BENCH_PAGES / OLAI_BENCH_EDITS.
 *
 * TWO CORPORA, one leg each: one whose links are all standard — byte for byte
 * the corpus the generator wrote before wikilinks existed, so its figures sit
 * beside a run of this bench from before them — and one where a third of the
 * links are wikilinks. Each prints the three reads a page makes — a document
 * somebody points at, a document nobody does, and a ROW (the node arm) — the
 * two write costs, and how many edits handed the name index on untouched.
 */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { type Address, addressOf } from "./address.ts"
import { referencesOf } from "./backlinks.ts"
import { alternating, median, runtimeSaid, seeded, timed, timesSaid } from "./fixtures.testlib.ts"
import { pointingOf, repointed } from "./pointing.ts"
import {
  documentsAmong,
  facesIn,
  linkyRevisions,
  linkyVault,
  type Revision,
  scannedReferrers,
  WIKILINK_SHARE,
} from "./pointing.testlib.ts"
import { decodedVault } from "./scope.testlib.ts"
import { assemble, type OutlineSet } from "./set.ts"
import { type Reading, reading } from "./validate.ts"

const OUTLINES = Number(process.env["OLAI_BENCH_OUTLINES"] ?? 300)
const BODIES = Number(process.env["OLAI_BENCH_BODIES"] ?? 1500)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
/** How many document pages are open on the directory — the multiplier the whole
 *  node is about, since the walk was paid once per page per revision. */
const PAGES = Number(process.env["OLAI_BENCH_PAGES"] ?? 10)
const EDITS = Number(process.env["OLAI_BENCH_EDITS"] ?? 20)
const ROUNDS = 9

/** Every pick spread evenly over a list rather than taken off the front of it,
 *  so a figure is not about the files that happen to sort first. */
const spread = <T>(all: ReadonlyArray<T>): ReadonlyArray<T> =>
  all.filter((_, which) => which % Math.max(1, Math.floor(all.length / PAGES)) === 0).slice(0, PAGES)

/** One corpus, measured: `wikilinks` is the share of its links written as
 *  wikilinks. */
const leg = (label: string, wikilinks: number): void => {
  const vault = linkyVault({ outlines: OUTLINES, bodies: BODIES, records: RECORDS, wikilinks })
  const stream = linkyRevisions(vault, seeded(20260825), EDITS, wikilinks)

  // Every revision, decoded the way a probe decodes one: only what MOVED is
  // re-read, so every other file is the object the last revision held — which
  // is the property the carry is about. Each reading FOLLOWS the one before,
  // through the format's own door, so the name index a revision holds is the
  // one production hands on.
  const readings: Array<{ readonly set: OutlineSet; readonly at: Reading }> = []
  {
    const decoded = decodedVault(new Map())
    let held: Revision = new Map()
    let previous: Reading | undefined
    for (const revision of stream) {
      for (const file of held.keys()) if (!revision.has(file)) decoded.delete(file)
      const moved = new Map<string, string>()
      for (const [file, text] of revision) if (held.get(file) !== text) moved.set(file, text)
      for (const [file, one] of decodedVault(moved)) decoded.set(file, one)
      held = revision
      const set = assemble(TEST_CLAIMS, decoded)
      previous = reading(TEST_CLAIMS, set, previous === undefined ? undefined : { read: previous, delta: { upserts: [], removes: [] } })
      readings.push({ set, at: previous })
    }
  }

  const first = readings[0] as { readonly set: OutlineSet; readonly at: Reading }
  const faces = facesIn(first.set)

  /** The pages a reader has open — document addresses, and rows. */
  const bodies = documentsAmong(first.set.documents.map((one) => one.path))
  const open = spread(bodies).map((path) => addressOf(TEST_CLAIMS, path, null)!)
  const rows = spread([...first.at.derived.byId.keys()]).map((id) => addressOf(TEST_CLAIMS, null, id)!)
  /** …and a page NOTHING points at, which is most pages in most directories:
   *  a `.md` the vault does not hold, asked for by name. The scan still opens
   *  every file to find that out. */
  const unpointed = [addressOf(TEST_CLAIMS, "nobody-points-here.md", null)!]

  const readIndex = (at: Reading, which: ReadonlyArray<Address>): number =>
    which.reduce((held, address) => held + referencesOf(at, address).length, 0)
  const readScan = (at: Reading, which: ReadonlyArray<Address>): number =>
    which.reduce((held, address) => held + scannedReferrers(address, faces, at.derived, at.names.served).length, 0)

  // The answers are compared before anything is timed: two arms that disagree
  // are not two arms of one comparison.
  for (const which of [open, rows, unpointed]) {
    if (readIndex(first.at, which) !== readScan(first.at, which)) {
      throw new Error(`${label}: the two read arms disagree, so there is nothing to compare`)
    }
  }
  const arms = (which: ReadonlyArray<Address>) =>
    alternating([() => readScan(first.at, which), () => readIndex(first.at, which)], ROUNDS)
  const [scan, index] = arms(open)
  const [scanCold, indexCold] = arms(unpointed)
  const [scanRow, indexRow] = arms(rows)

  // The write half, over the whole stream: every consecutive pair carried, and
  // the same revision rebuilt from scratch.
  const pairs = readings.slice(1).map((one, at) => ({
    was: (readings[at] as { readonly set: OutlineSet }).set,
    now: one.set,
    before: (readings[at] as { readonly at: Reading }).at,
    after: one.at,
  }))
  const carries = pairs.map((pair) => timed(() => repointed(pair.before.pointing, TEST_CLAIMS, pair.was.documents, pair.now.documents)))
  const rebuilds = pairs.map((pair) => timed(() => pointingOf(TEST_CLAIMS, pair.now.documents)))
  const carried = pairs.filter((pair) =>
    repointed(pair.before.pointing, TEST_CLAIMS, pair.was.documents, pair.now.documents) === pair.before.pointing
  ).length
  const named = pairs.filter((pair) => pair.after.names === pair.before.names).length

  // What reading every text through the parser costs, settled rather than
  // hidden: a FIRST LOAD (the whole vault decoded, each text read once and the
  // reading kept) and ONE WRITE (one outline file decoded again — every text
  // in it read again). The rebuild above is the index alone over readings
  // already kept.
  const loads = Array.from({ length: 3 }, () => timed(() => decodedVault(vault)))
  const textsIn = (text: string): number =>
    text.split("\n").filter((line) => line !== "").reduce((held, line) => {
      const record = JSON.parse(line) as { readonly title?: string; readonly desc?: string }
      return held + (record.title ? 1 : 0) + (record.desc ? 1 : 0)
    }, 0)
  const [outline, texts] = [...vault]
    .filter(([file]) => file.endsWith(".olai"))
    .map(([file, text]) => [[file, text], textsIn(text)] as const)
    .sort((one, other) => Math.abs(one[1] - 22) - Math.abs(other[1] - 22))[0]!
  const writes = Array.from({ length: ROUNDS * 5 }, () => timed(() => decodedVault(new Map([outline]))))

  const density = bodies
    .map((path) => referencesOf(first.at, addressOf(TEST_CLAIMS, path, null)!).length)
    .sort((one, other) => one - other)

  console.log(
    `pointing.bench, ${label} — ${first.set.documents.length} files ` +
      `(${OUTLINES} outlines × ${RECORDS} records, ${BODIES} bodies), ` +
      `${first.at.pointing.size} keys, ${PAGES} pages and ${rows.length} rows open`,
  )
  console.log(
    `  referrers per body: min ${density[0]}, median ${
      density[Math.floor(density.length / 2)]
    }, max ${density[density.length - 1]}`,
  )
  console.log(`  read              scan ${scan.toFixed(3)}ms   index ${index.toFixed(3)}ms`)
  console.log(`  read (unpointed)  scan ${scanCold.toFixed(3)}ms   index ${indexCold.toFixed(3)}ms`)
  console.log(`  read (rows)       scan ${scanRow.toFixed(3)}ms   index ${indexRow.toFixed(3)}ms`)
  console.log(
    `  write             rebuild ${median(rebuilds).toFixed(3)}ms   carry ${
      median(carries).toFixed(3)
    }ms   (${carried} of ${pairs.length} edits carried uncloned, ${named} handed the name index on)`,
  )
  console.log(`  first load        ${median(loads).toFixed(1)}ms   (every file decoded, every text read once)`)
  console.log(`  one write         ${median(writes).toFixed(3)}ms   (one outline of ${texts} texts decoded again)`)
  console.log(timesSaid("carry", carries, 8))
  console.log(timesSaid("rebuild", rebuilds, 8))
  console.log("")
}

console.log(runtimeSaid())
console.log("")
leg("no wikilinks", 0)
leg("wikilinks", WIKILINK_SHARE)
