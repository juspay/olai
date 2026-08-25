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
 * was paid on every published revision: `referrersTo` tested every link of
 * every face in the directory, per revision, per tab sitting on any `.md` or
 * `.html` page. So the arms are the two halves of what a revision costs that
 * page, and BOTH are printed — because this index is a TRADE and printing one
 * half would be quoting the good one. The walk cost a page and nothing per
 * write; the index costs a page much less and every revision something.
 *
 *   - `read` — answering "who points here" once. The `scan` arm is that walk as
 *     it stood (`./pointing.testlib.ts`, one copy, shared with the
 *     differential); the `index` arm is one lookup and then the same walk of
 *     the files that really do point here.
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
 * WHAT THE READ ARM STILL PAYS, said here so the ratio is read for what it is:
 * an outline that points here is opened and its records asked which of THEM
 * wrote the link (`recordLinks`, the same function that built the face). That
 * walk is the old code's too and this index does not remove it — what it
 * removes is opening every OTHER file in the directory. On a corpus where every
 * body is pointed at by dozens of outlines, that record walk is most of what is
 * left, which is why the `unpointed` row is beside it.
 *
 * THE VAULT IS GENERATED (`./pointing.testlib.ts`'s `linkyVault`) rather than
 * read, so the figure is reproducible and is about a stated shape: outlines
 * whose records carry `doc` attachments, `see` edges and links in titles and
 * notes, and `.md` bodies with links and headings in their prose. Size it with
 * OLAI_BENCH_OUTLINES / OLAI_BENCH_BODIES / OLAI_BENCH_RECORDS /
 * OLAI_BENCH_PAGES / OLAI_BENCH_EDITS.
 */

import { addressOf } from "./address.ts"
import { referrersTo } from "./backlinks.ts"
import { alternating, median, runtimeSaid, seeded, timed, timesSaid } from "./fixtures.testlib.ts"
import { type Pointing, pointingOf, repointed } from "./pointing.ts"
import {
  documentsAmong,
  facesIn,
  linkyRevisions,
  linkyVault,
  type Revision,
  scannedReferrers,
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

// ── the vault, and the stream of edits over it ─────────────────────────

const vault = linkyVault({ outlines: OUTLINES, bodies: BODIES, records: RECORDS })
const random = seeded(20260825)
const stream = linkyRevisions(vault, random, EDITS)

/** Every revision, decoded the way a probe decodes one: only what MOVED is
 *  re-read, so every other file is the object the last revision held — which is
 *  the property the carry is about, and a harness that re-decoded the directory
 *  each time would measure a carry that can never happen. */
const readings: Array<{ readonly set: OutlineSet; readonly at: Reading }> = []
{
  const decoded = decodedVault(new Map())
  let held: Revision = new Map()
  let previous: Reading | null = null
  for (const revision of stream) {
    for (const file of held.keys()) if (!revision.has(file)) decoded.delete(file)
    const moved = new Map<string, string>()
    for (const [file, text] of revision) if (held.get(file) !== text) moved.set(file, text)
    for (const [file, one] of decodedVault(moved)) decoded.set(file, one)
    held = revision
    const set = assemble(decoded)
    // Through the format's own door, so the index a revision carries is the one
    // production carries. The DELTA is not offered: this leg times the two
    // index arms directly below, and a reading built here only has to be a real
    // one to time them against.
    previous = reading(set)
    readings.push({ set, at: previous })
  }
}

const first = readings[0] as { readonly set: OutlineSet; readonly at: Reading }
const faces = facesIn(first.set)

/** The pages a reader has open — document addresses drawn evenly across the
 *  directory rather than off the front of it, so the figure is not about the
 *  files that happen to sort first. */
const bodies = documentsAmong(first.set.documents.map((one) => one.path))
const open = bodies
  .filter((_, which) => which % Math.max(1, Math.floor(bodies.length / PAGES)) === 0)
  .slice(0, PAGES)
  .map((path) => addressOf(path, null)!)

/** …and a page NOTHING points at, which is most pages in most directories: a
 *  `.md` the vault does not hold, asked for by name. The scan still opens every
 *  file to find that out. */
const unpointed = addressOf("nobody-points-here.md", null)!

// ── the arms ───────────────────────────────────────────────────────────

const readIndex = (pointing: Pointing, at: Reading, which = open): number =>
  which.reduce((held, address) => held + referrersTo(address, pointing, at.derived).length, 0)

const readScan = (at: Reading, which = open): number =>
  which.reduce((held, address) => held + scannedReferrers(address, faces, at.derived).length, 0)

/** The answers are compared before anything is timed: two arms that disagree
 *  are not two arms of one comparison. */
const drawn = readIndex(first.at.pointing, first.at)
if (drawn !== readScan(first.at)) {
  throw new Error("the two read arms disagree, so there is nothing to compare")
}

const ROUNDS = 9

const [scan, index] = alternating(
  [() => readScan(first.at), () => readIndex(first.at.pointing, first.at)],
  ROUNDS,
)
const [scanCold, indexCold] = alternating(
  [
    () => readScan(first.at, [unpointed]),
    () => readIndex(first.at.pointing, first.at, [unpointed]),
  ],
  ROUNDS,
)

/** The write half, over the whole stream: every consecutive pair carried, and
 *  the same revision rebuilt from scratch. A median over the stream rather than
 *  one edit, because which edit it is decides everything — a body rewritten is
 *  one file's links re-filed, a file renamed is two. */
const pairs = readings.slice(1).map((one, at) => ({
  was: (readings[at] as { readonly set: OutlineSet }).set,
  now: one.set,
  before: (readings[at] as { readonly at: Reading }).at.pointing,
}))
const carries = pairs.map((pair) => timed(() => repointed(pair.before, pair.was.documents, pair.now.documents)))
const rebuilds = pairs.map((pair) => timed(() => pointingOf(pair.now.documents)))

/** …and how many of those edits handed the index straight on, uncloned. */
const carried = pairs.filter((pair) =>
  repointed(pair.before, pair.was.documents, pair.now.documents) === pair.before
).length

/** How thickly the corpus points at its own bodies — printed because the read
 *  ratio is a function of it: what this index takes off a read is the walk of
 *  every OTHER file, and what is left is the walk of the ones that really point
 *  here. A directory whose pages have a handful of referrers each sees the
 *  `unpointed` row; one whose every page has dozens sees the `read` row. */
const density = bodies
  .map((path) => referrersTo(addressOf(path, null)!, first.at.pointing, first.at.derived).length)
  .sort((one, other) => one - other)

console.log(
  `pointing.bench — ${first.set.documents.length} files ` +
    `(${OUTLINES} outlines × ${RECORDS} records, ${BODIES} bodies), ` +
    `${first.at.pointing.size} keys, ${PAGES} pages open, ${drawn} referrers drawn`,
)
console.log(
  `  referrers per body: min ${density[0]}, median ${
    density[Math.floor(density.length / 2)]
  }, max ${density[density.length - 1]}`,
)
console.log(runtimeSaid())
console.log("")
console.log(`  read              scan ${scan.toFixed(3)}ms   index ${index.toFixed(3)}ms`)
console.log(
  `  read (unpointed)  scan ${scanCold.toFixed(3)}ms   index ${indexCold.toFixed(3)}ms`,
)
console.log(
  `  write             rebuild ${median(rebuilds).toFixed(3)}ms   carry ${
    median(carries).toFixed(3)
  }ms   (${carried} of ${pairs.length} edits carried uncloned)`,
)
console.log("")
console.log(timesSaid("carry", carries, 8))
console.log(timesSaid("rebuild", rebuilds, 8))
