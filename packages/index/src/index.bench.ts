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
 * THREE THINGS ARE MEASURED, and they are three different questions:
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
  matching,
  matchingDocuments,
  narrowableBy,
  nodesIn,
  type OutlineError,
  parseFilter,
  parseOutline,
  reading,
  type Reading,
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

import { open } from "./index.ts"

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
const decoded = new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>()
for (const [path, text] of corpus) decoded.set(path, parseOutline(path, text))
for (let at = 0; at < DOCS; at++) {
  const path = `notes/note${at}.md`
  decoded.set(path, Result.succeed<Document>(bodiedDocument(path, bodyOf(random, at))))
}

let read: Reading = reading(assemble(decoded))
const records = read.derived.byId.size
const bytes = [...decoded.values()].reduce(
  (total, entry) =>
    total + (Result.isSuccess(entry) && entry.success.kind === "document"
      ? entry.success.body.length
      : 0),
  0,
)

const index = open()

console.log(
  `corpus: ${FILES} outlines of ${RECORDS} records (${records} records), ` +
    `${DOCS} documents holding ${(bytes / 1e6).toFixed(2)} MB of prose`,
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
      : narrowableBy(filter, (word) => word.length >= 3) === null
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
  decoded.set(file, parseOutline(file, text))
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
