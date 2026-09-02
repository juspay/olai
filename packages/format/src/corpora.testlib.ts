/**
 * THE CORPORA, AND THE EDITS OVER THEM — one generator, two differentials.
 *
 * `./patch.test.ts` wrote this to hold the patcher to `derive`, and every arm
 * of it is there because a round found something the arm before it could not
 * reach: ids drawn so a duplicate is a corner rather than the rule, both tag
 * sigils over one pool of names, a small span of days so buckets have members
 * and a month boundary falls inside, marks that carry an instant, and the three
 * STRUCTURAL edits — two records swapping lines, one deleted, one moved between
 * files verbatim — which is the correction a review forced when five hundred
 * field-only rounds went green over a real bug in key order.
 *
 * IT IS A MODULE because a second differential needs the same corpora, and the
 * alternative is the drift this package keeps naming: `./incremental.test.ts`
 * holds the incremental validator to the full one over generated edit
 * sequences, and a generator of its own would have been a second opinion about
 * what an awkward set looks like — written by somebody who had not met the
 * corners the first one was grown against. What that file adds instead is the
 * dimension this one has no reason to carry: the DOCUMENTS beside the outlines,
 * which the patcher does not read and the validator's `doc` rule does.
 *
 * The functions here take their randomness as a parameter
 * ({@link ./fixtures.testlib.ts}'s `seeded`), so a caller owns its own stream
 * and two suites cannot shift each other's corpora by drawing in a different
 * order.
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`.
 */

import { nodesOf } from "./fixtures.testlib.ts"
import type { SetDelta } from "./patch.ts"

/** A corpus as a fixture writes one: path → the file's JSONL. */
export type Corpus = Record<string, string>

/** What moved between two corpora, in the frame the wire already speaks: a
 *  file whose text changed is an upsert, a file that went away is a remove.
 *
 *  The two corpora need not be CONSECUTIVE, and one caller depends on that: a
 *  validation that follows a refusal is handed everything that has moved since
 *  the last set anybody published, which may be several edits back
 *  ({@link ../../store/src/codec.ts}'s `Since` keeps its lists rather than
 *  clearing them). */
export const deltaOf = (before: Corpus, after: Corpus): SetDelta => ({
  upserts: Object.entries(after)
    .filter(([file, text]) => before[file] !== text)
    .map(([file, text]) => [file, { nodes: nodesOf(text, file) }] as const),
  removes: Object.keys(before).filter((file) => !(file in after)),
})

export const pick = <T>(random: () => number, from: ReadonlyArray<T>): T =>
  from[Math.floor(random() * from.length)] as T

/** Five paths, and each of them says something: two plain outlines, one in a
 *  directory (so path order is not file-name order), one in a directory NAMED
 *  after a file beside it (so the two readings of path order — a plain string
 *  compare and a walk that descends — disagree about which comes first, which
 *  is slice 4's landmine and is now one answer, `byPath`), and the archive,
 *  whose records are exempt from blockedness at both ends of an arrow. */
export const FILES = ["a.org", "a/inner.org", "b.org", "deep/c.org", "_olai/Trash.org"] as const
/** The names records are drawn from — small enough that a target often names a
 *  record that is really there, and often one that is not. */
export const IDS = Array.from({ length: 24 }, (_, at) => `n${at}`)
/** Three of them, so siblings tie on `ord` and the tie-break gets exercised. */
const ORDS = ["a", "b", "c"] as const

/**
 * An id for the next record: a fresh one nearly always, one already claimed
 * now and then.
 *
 * Deliberately not uniform. Drawing ids uniformly from a pool makes a duplicate
 * the RULE at these corpus sizes, and a duplicate is the one corner the patcher
 * hands straight back to the rebuild — so a uniform generator would have
 * measured the fallback five hundred times and the patcher hardly at all. This
 * writes the corpora a directory actually holds, with the corner still turning
 * up often enough to be tested.
 */
export const idFor = (random: () => number, used: Set<string>): string => {
  const free = IDS.filter((id) => !used.has(id))
  const id = random() < 0.08 || free.length === 0
    ? pick(random, [...used, ...free])
    : pick(random, free)
  used.add(id)
  return id
}

/**
 * A tag for prose to write, or nothing — what `taggedBy` is keyed by.
 *
 * Mostly an `@` on an id the corpus really uses, so a mention is usually a
 * REFERENCE the reading over this index would draw; sometimes a word nothing
 * declares, which is a person tag and has to file exactly the same way, since
 * the index is about what prose says rather than about what exists.
 *
 * BOTH SIGILS, and the `#` half draws from the SAME pool of ids on purpose:
 * `#n3` and `@n3` are two keys of one map that a sigil-stripped index would
 * have collided, and the only way a generated corpus reaches that pair is by
 * spelling topics the way it spells mentions.
 */
const tagged = (random: () => number): string => {
  const roll = random()
  if (roll < 0.55) return ""
  if (roll < 0.8) return ` @${pick(random, IDS)}`
  if (roll < 0.92) return ` #${pick(random, IDS)}`
  return roll < 0.96 ? " @nobody" : " #topic"
}

/**
 * A day for a record to carry, drawn from a SMALL span — what `byDay` is keyed
 * by, and the reason the span is small.
 *
 * Ten days over two months, so several records land on ONE day (a bucket with
 * members to order, which is where the corpus-order promise lives) and a month
 * boundary falls inside the range (the key order the calendar steps). A day
 * drawn from a year would give nearly every record a bucket of its own, and
 * every one of those promises would go untested at five hundred rounds.
 *
 * Half of them carry a TIME, because a datetime lands on its day and the key is
 * a prefix of the value — a fold that filed the raw value would pass every
 * bucket-membership assertion here and produce a calendar with a dot per
 * appointment.
 *
 * The values are ISO the way `./parse.ts` means it, because a corpus this
 * generator writes has to be one the format APPROVES: a fixture that failed to
 * parse would take the whole round out of the comparison rather than failing an
 * assertion about it, which is what the builder below refuses over.
 */
const dateFor = (random: () => number): string => {
  const day = DAYS[Math.floor(random() * DAYS.length)] as string
  return random() < 0.5 ? day : `${day}T0${Math.floor(random() * 9)}:30:00-04:00`
}

/** The days records are drawn from — see {@link dateFor}. Two months, so the
 *  boundary the calendar's month walk stops at is inside the corpus. */
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

/**
 * A record's MARK, and what it carries — `true`, or the instant it was reached.
 *
 * A dated `done` is one of the two fields that put a node on a day, so a
 * generator that only ever wrote `true` left half of `byDay`'s fold unreached:
 * every node would have been on its `date` and nothing on the day it was
 * finished, and the precedence rule between the two (`./occasion.ts`'s
 * `datesOf`) would never have decided anything. It writes an instant on every
 * mark, not only on `done`, because a dated `doing` is a legal record the fold
 * must pass OVER — the one shape that is in the format and out of the journal.
 */
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
    // Same-file usually, and now and then a parent in ANOTHER file — a set the
    // validator condemns and `derive` still answers, and the only way to get
    // two siblings whose `ord` tie has to break on corpus order rather than on
    // line number alone (`bySibling`).
    if (own.length > 0 && random() < 0.4) {
      record["parent"] = random() < 0.7 ? pick(random, own) : pick(random, [...used])
    }
    if (random() < 0.25) record["mirror"] = pick(random, IDS)
    else {
      record["title"] = `line ${at}${tagged(random)}`
      if (random() < 0.4) marked(random, record)
      // A `date` on a third of them — the other field a day is keyed by, and
      // the one a repeat rule would ride. Without it `byDay` is an empty map
      // over every generated corpus and this suite says nothing about the index
      // it now compares (`./vault.test.ts`'s reason, one seed over).
      if (random() < 0.33) record["date"] = dateFor(random)
      if (random() < 0.3) record["after"] = [pick(random, IDS)]
      if (random() < 0.3) record["blocks"] = [pick(random, IDS)]
      if (random() < 0.2) record["see"] = [pick(random, IDS)]
      // A note, sometimes with a tag in it — the second half of what
      // `taggedBy` files, and the reason a title alone would not do: a
      // record writing one tag in BOTH is one entry, so the fold's
      // once-per-record rule is only reachable from here.
      if (random() < 0.3) record["desc"] = `a note${tagged(random)}${tagged(random)}`
    }
    own.push(id)
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

/** A corpus, and the ids it has spent — the delta below draws from the same
 *  pool, so a rewritten file goes on naming records its neighbours hold. */
export const corpusOf = (random: () => number): { files: Corpus; used: Set<string> } => {
  const files: Corpus = {}
  const used = new Set<string>()
  // A file the directory does not hold at all, so a delta can bring one in and
  // the flat list has to find its place in path order.
  for (const file of FILES) if (random() < 0.75) files[file] = fileOf(random, used)
  return { files, used }
}

/**
 * One file, edited the way a person edits one: the same records, one of them
 * changed. This is the delta the patcher is FOR — a keystroke, a mark, an edge
 * — and a generator that only ever replaced whole files would have tested the
 * arriving-corpus path over and over and the keystroke path never.
 */
const tweak = (random: () => number, text: string): string => {
  const lines = text.split("\n").filter((line) => line !== "")
  if (lines.length === 0) return text
  const at = Math.floor(random() * lines.length)
  const roll = random()
  // Two records SWAP LINES. No id is minted and none is dropped, and every
  // index keyed by where a record IS has to move — which is the case the
  // patcher got wrong until grok reproduced it, precisely because a generator
  // that only ever edited fields could not reach it.
  if (roll < 0.1 && lines.length > 1) {
    const other = Math.floor(random() * lines.length)
    const held = lines[at] as string
    lines[at] = lines[other] as string
    lines[other] = held
    return lines.join("\n")
  }
  // The record goes away, which is the delete a patcher has to answer for: an
  // id leaves the corpus and whatever named it is left naming nothing.
  if (roll < 0.2) {
    lines.splice(at, 1)
    return lines.join("\n")
  }
  const record = JSON.parse(lines[at] as string) as Record<string, unknown>
  if ("mirror" in record) record["mirror"] = pick(random, IDS)
  else if (roll < 0.4) record["title"] = `edited ${Math.floor(random() * 100)}${tagged(random)}`
  else if (roll < 0.45) {
    // The note rewritten — the edit this whole feature is about, since a
    // reference somebody adds in prose is a keystroke in a `desc` and nothing
    // else about the record moves.
    const written = `edited note${tagged(random)}`
    if (written === "edited note" && random() < 0.5) delete record["desc"]
    else record["desc"] = written
  } else if (roll < 0.6) {
    for (const mark of ["done", "doing", "todo"]) delete record[mark]
    if (random() < 0.75) marked(random, record)
  } else if (roll < 0.65) {
    // THE DATE REWRITTEN, which is a record moving between two of `byDay`'s
    // keys — and, when it is the last one on a day, a key going away and the
    // promised key order having to be restored. Beside the mark edit because
    // completing a repeating node is both at once (`@olai/ops`' `planMark`
    // dates the `done` and advances the `date`), which is the delta this index
    // sees most often in a directory anybody schedules anything in.
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

/**
 * One record moved OUT of a file and INTO another, verbatim.
 *
 * An archive, a reparent across outlines — and the second case the property
 * test could not reach, because it is two files in one delta and nothing minted
 * or dropped between them. The record keeps whatever it said, so a `parent` it
 * carries becomes a foreign one: a set the validator condemns and `derive` is
 * written to answer over.
 */
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
