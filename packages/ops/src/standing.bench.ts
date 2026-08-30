/**
 * WHAT ONE WRITE COSTS THE SERVER WITH TABS OPEN — the five standing views,
 * timed at one, three and ten subscribers on one question.
 *
 * The unit is the whole point of it. These readings are not asked and answered:
 * they are held open, and the framework gives every subscriber its own poll
 * loop, so what a write costs is what one answer costs TIMES the number of
 * people looking at it (`./standing.ts`, roadmap `perf-streams-per-tab`). A
 * benchmark of one answer would print a number nobody pays.
 *
 * TWO EDITS PER ROW, because the change is two claims and they are bought
 * separately:
 *
 *   - **INSIDE** — the write lands in the very file the question is about, so
 *     the answer really did move and nothing may be reused across revisions.
 *     What this row measures is the SHARE alone: one build, however many tabs;
 *   - **ELSEWHERE** — the write lands in another file, which is what nearly
 *     every write is for nearly every open question. Here the PRE-CHECK
 *     answers, the rebuild does not happen, and the row measures both halves
 *     together.
 *
 * BOTH ARMS ARE IN THE TREE and are replayed against each other before a figure
 * is quoted — `rebuilding` is the same five answers with none of the sharing in
 * front of them, kept in the module under test as the differential's reference
 * ({@link ./standing.testlib.ts}). The two must answer the same value at every
 * revision or the row throws rather than printing a ratio nobody may believe:
 * the one shape a flattering number takes here is an arm that answered a
 * question it never asked.
 *
 * A REPORTED ARTIFACT AND NOT A GATE, like every other leg in `just bench`: a
 * timing that fails a lane on a busy machine teaches nobody anything.
 *
 * Its vault is the harness's ({@link vaultFor}) rather than
 * `@olai/format/testlib`'s `vaultOf`, and the difference is load-bearing here
 * as it is over there: a third of its files hold no date at all, which is the
 * shape a real directory has and the only shape under which the calendar's and
 * the agenda's pre-check can be measured at all. Size it with
 * OLAI_BENCH_FILES / OLAI_BENCH_RECORDS, like the four legs that share the
 * other vault.
 */

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
/** How many subscribers are watching one question — the whole subject. */
const TABS = [1, 3, 10] as const
/** Revisions per row. Each one is a real write: an edit, a re-decode of the one
 *  file it named, and a validation patched from the revision before. */
const ROUNDS = 25
/** Untimed revisions before each row. Every row makes its own writes, so a row
 *  that started cold would print the JIT rather than the change — which is how
 *  the first spelling of this leg reported the same arm at two different costs
 *  depending on where in the file it was written. */
const WARM = 8

const vault = vaultFor({ files: FILES, records: RECORDS })
const { publish, revisions } = publishing(vault)
const first = (revisions[0] as { reading: Reading }).reading

/**
 * The file the questions are ABOUT, a file to type into that is not it, and a
 * THIRD one for the move picker's destination.
 *
 * The third earns its place: a move picker previewing a destination in the very
 * file the write lands in is an "elsewhere" row that is secretly an "inside"
 * one, and it would print the pre-check as buying nothing for that member.
 */
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

const day = (changing(subject).date ?? "2026-01-01")
const pageAt = (path: string): PageRequest => ({ kind: "at", address: addressOf(path, null) })

/** The five, as the questions a tab actually holds open. */
const QUESTIONS: ReadonlyArray<readonly [string, Question]> = [
  ["owed", { which: "owed", request: { today: day } }],
  ["dated", { which: "dated", request: { month: day.slice(0, 7) } }],
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
  `one write, ${TABS.join("/")} tabs on one question — what the five standing views cost`,
)
console.log(
  `vault: ${vault.outlines.size} outlines, ${first.derived.nodes.length} records, ` +
    `${first.derived.byDay.size} days, ${vault.documents.size} documents`,
)
console.log(`each row is the median of ${ROUNDS} revisions\n`)

/**
 * ONE ROW: an arm, a question, a number of tabs, and where the write landed.
 *
 * WHAT IS TIMED IS THE POLL LOOP AND NOT THE ANSWER, which is the only unit
 * that means anything here: the framework re-reads per subscriber and then asks
 * that subscriber's own `isEqual` whether a frame is owed
 * (`@kolu/surface`'s `pollOnEvent`). Timing the read alone would leave out the
 * comparison — which the rebuilding arm pays once per tab over the whole answer
 * and the shared arm pays as an identity test — and that comparison is a third
 * of what this change is about. So each tab here holds its own last value and
 * asks the same schema equivalence the wire is given.
 */
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
      // THE TWO ARMS MUST ANSWER THE SAME THING. They are timed over different
      // revisions (each row makes its own writes), so this is not an equality
      // between two readings of one moment — it is the weaker and still
      // load-bearing claim that both arms answered the same SHAPE of question
      // over the same corpus. The differential is what holds them to the same
      // value revision by revision (`./standing.equivalence.test.ts`).
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

// ── the whole room ─────────────────────────────────────────────────────

/**
 * WHAT A TAB ACTUALLY HOLDS, all five at once — a page, the filter over it, the
 * calendar, what is owed and a move picker left open.
 *
 * The rows above are one question at a time, which is the honest way to price
 * each of them and is not what a write costs: a browser holds the sidebar's two
 * readings whatever page it is on, so a second tab is a second EVERYTHING. This
 * is that number.
 */
console.log("a whole tab — all five questions, per write")
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
            // Each tab's own poll loop, comparison included — see {@link timing}.
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

// ── and the claim under the numbers ────────────────────────────────────

/**
 * THE ARMS, HELD TO ONE ANSWER over a shared stretch of revisions — the check
 * the header promises, made where both arms can be asked the SAME reading.
 *
 * The rows above cannot make it (each times its own writes), and a figure
 * quoted without it would be a ratio between an answer and something else.
 */
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
