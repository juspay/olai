import { Result, Schema } from "effect"

import { type Agenda, type AgendaDay, type OwedRow, UPCOMING_DAYS } from "./agenda.ts"
import { type DayGroup, groupedOn } from "./dates.ts"
import { byDayKey, derive, unfinished, type Derived } from "./derive.ts"
import type { OutlineError } from "./errors.ts"
import { unkept } from "./kinds.ts"
import { isMirror, isPutAway, type Located, type LocatedRegular, storedMarker } from "./node.ts"
import { type Dated, datesOf, dayOf, monthOf } from "./occasion.ts"
import { Node } from "./node.ts"
import { outlineDocument } from "./document.ts"

import { TEST_CLAIMS } from "./claims.testlib.ts"
export { TEST_CLAIMS, NO_CLAIMS } from "./claims.testlib.ts"
import { pointingOf } from "./pointing.ts"
import { bodiedDocument, type Document, type Outline } from "./document.ts"
import { assemble, outlinesIn, type OutlineSet } from "./set.ts"
import { type Reading, validate } from "./validate.ts"
import { type Verdict, verdictOf } from "./verdict.ts"

export const parseOutline = (file: string, text: string, claims: import("./kinds.ts").Claims): Result.Result<Outline, ReadonlyArray<OutlineError>> => {
  const nodes: Located[] = []
  for (const [i, line] of text.split("\n").entries()) {
    if (!line.trim()) continue
    let value: unknown
    try { value = JSON.parse(line) }
    catch { return Result.fail([{ file, line: i + 1, code: "not-json", message: "fixture line is not JSON" }]) }
    const decoded = Schema.decodeUnknownResult(Node)(value)
    if (Result.isFailure(decoded)) return Result.fail([{ file, line: i + 1, code: "bad-record", message: "fixture line is not a record" }])
    nodes.push({ file, line: i + 1, node: decoded.success })
  }
  return Result.succeed(outlineDocument(claims, file, nodes))
}

export const FIXTURE_FILE = "a.olai"

export const outlineOf = (contents: string, file = FIXTURE_FILE, parse = parseOutline): Outline => {
  const parsed = parse(file, contents, TEST_CLAIMS)
  if (Result.isFailure(parsed)) throw new Error(unparsable(file, contents, parsed.failure))
  return parsed.success
}

export const nodesOf = (
  contents: string,
  file = FIXTURE_FILE,
): ReadonlyArray<Located> => outlineOf(contents, file).nodes

export const decodedOf = (
  files: Record<string, string>,
  parse = parseOutline,
): Map<string, Result.Result<Document, Verdict>> =>
  new Map(
    Object.entries(files).map(
      ([file, contents]) => [file, Result.succeed<Document>(outlineOf(contents, file, parse))],
    ),
  )

export const setOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string | readonly [file: string, text: string]> = [],
  broken: Record<string, string> = {},
  parse = parseOutline,
): OutlineSet =>
  assemble(TEST_CLAIMS,
    new Map<string, Result.Result<Document, Verdict>>([
      ...decodedOf(files, parse),
      ...documents.map((document) => {
        const [file, said] = typeof document === "string" ? [document, ""] : document
        const bodyless = unkept(TEST_CLAIMS, file)
        if (bodyless && said !== "") {
          throw new Error(
            `fixture \`${file}\` is a file the set holds the path of and not the ` +
              `content, so it cannot be given text: name it bare.`,
          )
        }
        return [
          file,
          Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, file, bodyless ? null : said)),
        ] as const
      }),
      ...Object.entries(broken).map(
        ([file, contents]) =>
          [file, Result.fail(verdictOf(failureOf(contents, file, parse)))] as const,
      ),
    ]),
  )

export const readingOf = (set: OutlineSet, table = TEST_CLAIMS): Reading & { readonly outlineRow: string } => ({
  outlineRow: "outline-olai",
  claims: table,
  set,
  derived: derive(table, recordsOf(set)),
  pointing: pointingOf(TEST_CLAIMS, set.documents),
})

export const validatedOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string | readonly [file: string, text: string]> = [],
  broken: Record<string, string> = {},
): OutlineSet => {
  const answered = validate(TEST_CLAIMS, setOf(files, documents, broken))
  if (Result.isFailure(answered)) {
    throw new Error("a validation answers with a set, whatever it finds")
  }
  return answered.success.set
}

export const failureOf = (
  contents: string,
  file = FIXTURE_FILE,
  parse = parseOutline,
): ReadonlyArray<OutlineError> => {
  const parsed = parse(file, contents, TEST_CLAIMS)
  if (Result.isSuccess(parsed)) {
    throw new Error(
      `fixture \`${file}\` parses, so it cannot stand in for a file that does not:\n` +
        contents.split("\n").map((line, index) => `  ${index + 1} | ${line}`).join("\n"),
    )
  }
  return parsed.failure
}

export const inZone = (zone: string, body: () => void): void => {
  const was = process.env["TZ"] ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  process.env["TZ"] = zone
  try {
    body()
  } finally {
    process.env["TZ"] = was
  }
}

export const STAMP_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/

export const nodesOfFiles = (
  files: Record<string, string>,
): ReadonlyArray<Located> => recordsOf(setOf(files))

export const seeded = (seed: number): (() => number) => {
  let at = seed >>> 0
  return () => {
    at = (at + 0x6D2B79F5) | 0
    let mixed = Math.imul(at ^ (at >>> 15), 1 | at)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const unparsable = (
  file: string,
  contents: string,
  errors: ReadonlyArray<OutlineError>,
): string =>
  [
    `fixture \`${file}\` does not parse, so this test is not testing what it means to:`,
    ...errors.map((error) => `  ${error.file}:${error.line} ${error.code}: ${error.message}`),
    "as written:",
    ...contents.split("\n").map((line, index) => `  ${index + 1} | ${line}`),
  ].join("\n")

export const vaultOf = (
  { files, records, seed = 20260817 }: {
    readonly files: number
    readonly records: number
    readonly seed?: number
  },
): ReadonlyMap<string, string> => {
  const random = seeded(seed)
  const corpus = new Map<string, string>()
  for (let at = 0; at < files; at++) {
    const path = pathOf(random, at)
    if (corpus.has(path)) continue
    corpus.set(path, fileOf(random, at, records))
  }
  return corpus
}

export const settled = (held: ReadonlyMap<string, string>): ReadonlyMap<string, string> => {
  const declared = new Set<string>()
  for (const text of held.values()) {
    for (const line of text.split("\n")) {
      if (line !== "") declared.add(String((JSON.parse(line) as { id: string }).id))
    }
  }
  return new Map(
    [...held].map(([file, text]) => [
      file,
      text
        .split("\n")
        .filter((line) => {
          if (line === "") return false
          const record = JSON.parse(line) as { readonly mirror?: string }
          return record.mirror === undefined || declared.has(record.mirror)
        })
        .join("\n"),
    ]),
  )
}

const pathOf = (random: () => number, at: number): string => {
  const roll = random()
  if (roll < 0.2) return `area${at % 20}/note${at}.olai`
  if (roll < 0.24) return `area${at % 20}.olai`
  return `note${at}.olai`
}

const fileOf = (random: () => number, at: number, records: number): string => {
  const lines: Array<string> = []
  const root = `f${at}r`
  lines.push(JSON.stringify({ id: root, ord: "a0", title: `file ${at}` }))
  for (let which = 1; which < records; which++) {
    const id = `f${at}n${which}`
    const record: Record<string, unknown> = {
      id,
      parent: root,
      ord: `a${which}`,
      title: `record ${which} of file ${at}${titleTags(at, which)}`,
    }
    if (random() < 0.3) record["todo"] = true
    else if (random() < 0.15) record["done"] = which % 2 === 0 ? true : dateFor(at, which + 3)
    else if (random() < 0.1) {
      record["cancelled"] = which % 2 === 0 ? true : dateFor(at, which + 5)
    }
    if (which % 4 === 0) record["date"] = dateFor(at, which)
    if (which > 1 && random() < 0.1) record["after"] = [`f${at}n${which - 1}`]
    if (which % 5 === 0) {
      record["desc"] = which % 10 === 0
        ? `a note about @f${at}n1 and what it is for`
        : `a note about #upkeep${at % 12} and what this is for`
    }
    if (at > 0 && random() < 0.05) {
      lines.push(
        JSON.stringify({ id: `${id}m`, parent: root, ord: `b${which}`, mirror: `f${at - 1}n1` }),
      )
    }
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

const dateFor = (at: number, which: number): string => {
  const day = DAYS[(at * 7 + which) % DAYS.length] as string
  return which % 8 === 0 ? `${day}T09:30:00-04:00` : day
}

const DAYS: ReadonlyArray<string> = Array.from({ length: 24 * 28 }, (_, at) => {
  const month = Math.floor(at / 28)
  const printed = (value: number): string => String(value).padStart(2, "0")
  return `${2025 + Math.floor(month / 12)}-${printed((month % 12) + 1)}-${
    printed((at % 28) + 1)
  }`
})

const titleTags = (at: number, which: number): string =>
  `${which % 3 === 0 ? ` #area${at % 20}` : ""}${
    which % 5 === 0 ? ` #topic${(at + which) % 40}` : ""
  }`

export const retitled = (text: string, which: number): string => {
  const written = text.replace(/"title":"record 1 of file \d+"/, `"title":"${EDITED}${which}"`)
  if (written === text) {
    throw new Error(
      `fixture: this is not a \`vaultOf\` file — it holds no record to retitle:\n` +
        text.split("\n").slice(0, 3).map((line, index) => `  ${index + 1} | ${line}`).join("\n"),
    )
  }
  return written
}

export const retitledIn = (nodes: ReadonlyArray<Located>): number | undefined => {
  for (const at of nodes) {
    const title = (at.node as { readonly title?: string }).title
    if (title?.startsWith(EDITED) === true) return Number(title.slice(EDITED.length))
  }
  return undefined
}

const EDITED = "edited "

export const median = (times: ReadonlyArray<number>): number =>
  [...times].sort((one, other) => one - other)[Math.floor(times.length / 2)] ?? 0

export const timed = (run: () => void): number => {
  const at = Bun.nanoseconds()
  run()
  return (Bun.nanoseconds() - at) / 1e6
}

export const alternating = (
  arms: readonly [() => unknown, () => unknown],
  rounds = 9,
): readonly [number, number] => {
  for (const arm of arms) timed(arm)
  const runs = Array.from({ length: rounds }, (_, round) => {
    const order = round % 2 === 0 ? [0, 1] : [1, 0]
    const times: Array<number> = []
    for (const which of order) times[which] = timed(arms[which as 0 | 1])
    return times
  })
  return [
    median(runs.map((round) => round[0] as number)),
    median(runs.map((round) => round[1] as number)),
  ]
}

export const timesSaid = (
  name: string,
  times: ReadonlyArray<number>,
  width = 8,
): string => {
  const ms = (at: number) => `${at.toFixed(2)}ms`
  return `${name.padEnd(width)} median ${ms(median(times))}` +
    `, mean ${ms(times.reduce((one, other) => one + other, 0) / times.length)}` +
    `, min ${ms(Math.min(...times))}, max ${ms(Math.max(...times))}`
}

export const runtimeSaid = (): string =>
  `runtime: ${
    process.versions.bun !== undefined ? `bun ${process.versions.bun}` : `node ${process.version}`
  }`

export const recordsOf = (set: OutlineSet): ReadonlyArray<Located> =>
  outlinesIn(set).flatMap((outline) => outline.nodes)

export const datedNodes = (derived: Derived): ReadonlyArray<Dated> =>
  derived.nodes.flatMap((located) =>
    isMirror(located.node) || isPutAway(TEST_CLAIMS, located.file)
      ? []
      : datesOf(located.node).map((dated) => ({
        at: located as LocatedRegular,
        ...dated,
      }))
  )

export const walkedByDay = (
  derived: Derived,
): ReadonlyMap<string, ReadonlyArray<Dated>> => {
  const days = new Map<string, Array<Dated>>()
  for (const dated of datedNodes(derived)) {
    const day = dayOf(dated.date)
    const bucket = days.get(day)
    if (bucket === undefined) days.set(day, [dated])
    else bucket.push(dated)
  }
  return days
}

export const walkedDays = (
  derived: Derived,
  month: string,
): ReadonlyArray<string> => {
  const days = new Set<string>()
  for (const dated of datedNodes(derived)) {
    const day = dayOf(dated.date)
    if (monthOf(day) === month) days.add(day)
  }
  return [...days].sort(byDayKey)
}

export const walkedOn = (
  derived: Derived,
  day: string,
): ReadonlyArray<DayGroup> => groupedOn(derived, walkedByDay(derived).get(day) ?? [])

export const walkedAgenda = (derived: Derived, today: string): Agenda => {
  const walked = walkedByDay(derived)
  const days = [...walked.keys()].sort(byDayKey)
  const overdue: Array<AgendaDay> = []
  for (const date of days.filter((day) => day < dayOf(today))) {
    const groups = owedWalk(derived, walked.get(date) ?? [])
    if (groups.length > 0) overdue.push({ date, groups })
  }
  const upcoming: Array<AgendaDay> = []
  for (const date of days.filter((day) => day > today)) {
    if (upcoming.length === UPCOMING_DAYS) break
    const groups = owedWalk(derived, walked.get(date) ?? [])
    if (groups.length > 0) upcoming.push({ date, groups })
  }
  return { overdue, today: owedWalk(derived, walked.get(today) ?? []), upcoming }
}

export const firstRowsOf = (agenda: Agenda, cap: number): ReadonlyArray<OwedRow> => {
  const nodes = [
    ...agenda.overdue.flatMap((day) => day.groups.flatMap((group) => group.nodes)),
    ...agenda.today.flatMap((group) => group.nodes),
  ]
  const want = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0
  return nodes.slice(0, want).map((entry) => ({
    id: entry.shows.node.id,
    file: entry.shows.file,
    title: entry.shows.node.title,
    date: entry.date,
    ...(entry.status === undefined ? {} : { status: entry.status }),
  }))
}

const owedWalk = (
  derived: Derived,
  dated: ReadonlyArray<Dated>,
): ReadonlyArray<DayGroup> =>
  groupedOn(derived, dated.filter((one) => unfinished(storedMarker(one.at.node))))

export const skippedDays = (
  derived: Derived,
  month: string,
): ReadonlyArray<string> => {
  const days: Array<string> = []
  for (const day of derived.byDay.keys()) {
    const own = monthOf(day)
    if (own < month) continue
    if (own > month) break
    days.push(day)
  }
  return days
}

export const skippedAgenda = (derived: Derived, today: string): Agenda => {
  const overdue: Array<AgendaDay> = []
  const now = dayOf(today)
  for (const [date, dated] of derived.byDay) {
    if (date >= now) break
    const groups = owedWalk(derived, dated)
    if (groups.length > 0) overdue.push({ date, groups })
  }
  const upcoming: Array<AgendaDay> = []
  for (const [date, dated] of derived.byDay) {
    if (date <= today) continue
    if (upcoming.length === UPCOMING_DAYS) break
    const groups = owedWalk(derived, dated)
    if (groups.length > 0) upcoming.push({ date, groups })
  }
  return {
    overdue,
    today: owedWalk(derived, derived.byDay.get(today) ?? []),
    upcoming,
  }
}

export const findingsIn = (set: OutlineSet): ReadonlyArray<OutlineError> => {
  const seen = new Set<OutlineError>()
  const rows: Array<OutlineError> = []
  for (const entry of set.broken) {
    for (const row of entry.errors) {
      if (seen.has(row)) continue
      seen.add(row)
      rows.push(row)
    }
  }
  return rows
}
