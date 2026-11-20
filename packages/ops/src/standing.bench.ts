import { TEST_CLAIMS } from "@olai/ops/testlib"
import { addressOf, NO_KINDS, type PageRequest, type Reading } from "@olai/format"
import { median, timed } from "@olai/format/testlib"

import {
  asking,
  FIXED,
  type Modelled,
  publishing,
  type Question,
  vaultFor,
} from "./standing.testlib.ts"
import { rebuilding, sameAnswer, type Standing, standing } from "./standing.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 20)
const TABS = [1, 3, 10] as const
const ROUNDS = 25
const WARM = 8

const vault = vaultFor({ files: FILES, records: RECORDS })
const { publish, revisions } = publishing(vault)
const first = (revisions[0] as { reading: Reading }).reading

const paths = [...vault.outlines.keys()]
const subject = paths.find((path) =>
  (vault.outlines.get(path) ?? []).some((record) => record.date !== null)
) as string
const elsewhere = paths.find((path) => path !== subject) as string
const third = paths.find((path) => path !== subject && path !== elsewhere) as string

const changing = (path: string): Modelled =>
  (vault.outlines.get(path) as ReadonlyArray<Modelled>).find((one) =>
    one.parent !== null && one.mirror === null
  ) as Modelled

const pageAt = (path: string): PageRequest => ({ kind: "at", address: addressOf(TEST_CLAIMS, path, null) })

const QUESTIONS: ReadonlyArray<readonly [string, Question]> = [
  ["page", { which: "page", request: pageAt(subject) }],
  ["narrowing", { which: "narrowing", request: { page: pageAt(subject), text: "record" } }],
  [
    "moving",
    {
      which: "moving",
      request: { record: changing(subject).id, to: [changing(third).id] },
    },
  ],
]

console.log(
  `one write, ${TABS.join("/")} tabs on one question — what the three standing views cost`,
)
console.log(
  `vault: ${vault.outlines.size} outlines, ${first.derived.nodes.length} records, ` +
    `${first.derived.byDay.size} days, ${vault.documents.size} documents`,
)
console.log(`each row is the median of ${ROUNDS} revisions\n`)

const timing = (
  views: Standing,
  question: Question,
  tabs: number,
  into: string,
): { readonly ms: number; readonly answer: unknown } => {
  const times: Array<number> = []
  const last: Array<unknown> = Array.from({ length: tabs }, () => undefined)
  let answer: unknown = undefined
  for (let round = 0; round < WARM + ROUNDS; round++) {
    const record = changing(into)
    record.title = `${record.title.split(" [")[0] as string} [${round}]`
    const at = publish(`keystroke in ${into}`, [into], [])
    const spent = timed(() => {
      for (let tab = 0; tab < tabs; tab++) {
        answer = asking(views, at, question)
        const before = last[tab]
        if (before === undefined || !sameAnswer(question.which, before, answer)) {
          last[tab] = answer
        }
      }
    })
    if (round >= WARM) times.push(spent)
  }
  return { ms: median(times), answer }
}

for (const [where, into] of [["inside", subject], ["elsewhere", elsewhere]] as const) {
  console.log(`the write lands ${where.toUpperCase()} the question's own file`)
  for (const [name, question] of QUESTIONS) {
    for (const tabs of TABS) {
      const before = timing(rebuilding(() => FIXED, NO_KINDS), question, tabs, into)
      const after = timing(standing(() => FIXED, NO_KINDS), question, tabs, into)
      if (typeof after.answer !== typeof before.answer) {
        throw new Error(`${name}: the two arms did not answer the same kind of thing`)
      }
      console.log(
        `  ${name.padEnd(10)} ${String(tabs).padStart(2)} tab${tabs === 1 ? " " : "s"}  ` +
          `${before.ms.toFixed(3).padStart(8)} ms → ${after.ms.toFixed(3).padStart(8)} ms  ` +
          `(${(before.ms / Math.max(after.ms, 1e-6)).toFixed(1)}×)`,
      )
    }
  }
  console.log("")
}

console.log("a whole tab — all three questions, per write")
for (const [where, into] of [["inside", subject], ["elsewhere", elsewhere]] as const) {
  for (const tabs of TABS) {
    const room = (views: Standing): number => {
      const times: Array<number> = []
      const last = new Map<string, unknown>()
      for (let round = 0; round < WARM + ROUNDS; round++) {
        const record = changing(into)
        record.title = `${record.title.split(" [")[0] as string} [room ${round}]`
        const at = publish(`keystroke in ${into}`, [into], [])
        const spent = timed(() => {
          for (let tab = 0; tab < tabs; tab++) {
            for (const [name, question] of QUESTIONS) {
              const answer = asking(views, at, question)
              const key = `${tab} ${name}`
              const before = last.get(key)
              if (before === undefined || !sameAnswer(question.which, before, answer)) {
                last.set(key, answer)
              }
            }
          }
        })
        if (round >= WARM) times.push(spent)
      }
      return median(times)
    }
    const before = room(rebuilding(() => FIXED, NO_KINDS))
    const after = room(standing(() => FIXED, NO_KINDS))
    console.log(
      `  ${where.padEnd(10)} ${String(tabs).padStart(2)} tab${tabs === 1 ? " " : "s"}  ` +
        `${before.toFixed(3).padStart(8)} ms → ${after.toFixed(3).padStart(8)} ms  ` +
        `(${(before / Math.max(after, 1e-6)).toFixed(1)}×)`,
    )
  }
}

{
  const rebuilt = rebuilding(() => FIXED, NO_KINDS)
  const shared = standing(() => FIXED, NO_KINDS)
  let asks = 0
  for (let round = 0; round < 20; round++) {
    const into = round % 2 === 0 ? subject : elsewhere
    const record = changing(into)
    record.title = `${record.title.split(" [")[0] as string} [check ${round}]`
    const at = publish(`keystroke in ${into}`, [into], [])
    for (const [name, question] of QUESTIONS) {
      const one = asking(rebuilt, at, question)
      const other = asking(shared, at, question)
      asks++
      if (!sameAnswer(question.which, one, other)) {
        throw new Error(`${name}: the two arms diverged at round ${round}`)
      }
    }
  }
  console.log(`\nboth arms replayed over ${asks} asks — no divergence`)
}
