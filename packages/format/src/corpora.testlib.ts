import { nodesOf } from "./fixtures.testlib.ts"
import type { SetDelta } from "./patch.ts"

export type Corpus = Record<string, string>

export const deltaOf = (before: Corpus, after: Corpus): SetDelta => ({
  upserts: Object.entries(after)
    .filter(([file, text]) => before[file] !== text)
    .map(([file, text]) => [file, { nodes: nodesOf(text, file) }] as const),
  removes: Object.keys(before).filter((file) => !(file in after)),
})

export const pick = <T>(random: () => number, from: ReadonlyArray<T>): T =>
  from[Math.floor(random() * from.length)] as T

export const FILES = ["a.olai", "a/inner.olai", "b.olai", "deep/c.olai", "_olai/Trash.olai"] as const
export const IDS = Array.from({ length: 24 }, (_, at) => `n${at}`)
const ORDS = ["a", "b", "c"] as const

export const idFor = (random: () => number, used: Set<string>): string => {
  const free = IDS.filter((id) => !used.has(id))
  const id = random() < 0.08 || free.length === 0
    ? pick(random, [...used, ...free])
    : pick(random, free)
  used.add(id)
  return id
}

const tagged = (random: () => number): string => {
  const roll = random()
  if (roll < 0.55) return ""
  if (roll < 0.8) return ` @${pick(random, IDS)}`
  if (roll < 0.92) return ` #${pick(random, IDS)}`
  return roll < 0.96 ? " @nobody" : " #topic"
}

const dateFor = (random: () => number): string => {
  const day = DAYS[Math.floor(random() * DAYS.length)] as string
  return random() < 0.5 ? day : `${day}T0${Math.floor(random() * 9)}:30:00-04:00`
}

const DAYS = [
  "2026-07-30",
  "2026-07-31",
  "2026-08-01",
  "2026-08-02",
  "2026-08-05",
  "2026-08-11",
  "2026-08-12",
  "2026-08-20",
  "2026-08-21",
  "2026-09-01",
] as const

const marked = (random: () => number, record: Record<string, unknown>): void => {
  const mark = pick(random, ["done", "doing", "todo"])
  record[mark] = random() < 0.5 ? true : dateFor(random)
}

export const fileOf = (random: () => number, used: Set<string>): string => {
  const lines: Array<string> = []
  const own: Array<string> = []
  const many = Math.floor(random() * 5)
  for (let at = 0; at < many; at++) {
    const id = idFor(random, used)
    const record: Record<string, unknown> = { id, ord: pick(random, ORDS) }
    if (own.length > 0 && random() < 0.4) {
      record["parent"] = random() < 0.7 ? pick(random, own) : pick(random, [...used])
    }
    if (random() < 0.25) record["mirror"] = pick(random, IDS)
    else {
      record["title"] = `line ${at}${tagged(random)}`
      if (random() < 0.4) marked(random, record)
      if (random() < 0.33) record["date"] = dateFor(random)
      if (random() < 0.3) record["after"] = [pick(random, IDS)]
      if (random() < 0.3) record["blocks"] = [pick(random, IDS)]
      if (random() < 0.2) record["see"] = [pick(random, IDS)]
      if (random() < 0.3) record["desc"] = `a note${tagged(random)}${tagged(random)}`
    }
    own.push(id)
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

export const corpusOf = (random: () => number): { files: Corpus; used: Set<string> } => {
  const files: Corpus = {}
  const used = new Set<string>()
  for (const file of FILES) if (random() < 0.75) files[file] = fileOf(random, used)
  return { files, used }
}

const tweak = (random: () => number, text: string): string => {
  const lines = text.split("\n").filter((line) => line !== "")
  if (lines.length === 0) return text
  const at = Math.floor(random() * lines.length)
  const roll = random()
  if (roll < 0.1 && lines.length > 1) {
    const other = Math.floor(random() * lines.length)
    const held = lines[at] as string
    lines[at] = lines[other] as string
    lines[other] = held
    return lines.join("\n")
  }
  if (roll < 0.2) {
    lines.splice(at, 1)
    return lines.join("\n")
  }
  const record = JSON.parse(lines[at] as string) as Record<string, unknown>
  if ("mirror" in record) record["mirror"] = pick(random, IDS)
  else if (roll < 0.4) record["title"] = `edited ${Math.floor(random() * 100)}${tagged(random)}`
  else if (roll < 0.45) {
    const written = `edited note${tagged(random)}`
    if (written === "edited note" && random() < 0.5) delete record["desc"]
    else record["desc"] = written
  } else if (roll < 0.6) {
    for (const mark of ["done", "doing", "todo"]) delete record[mark]
    if (random() < 0.75) marked(random, record)
  } else if (roll < 0.65) {
    if (random() < 0.75) record["date"] = dateFor(random)
    else delete record["date"]
  } else if (roll < 0.85) {
    if (random() < 0.5) record["after"] = [pick(random, IDS)]
    else delete record["after"]
  } else {
    if (random() < 0.5) record["blocks"] = [pick(random, IDS)]
    else delete record["blocks"]
  }
  lines[at] = JSON.stringify(record)
  return lines.join("\n")
}

const relocated = (random: () => number, corpus: Corpus): Corpus => {
  const holding = FILES.filter((file) => (corpus[file] ?? "") !== "")
  if (holding.length === 0) return corpus
  const from = pick(random, holding)
  const lines = (corpus[from] as string).split("\n").filter((line) => line !== "")
  if (lines.length === 0) return corpus
  const [record] = lines.splice(Math.floor(random() * lines.length), 1)
  const to = pick(random, FILES.filter((file) => file !== from))
  const held = corpus[to] ?? ""
  return {
    ...corpus,
    [from]: lines.join("\n"),
    [to]: held === "" ? (record as string) : `${held}\n${record}`,
  }
}

export const editOf = (
  random: () => number,
  before: Corpus,
  used: Set<string>,
): Corpus => {
  let after = { ...before }
  const many = 1 + Math.floor(random() * 2)
  for (let at = 0; at < many; at++) {
    const roll = random()
    if (roll < 0.15) {
      after = relocated(random, after)
      continue
    }
    const file = pick(random, FILES)
    const held = after[file]
    if (roll < 0.25) delete after[file]
    else if (roll < 0.45 || held === undefined) after[file] = fileOf(random, used)
    else after[file] = tweak(random, held)
  }
  return after
}
