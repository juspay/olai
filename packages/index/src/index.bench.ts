/**
 * WHAT A DIRECTORY SEARCH COSTS, walked against indexed — and what keeping the
 * index costs the write that has to keep it.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), for the reason the other four are:
 * the roadmap node this package closes asked for "a benchmark of body-scan cost
 * at realistic vault sizes, so adoption is a number, not a feeling", and a
 * number nobody can re-run is a number nobody can check. Deliberately not part
 * of `just check` — a timing that fails a lane on a busy machine teaches nobody
 * anything.
 *
 * FOUR THINGS ARE MEASURED, and they are four different questions:
 *
 *   - {@link QUERIES} — one query, answered both ways, over a spread of
 *     SELECTIVITY. That spread is the finding rather than a detail of the
 *     harness: an index is worth what it throws away, so a word in one record
 *     is answered in a fraction of a millisecond and a word in nearly every
 *     record is answered no faster than the walk, because the ANSWER is the
 *     corpus either way. A single headline ratio would be a number chosen by
 *     whoever picked the needle;
 *   - the BUILD — a cold table over the whole corpus, which is what the first
 *     query of a process pays and nothing after it does. It is printed rather
 *     than amortised away because it is a real second of somebody's first
 *     keystroke on a large vault;
 *   - the MEMORY — what the table WEIGHS, per row and in all. The design priced
 *     this engine on disk and the implementation put it in memory for the life
 *     of the process, which is a different bill and was an unpriced one until a
 *     reviewer said so; {@link weight} takes the figure and says why it has to
 *     be taken where it is;
 *   - the FOLLOW — what one write costs the table. Two arms: a revision that
 *     moved one file, which is a keystroke, and a revision that moved nothing,
 *     which is every query after it. The second is the one that has to be
 *     nearly free, since it is paid per query forever.
 *
 * The vault is generated (`@olai/format/testlib`'s `vaultOf`) rather than read,
 * so the figures are reproducible and are figures about a stated shape — the
 * SAME corpus the patcher's and the tag completion's legs run on, so what a
 * write costs the view and what a query costs over it are numbers about one
 * directory. The DOCUMENTS beside it are this leg's own, because the other legs
 * are about records and the thing search actually spends its milliseconds on is
 * prose: a vault whose `.md` files are all empty measures the body scan at zero
 * and reports the index as saving nothing where it saves the most. Size it with
 * OLAI_BENCH_FILES / OLAI_BENCH_RECORDS / OLAI_BENCH_DOCS.
 */

import {
  assemble,
  bodiedDocument,
  bodiedIn,
  type Document,
  documentHayOf,
  hayOf,
  isMirror,
  matching,
  matchingDocuments,
  narrowableBy,
  nodesIn,
  parseFilter,
  parseOutline,
  reading,
  type Reading,
  type RegularNode,
  type Verdict,
  verdictOf,
} from "@olai/format"
import {
  alternating,
  median,
  runtimeSaid,
  seeded,
  timed,
  timesSaid,
  vaultOf,
} from "@olai/format/testlib"
import { Result } from "effect"

import { lookupable, open } from "./index.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const DOCS = Number(process.env["OLAI_BENCH_DOCS"] ?? 200)

/** The day the grammar's relative words count from — a constant, so the leg
 *  measures the same question in January. */
const NOW = "2026-08-13T11:00:00-04:00"

// ── the vault ──────────────────────────────────────────────────────────

const corpus = vaultOf({ files: FILES, records: RECORDS })

/** The prose beside it. Words drawn from a small vocabulary, because a body of
 *  unique nonsense would make every needle select one document and measure the
 *  easiest case there is; the point of a body is that it is long and that a
 *  common word is in a great many of them. */
const WORDS = [
  "kitchen",
  "garden",
  "invoice",
  "walnut",
  "budget",
  "remodel",
  "brass",
  "cabinets",
  "upkeep",
  "timber",
]

const bodyOf = (random: () => number, at: number): string => {
  const lines = [`# note ${at}`, ""]
  for (let line = 0; line < 40; line++) {
    const words = Array.from(
      { length: 12 },
      () => WORDS[Math.floor(random() * WORDS.length)] as string,
    )
    lines.push(`${words.join(" ")} ${at}-${line}.`)
  }
  return `${lines.join("\n")}\n`
}

const random = seeded(20260824)
const decoded = new Map<string, Result.Result<Document, Verdict>>()
for (const [path, text] of corpus) {
  decoded.set(path, Result.mapError(parseOutline(path, text), verdictOf))
}
for (let at = 0; at < DOCS; at++) {
  const path = `notes/note${at}.md`
  decoded.set(path, Result.succeed<Document>(bodiedDocument(path, bodyOf(random, at))))
}

let read: Reading = reading(assemble(decoded))
const records = read.derived.byId.size
const prose = [...decoded.values()].reduce(
  (total, entry) =>
    total + (Result.isSuccess(entry) && entry.success.kind === "document"
      ? entry.success.body.length
      : 0),
  0,
)

/**
 * EVERY BYTE THE TABLE IS BUILT FROM — the denominator the memory figure below
 * is a multiple of, and it is the whole indexed corpus rather than the prose
 * alone: the records' four folded fields are text the table holds trigrams of
 * exactly as a body is. Measured through the same two functions the index
 * itself indexes with, so the ratio is about the same strings.
 *
 * It is the figure the brainstorm's on-disk estimate ("index ≈ 3× the text")
 * has to be compared against, which is the whole reason it is computed rather
 * than the prose count being reused for it.
 */
const indexed = [...read.derived.byFile.values()].reduce(
  (total, own) =>
    total + own.reduce(
      (each, at) => each + (isMirror(at.node) ? 0 : hayOf(at.node as RegularNode).length),
      0,
    ),
  0,
) + bodiedIn(read.set).reduce((total, one) => total + documentHayOf(one).length, 0)

const index = open()

/**
 * WHAT THE TABLE WEIGHS, measured HERE — before anything else has touched it,
 * because this process gets exactly one honest chance at the question.
 *
 * The brainstorm priced the engine ON DISK ("index ≈ 3× the text", with "zero
 * process memory" as the reason to put it there) and the implementation put the
 * same postings in memory instead, for the life of the process. That is a
 * defensible trade and it was an unpriced one until a reviewer said so (pi on
 * `cca1b21`), which is the objection this whole leg exists to answer: adoption
 * is a number, not a feeling.
 *
 * TWO FIGURES, because they answer two questions and neither substitutes:
 *
 *   - what the TABLE holds — SQLite's own page count, exact and repeatable, and
 *     the number to multiply when somebody asks what a vault ten times this
 *     size would cost. It is the postings alone: the fold they were built from
 *     is not stored (`content=''`), and the JavaScript beside them is two maps
 *     of pointers at arrays the reading already holds;
 *   - what the PROCESS pays — the resident-set delta across that build, which
 *     is the honest end-to-end figure and is noisy in a way the first is not.
 *     It is measured on the FIRST fill of this process's only long-lived table,
 *     which is why it is up here rather than beside the BUILD timings below: a
 *     second table built after this one reuses pages the allocator already
 *     holds and reads as costing almost nothing, which would be a flattering
 *     number rather than a true one.
 */
Bun.gc(true)
const residentBefore = process.memoryUsage().rss
index.narrow(read, parseFilter("upkeep11", NOW))
Bun.gc(true)
const weight = {
  table: index.bytes(),
  rows: index.rows(),
  resident: process.memoryUsage().rss - residentBefore,
}

console.log(
  `corpus: ${FILES} outlines of ${RECORDS} records (${records} records), ` +
    `${DOCS} documents holding ${(prose / 1e6).toFixed(2)} MB of prose — ` +
    `${(indexed / 1e6).toFixed(2)} MB of folded text in all`,
)
console.log(runtimeSaid())
console.log()

// ── the two answers ────────────────────────────────────────────────────

/** The walk: what every door paid per query before this package. Both arms
 *  answer BOTH ARMS OF THE SET — a search is one question about records and
 *  documents, and timing the records alone would leave out the bodies, which
 *  are where the bytes are. */
const walk = (text: string): number => {
  const filter = parseFilter(text, NOW)
  return matching(read.derived, filter).length +
    matchingDocuments(bodiedIn(read.set), filter).length
}

/** ...and the same answer through the table. The candidate lookup is INSIDE the
 *  timed window along with the matcher that verifies it, because what a caller
 *  pays is the pair — an index that answered instantly and handed back the
 *  corpus would print beautifully and save nothing. */
const lookup = (text: string): number => {
  const filter = parseFilter(text, NOW)
  const found = index.narrow(read, filter)
  return matching(read.derived, filter, {}, found?.nodes).length +
    matchingDocuments(bodiedIn(read.set), filter, {}, found?.documents).length
}

/**
 * The needles, from one record to nearly all of them.
 *
 * Each is here for the band it sits in rather than for itself: `upkeep11` is a
 * tag a twelfth of the records carry, `walnut` is a word in most BODIES and no
 * record, `record` is in every record's title, and the quoted phrase is the
 * shape a reader types when they know what they are looking for. A needle no
 * document and no record holds is the floor — what the machinery costs when
 * there is nothing to find.
 */
const QUERIES = [
  `"of file 11"`,
  "upkeep11",
  "zzzzzzzz",
  "brass timber",
  "walnut",
  "note about",
  "record",
] as const

const rows = QUERIES.map((text) => {
  const found = walk(text)
  const other = lookup(text)
  if (found !== other) {
    throw new Error(
      `the two arms disagree about \`${text}\`: the walk found ${found} and the ` +
        `index found ${other} — a benchmark of an index that answers differently ` +
        `is a benchmark of nothing`,
    )
  }
  const filter = parseFilter(text, NOW)
  const [walked, indexed] = alternating([() => walk(text), () => lookup(text)])
  const candidates = index.narrow(read, filter)
  return {
    text,
    found,
    walked,
    indexed,
    // The three things `null` can mean are three different findings, and a
    // column that printed one word for all of them would hide the interesting
    // one: the grammar had no word to look up, or the table looked and declined
    // a crowd ({@link CROWD}), or it answered.
    why: candidates !== null
      ? `${candidates.nodes.size + candidates.documents.size} candidates`
      : narrowableBy(filter, lookupable) === null
      ? "nothing to look up"
      : "declined — a crowd",
  }
})

console.log("ONE QUERY, both ways — median of nine alternating rounds")
for (const row of rows) {
  console.log(
    `  ${row.text.padEnd(14)} ${String(row.found).padStart(6)} hits  ` +
      `walk ${row.walked.toFixed(2).padStart(7)}ms  ` +
      `index ${row.indexed.toFixed(2).padStart(7)}ms  ` +
      `${(row.walked / row.indexed).toFixed(1).padStart(6)}×  (${row.why})`,
  )
}
console.log()

// ── what the table costs to keep ───────────────────────────────────────

/** A COLD TABLE over the whole corpus — the first query of a process, and the
 *  one cost this design does not amortise. Measured on a table of its own so
 *  the warm one above is not disturbed. */
const built = median(
  Array.from({ length: 3 }, () => {
    const fresh = open()
    const ms = timed(() => {
      fresh.narrow(read, parseFilter("upkeep11", NOW))
    })
    fresh.close()
    return ms
  }),
)
console.log(`BUILD  a cold table over the whole corpus: ${built.toFixed(1)}ms`)

/** ...and what it WEIGHS, taken at the top of the run where the figure is
 *  honest ({@link weight} says why it could not be taken here). */
console.log(
  `MEMORY table ${(weight.table / 1e6).toFixed(1)} MB over ${weight.rows} rows ` +
    `(${Math.round(weight.table / weight.rows)} bytes each, ` +
    `${(weight.table / indexed).toFixed(2)}× the folded text) · ` +
    `rss +${(weight.resident / 1e6).toFixed(1)} MB across that build`,
)

/**
 * WHAT A WRITE COSTS THE TABLE — one file re-decoded and the index brought
 * level with the reading that write produced, which is what a keystroke pays.
 *
 * Through the real patcher, so the identity the index tests is the identity a
 * write actually leaves: `reading` hands back the same records array for every
 * file the delta did not name, and the one it did is a new one.
 */
const paths = [...corpus.keys()]
const edited: Array<number> = []
for (let which = 0; which < 40; which++) {
  const file = paths[which % paths.length] as string
  const text = (corpus.get(file) as string).replace(
    /"title":"([^"]*)"/,
    `"title":"$1 edit ${which}"`,
  )
  decoded.set(file, Result.mapError(parseOutline(file, text), verdictOf))
  const next = reading(assemble(decoded), {
    read,
    delta: { upserts: [[file, { nodes: nodesIn(decoded.get(file)) }]], removes: [] },
  })
  read = next
  edited.push(
    timed(() => {
      index.narrow(read, parseFilter("upkeep11", NOW))
    }),
  )
}
console.log(
  timesSaid(`FOLLOW one file rewritten (${RECORDS} records)`, edited, 44),
)

/** ...and a revision that moved NOTHING, which is every query after the first
 *  at one revision. It is the two identity walks and no SQL at all, and it is
 *  the number that has to be small: it is paid per query for as long as the
 *  process runs. */
const still = Array.from({ length: 40 }, () =>
  timed(() => {
    index.narrow(read, parseFilter("upkeep11", NOW))
  }))
console.log(timesSaid("FOLLOW nothing moved", still, 44))

index.close()
