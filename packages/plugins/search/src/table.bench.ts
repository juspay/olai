import { TEST_CLAIMS } from "@olai/format/testlib"
import { assemble, bodiedDocument, bodiedIn, type Document, documentHayOf, hayOf, isMirror, matching, matchingDocuments, narrowableBy, nodesIn, parseFilter, reading, type Reading, type RegularNode, type Verdict, verdictOf } from "@olai/format"
import { parseOutline } from "olai-plugin-outline-olai/format"
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

import { lookupable, open } from "./table.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const DOCS = Number(process.env["OLAI_BENCH_DOCS"] ?? 200)

const NOW = "2026-08-13T11:00:00-04:00"

const corpus = vaultOf({ files: FILES, records: RECORDS })

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
  decoded.set(path, Result.mapError(parseOutline(path, text, TEST_CLAIMS), verdictOf))
}
for (let at = 0; at < DOCS; at++) {
  const path = `notes/note${at}.md`
  decoded.set(path, Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, path, bodyOf(random, at))))
}

let read: Reading = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
const records = read.derived.byId.size
const prose = [...decoded.values()].reduce(
  (total, entry) =>
    total + (Result.isSuccess(entry) && entry.success.holds === "text" && entry.success.kept
      ? entry.success.body.length
      : 0),
  0,
)

const indexed = [...read.derived.byFile.values()].reduce(
  (total, own) =>
    total + own.reduce(
      (each, at) => each + (isMirror(at.node) ? 0 : hayOf(at.node as RegularNode).length),
      0,
    ),
  0,
) + bodiedIn(read.set).reduce((total, one) => total + documentHayOf(one).length, 0)

const index = open()

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

const walk = (text: string): number => {
  const filter = parseFilter(text, NOW)
  return matching(read.derived, filter).length +
    matchingDocuments(bodiedIn(read.set), filter).length
}

const lookup = (text: string): number => {
  const filter = parseFilter(text, NOW)
  const found = index.narrow(read, filter)
  return matching(read.derived, filter, {}, found?.nodes).length +
    matchingDocuments(bodiedIn(read.set), filter, {}, found?.documents).length
}

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

console.log(
  `MEMORY table ${(weight.table / 1e6).toFixed(1)} MB over ${weight.rows} rows ` +
    `(${Math.round(weight.table / weight.rows)} bytes each, ` +
    `${(weight.table / indexed).toFixed(2)}× the folded text) · ` +
    `rss +${(weight.resident / 1e6).toFixed(1)} MB across that build`,
)

const paths = [...corpus.keys()]
const edited: Array<number> = []
for (let which = 0; which < 40; which++) {
  const file = paths[which % paths.length] as string
  const text = (corpus.get(file) as string).replace(
    /"title":"([^"]*)"/,
    `"title":"$1 edit ${which}"`,
  )
  decoded.set(file, Result.mapError(parseOutline(file, text, TEST_CLAIMS), verdictOf))
  const next = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded), {
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

const still = Array.from({ length: 40 }, () =>
  timed(() => {
    index.narrow(read, parseFilter("upkeep11", NOW))
  }))
console.log(timesSaid("FOLLOW nothing moved", still, 44))

index.close()
