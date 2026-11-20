import { isMarkdown, isOpaque } from "./document.ts"
import type { Outline } from "./document.ts"
import { Schema } from "effect"

import {
  ancestorsOf,
  byCorpus,
  type Derived,
  isBlocked,
  isMirrored,
  mayHoldTag,
  type Row,
  tagText,
  titleParts,
} from "./derive.ts"
import type { Markdown, Unkept } from "./document.ts"
import { type Custom, customOf } from "./custom.ts"
import { proseIn, proseLineOffset } from "./frontmatter.ts"
import { shiftDay, shiftMinutes, shiftMonth, weekdayOf } from "./calendar.ts"
import type { DayGroup } from "./dates.ts"
import { datesOf, dayOf, monthOf } from "./occasion.ts"
import { basenameOf } from "./paths.ts"
import { nothing } from "./write.ts"
import {
  MARKS,
  mintedInto,
  PROPERTIES,
  isLeftoverArchive,
  isTrashed,
  isMirror,
  type Located,
  type LocatedRegular,
  type RegularNode,
  settles,
  storedMarker,
} from "./node.ts"
import {
  isDigitRun,
  type PropDeclarations,
  type PropType,
} from "./typing.ts"

export const SEARCH_FIELDS = ["title", "id", "tag", "desc"] as const
export type SearchField = (typeof SEARCH_FIELDS)[number]

const FIELD_WEIGHT = { title: 1000, id: 750, tag: 500, desc: 250 } as const

const folded = new WeakMap<RegularNode, Record<SearchField, ReadonlyArray<string>>>()

const haystacksOf = (
  node: RegularNode,
): Record<SearchField, ReadonlyArray<string>> => {
  const before = folded.get(node)
  if (before !== undefined) return before
  const now = foldOf(node)
  folded.set(node, now)
  return now
}

const foldOf = (
  node: RegularNode,
): Record<SearchField, ReadonlyArray<string>> => ({
  title: [node.title.toLowerCase()],
  id: [node.id.toLowerCase()],
  tag: mayHoldTag(node.title)
    ? titleParts(node.title).flatMap((part) => {
      if (part.kind !== "tag") return []
      const written = tagText(part).toLowerCase()
      return [written.slice(1), written]
    })
    : [],
  desc: node.desc === undefined ? [] : [node.desc.toLowerCase()],
})

export const hayOf = (node: RegularNode): string => {
  const hay = haystacksOf(node)
  return SEARCH_FIELDS.map((field) => hay[field].join("\n")).join("\n")
}

const WORD_EDGE = /[\s/_-]/

const positionBonus = (haystack: string, needle: string): number => {
  const at = haystack.indexOf(needle)
  if (at === -1) return -1
  if (at === 0) return 100
  return WORD_EDGE.test(haystack[at - 1] as string) ? 50 : 0
}

const IS_VALUES = [
  ...MARKS,
  "marked",
  "blocked",
  "mirrored",
  "trashed",
] as const
type IsValue = (typeof IS_VALUES)[number]

const isIsValue = (value: string): value is IsValue =>
  (IS_VALUES as ReadonlyArray<string>).includes(value)

const DAY_READINGS = ["date", "created", "changed"] as const
type DayReading = (typeof DAY_READINGS)[number]

const isDayReading = (field: HasField): field is DayReading =>
  (DAY_READINGS as ReadonlyArray<string>).includes(field)

const HAS_FIELDS = ["desc", ...DAY_READINGS, "see", "after", "repeat"] as const
type HasField = (typeof HAS_FIELDS)[number]

const isHasField = (value: string): value is HasField =>
  (HAS_FIELDS as ReadonlyArray<string>).includes(value)

type CarriedField = Exclude<HasField, DayReading>

const OPERATORS = ["is", "has", ...DAY_READINGS, "prop"] as const
type Operator = (typeof OPERATORS)[number]

const isOperator = (name: string): name is Operator =>
  (OPERATORS as ReadonlyArray<string>).includes(name)

interface DaysClause {
  readonly kind: "days"
  readonly of: DayReading
  readonly from: string | null
  readonly to: string | null
}

type Clause =
  | { readonly kind: "is"; readonly value: IsValue }
  | { readonly kind: "has"; readonly field: CarriedField }
  | DaysClause
  | {
    readonly kind: "prop"
    readonly key: string
    readonly value: string | null
    readonly span?: PropSpan
  }

export type PropSpan =
  | { readonly of: "date"; readonly from: string | null; readonly to: string | null }
  | { readonly of: "int"; readonly from: number | null; readonly to: number | null }

type Alternative =
  | { readonly kind: "term"; readonly word: string; readonly negated: boolean }
  | { readonly kind: "clause"; readonly clause: Clause; readonly negated: boolean }

type Group = ReadonlyArray<Alternative>

export const Refusal = Schema.Struct({
  token: Schema.String,
  reason: Schema.String,
})
export type Refusal = typeof Refusal.Type

export type Filter =
  | { readonly kind: "nothing" }
  | { readonly kind: "refused"; readonly refusals: ReadonlyArray<Refusal> }
  | {
    readonly kind: "asking"
    readonly groups: ReadonlyArray<Group>
    readonly namedProps: ReadonlyArray<Extract<Clause, { kind: "prop" }>>
    readonly speaksOfTrash: boolean
  }

const QUOTE = `"`

const SPACE = /\s/

interface Token {
  readonly written: string
  readonly text: string
  readonly quoted: boolean
  readonly negated: boolean
}

const tokensOf = (text: string): {
  readonly tokens: ReadonlyArray<Token>
  readonly unclosed: string | null
} => {
  const tokens: Array<Token> = []
  let at = 0
  while (at < text.length) {
    if (SPACE.test(text[at] as string)) {
      at += 1
      continue
    }
    const start = at
    const negated = text[at] === "-" && at + 1 < text.length &&
      !SPACE.test(text[at + 1] as string)
    if (negated) at += 1
    const opens = at
    let read = ""
    let quoted = false
    let dangling = false
    while (at < text.length && !SPACE.test(text[at] as string)) {
      if (text[at] !== QUOTE) {
        read += text[at]
        at += 1
        continue
      }
      if (at === opens) quoted = true
      const closes = text.indexOf(QUOTE, at + 1)
      if (closes === -1) {
        at = text.length
        dangling = true
        break
      }
      read += text.slice(at + 1, closes)
      at = closes + 1
    }
    const written = text.slice(start, at)
    if (dangling) return { tokens, unclosed: written }
    tokens.push({ written, text: read.toLowerCase(), quoted, negated })
  }
  return { tokens, unclosed: null }
}

const JOINER = "OR"

const JOINING =
  `${JOINER} joins the token before it to the token after it — one of them is missing`

const UNCLOSED = `a quote nothing closes — a phrase runs from one ${QUOTE} to the next`

const NOTHING_QUOTED =
  `a phrase with no words in it — what to look for goes between the ${QUOTE}s`

export const parseFilter = (
  text: string,
  now: string,
  declarations?: PropDeclarations,
): Filter => {
  const groups: Array<Array<Alternative>> = []
  const namedProps: Array<Extract<Clause, { kind: "prop" }>> = []
  const refusals: Array<Refusal> = []
  let speaksOfTrash = false
  let joining = false
  let read = false

  const { tokens, unclosed } = tokensOf(text)
  for (const token of tokens) {
    if (token.written === JOINER) {
      if (joining || !read) {
        refusals.push({ token: token.written, reason: JOINING })
        continue
      }
      joining = true
      continue
    }
    read = true
    const alternative = alternativeOf(token, now, declarations)
    const joined = joining
    joining = false
    if ("reason" in alternative) {
      refusals.push({ token: token.written, reason: alternative.reason })
      continue
    }
    if (alternative.kind === "clause") {
      const { clause } = alternative
      if (clause.kind === "is" && clause.value === "trashed") speaksOfTrash = true
      if (clause.kind === "prop" && !alternative.negated) namedProps.push(clause)
    }
    const last = groups[groups.length - 1]
    if (joined && last !== undefined) last.push(alternative)
    else groups.push([alternative])
  }
  if (joining && unclosed === null) refusals.push({ token: JOINER, reason: JOINING })
  if (unclosed !== null) refusals.push({ token: unclosed, reason: UNCLOSED })

  if (refusals.length > 0) return { kind: "refused", refusals }
  if (groups.length === 0) return { kind: "nothing" }
  return { kind: "asking", groups: inCostOrder(groups), namedProps, speaksOfTrash }
}

const alternativeOf = (
  token: Token,
  now: string,
  declarations: PropDeclarations | undefined,
): Alternative | Refused => {
  if (token.text.trim() === "") return { reason: NOTHING_QUOTED }
  const asTerm = { kind: "term", word: token.text, negated: token.negated } as const
  if (token.quoted) return asTerm
  const colon = token.text.indexOf(":")
  const name = colon === -1 ? "" : token.text.slice(0, colon)
  if (!isOperator(name)) return asTerm
  const value = token.text.slice(colon + 1)
  const clause = clauseOf(name, value, now, declarations)
  if (clause === null) return { reason: teaching(name, value) }
  if ("reason" in clause) return clause
  return { kind: "clause", clause, negated: token.negated }
}

const costRank = (group: Group): number =>
  group.every((one) => one.kind === "clause") ? 0 : 1

const inCostOrder = (groups: ReadonlyArray<Group>): ReadonlyArray<Group> =>
  [...groups].sort((one, other) => costRank(one) - costRank(other))

const clauseOf = (
  name: Operator,
  value: string,
  now: string,
  declarations: PropDeclarations | undefined,
): Clause | Refused | null => {
  switch (name) {
    case "is":
      return isIsValue(value) ? { kind: "is", value } : null
    case "has":
      return hasClause(value)
    case "date":
    case "created":
    case "changed":
      return daysClause(name, value, now)
    case "prop":
      return propClause(value, now, declarations)
  }
}

interface Refused {
  readonly reason: string
}

const hasClause = (value: string): Clause | null => {
  if (!isHasField(value)) return null
  return isDayReading(value)
    ? { kind: "days", of: value, from: null, to: null }
    : { kind: "has", field: value }
}

const propClause = (
  value: string,
  now: string,
  declarations: PropDeclarations | undefined,
): Clause | Refused | null => {
  if (value === "") return null
  const at = value.indexOf("=")
  if (at === -1) return { kind: "prop", key: value, value: null }
  const key = value.slice(0, at)
  const held = value.slice(at + 1)
  if (key === "" || held === "") return null
  if (declarations === undefined) return { kind: "prop", key, value: held }
  const kind = declaredKind(declarations, key)
  if (kind === "date") {
    const span = spanOf(held, now)
    return span === null
      ? { reason: `prop:${key} is a date — ${DAY_VALUES}` }
      : { kind: "prop", key, value: null, span: { of: "date", ...span } }
  }
  if (kind === "int") {
    const span = intSpan(held)
    return span === null
      ? {
        reason: `prop:${key} is a whole number — write one (${key}=193), or a range ` +
          `of them (${key}=190..200, ${key}=190.., ${key}=..200)`,
      }
      : { kind: "prop", key, value: null, span: { of: "int", ...span } }
  }
  return readsAsRange(held, now)
    ? { reason: untypedRange(key, kind) }
    : { kind: "prop", key, value: held }
}

const declaredKind = (
  declarations: PropDeclarations,
  key: string,
): PropType["kind"] | undefined => declarations.get(key)?.type.kind

const readsAsRange = (value: string, now: string): boolean =>
  value.includes(RANGE) && (spanOf(value, now) !== null || intSpan(value) !== null)

const untypedRange = (key: string, kind: PropType["kind"] | undefined): string =>
  `prop:${key} takes a value, not a range — ${
    kind === undefined
      ? `nothing declares \`${key}\`, so its values are text`
      : `\`${key}\` is declared \`${kind}\``
  }, and comparing text as if it were a date or a number is what a range would ` +
  `be doing. Declare the key \`date\` or \`int\` in \`${mintedInto(PROPERTIES)}\` to ask for a span.`

const intSpan = (
  value: string,
): { readonly from: number | null; readonly to: number | null } | null => {
  const at = value.indexOf(RANGE)
  if (at === -1) return isDigitRun(value) ? { from: Number(value), to: Number(value) } : null
  const left = value.slice(0, at)
  const right = value.slice(at + RANGE.length)
  if (left === "" && right === "") return null
  if (left !== "" && !isDigitRun(left)) return null
  if (right !== "" && !isDigitRun(right)) return null
  return {
    from: left === "" ? null : Number(left),
    to: right === "" ? null : Number(right),
  }
}

const teaching = (name: Operator, value: string): string => {
  if (value === "") {
    return `${name}: was given no value — a space after the colon splits it into two words`
  }
  switch (name) {
    case "is":
      return `is: takes one of ${IS_VALUES.join(", ")}`
    case "has":
      return `has: takes one of ${HAS_FIELDS.join(", ")}`
    case "date":
    case "created":
    case "changed":
      return `${name}: takes ${DAY_VALUES}`
    case "prop":
      return "prop: takes a property key (prop:pr) or a key and a value (prop:agent=claude-opus)"
  }
}


const PARTIAL_DAY = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/
const RANGE = ".."

const RELATIVE_DAYS: ReadonlyMap<string, number> = new Map([
  ["today", 0],
  ["yesterday", -1],
  ["tomorrow", 1],
])

const RELATIVE_UNITS = ["week", "month", "year"] as const
type RelativeUnit = (typeof RELATIVE_UNITS)[number]

const isUnit = (name: string): name is RelativeUnit =>
  (RELATIVE_UNITS as ReadonlyArray<string>).includes(name)

const RELATIVE_STEPS: ReadonlyMap<string, number> = new Map([
  ["this", 0],
  ["last", -1],
  ["next", 1],
])

const RELATIVE_TEACHING = `${[...RELATIVE_DAYS.keys()].join(", ")}, or ${
  [...RELATIVE_STEPS.keys()].map((step) => `${step}-`).join(" / ")
} with ${RELATIVE_UNITS.join(", ")}`

const DURATION_UNITS: ReadonlyMap<string, { readonly minutes: number; readonly named: string }> =
  new Map([
    ["m", { minutes: 1, named: "minute" }],
    ["h", { minutes: 60, named: "hour" }],
    ["d", { minutes: 60 * 24, named: "day" }],
    ["w", { minutes: 60 * 24 * 7, named: "week" }],
  ])

const DURATION_SHAPE = /^(\d{1,6})([a-z]+)$/

export const DURATION_TEACHING = `a duration back from now (${
  [...DURATION_UNITS].map(([unit, { named }]) => `1${unit} = 1 ${named}`).join(", ")
}; no month or year units)`

const DAY_VALUES = "a day, month or year (2026-08-10, 2026-08, 2026), " +
  `a relative word (${RELATIVE_TEACHING}), ` +
  `${DURATION_TEACHING}, ` +
  "or a range of any of them (2026-08-01..2026-08-14, ..2026-08-10, " +
  "last-week.., 2h..30m). A bare duration is the range it opens: 1h is 1h.., " +
  "within the last hour"

const durationBefore = (value: string, now: string): string | null => {
  const shape = DURATION_SHAPE.exec(value)
  if (shape === null) return null
  const [, count, unit] = shape as unknown as [string, string, string]
  const size = DURATION_UNITS.get(unit)
  if (size === undefined) return null
  return shiftMinutes(now, -Number(count) * size.minutes)
}

interface Span {
  readonly from: string
  readonly to: string
}

export const relativeSpan = (word: string, now: string): Span | null => {
  const today = dayOf(now)
  const standing = weekdayOf(today)
  if (standing === null) return null

  const near = RELATIVE_DAYS.get(word)
  if (near !== undefined) {
    const day = shiftDay(today, near)
    return { from: day, to: day }
  }

  const at = word.indexOf("-")
  if (at === -1) return null
  const step = RELATIVE_STEPS.get(word.slice(0, at))
  const unit = word.slice(at + 1)
  if (step === undefined || !isUnit(unit)) return null

  if (unit === "week") {
    const monday = shiftDay(today, step * 7 - standing)
    return { from: monday, to: shiftDay(monday, 6) }
  }
  const months = unit === "month" ? step : step * 12
  const stepped = shiftMonth(monthOf(today), months)
  const whole = unit === "month" ? stepped : stepped.slice(0, 4)
  return { from: lowOf(whole), to: highOf(whole) }
}

const datePart = (value: string): string | null => {
  const shape = PARTIAL_DAY.exec(value)
  if (shape === null) return null
  const [, , month, day] = shape
  if (month !== undefined && !twoDigitsIn(month, 1, 12)) return null
  if (day !== undefined && !twoDigitsIn(day, 1, 31)) return null
  return value
}

const twoDigitsIn = (digits: string, low: number, high: number): boolean => {
  const value = Number(digits)
  return value >= low && value <= high
}

type Meaning =
  | { readonly kind: "span"; readonly span: Span }
  | { readonly kind: "moment"; readonly at: string }

const meaningOf = (value: string, now: string): Meaning | null => {
  const relative = relativeSpan(value, now)
  if (relative !== null) return { kind: "span", span: relative }
  const moment = durationBefore(value, now)
  if (moment !== null) return { kind: "moment", at: moment }
  return datePart(value) === null
    ? null
    : { kind: "span", span: { from: lowOf(value), to: highOf(value) } }
}

const edgesOf = (meaning: Meaning): Span =>
  meaning.kind === "moment"
    ? { from: meaning.at, to: meaning.at }
    : meaning.span

const daysClause = (of: DayReading, value: string, now: string): Clause | null => {
  const span = spanOf(value, now)
  return span === null ? null : { kind: "days", of, from: span.from, to: span.to }
}

const spanOf = (
  value: string,
  now: string,
): { readonly from: string | null; readonly to: string | null } | null => {
  const at = value.indexOf(RANGE)
  if (at === -1) {
    const meaning = meaningOf(value, now)
    if (meaning === null) return null
    const edges = edgesOf(meaning)
    return {
      from: edges.from,
      to: meaning.kind === "moment" ? null : edges.to,
    }
  }
  const left = value.slice(0, at)
  const right = value.slice(at + RANGE.length)
  if (left === "" && right === "") return null
  const low = left === "" ? null : meaningOf(left, now)
  if (left !== "" && low === null) return null
  const high = right === "" ? null : meaningOf(right, now)
  if (right !== "" && high === null) return null
  return {
    from: low === null ? null : edgesOf(low).from,
    to: high === null ? null : edgesOf(high).to,
  }
}

const lowOf = (value: string): string =>
  value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value

const highOf = (value: string): string =>
  value.length === 4 ? `${value}-12-31` : value.length === 7 ? `${value}-31` : value

export interface Match {
  readonly field: SearchField | null
  readonly score: number
  readonly props: ReadonlyArray<string>
}

export interface Matched {
  readonly at: LocatedRegular
  readonly match: Match
}

export interface Scope {
  readonly file?: string | undefined
  readonly under?: string | undefined
  readonly trashed?: boolean | undefined
}

const matchOf = (
  derived: Derived,
  at: LocatedRegular,
  filter: Filter,
): Match | null => {
  if (filter.kind !== "asking") return null

  const found = matchedBy(
    filter.groups,
    (clause) => holds(derived, at, clause),
    () => haystacksOf(at.node),
    SEARCH_FIELDS,
    FIELD_WEIGHT,
  )
  if (found === null) return null

  return { ...found, props: propsOf(customOf(at.node), filter) }
}

const matchedBy = <F extends string>(
  groups: ReadonlyArray<Group>,
  holdsClause: (clause: Clause) => boolean,
  hayOf: () => Record<F, ReadonlyArray<string>>,
  fields: ReadonlyArray<F>,
  weights: Record<F, number>,
): { readonly field: F | null; readonly score: number } | null => {
  let hay: Record<F, ReadonlyArray<string>> | null = null
  let score = 0
  let field: F | null = null
  let weight = -1

  for (const group of groups) {
    let holding = false
    let best: { readonly field: F; readonly score: number } | null = null
    for (const one of group) {
      if (one.kind === "clause") {
        if (holdsClause(one.clause) !== one.negated) holding = true
        continue
      }
      hay ??= hayOf()
      const hit = wordHit(hay, one.word, fields, weights)
      if (one.negated) {
        if (hit === null) holding = true
        continue
      }
      if (hit === null) continue
      holding = true
      if (best === null || hit.score > best.score) best = hit
    }
    if (!holding) return null
    if (best === null) continue
    score += best.score
    if (weights[best.field] > weight) {
      weight = weights[best.field]
      field = best.field
    }
  }
  return { field, score }
}

const propsOf = (
  props: Custom,
  filter: Extract<Filter, { kind: "asking" }>,
): ReadonlyArray<string> => {
  if (filter.namedProps.length === 0) return NO_KEYS
  const keys: Array<string> = []
  for (const clause of filter.namedProps) {
    const key = propKeyOf(props, clause)
    if (key !== null && !keys.includes(key)) keys.push(key)
  }
  return keys
}

const NO_KEYS: ReadonlyArray<string> = []

const wordHit = <F extends string>(
  hay: Record<F, ReadonlyArray<string>>,
  word: string,
  fields: ReadonlyArray<F>,
  weights: Record<F, number>,
): { readonly field: F; readonly score: number } | null => {
  let score = -1
  let field: F | null = null
  let weight = -1
  for (const name of fields) {
    for (const haystack of hay[name]) {
      const bonus = positionBonus(haystack, word)
      if (bonus === -1) continue
      const value = weights[name] + bonus
      if (value > score) score = value
      if (weights[name] > weight) {
        weight = weights[name]
        field = name
      }
    }
  }
  return field === null ? null : { field, score }
}

export const needlesOf = (filter: Filter): ReadonlyArray<string> => {
  if (filter.kind !== "asking") return []
  const words: Array<string> = []
  for (const group of filter.groups) {
    for (const one of group) {
      if (one.kind !== "term" || one.negated || one.word === "") continue
      if (!words.includes(one.word)) words.push(one.word)
    }
  }
  return words
}

export const needlesFrom = (text: string, now: string): ReadonlyArray<string> =>
  needlesOf(parseFilter(text, now))

export const narrowableBy = (
  filter: Filter,
  lookupable: (word: string) => boolean,
): ReadonlyArray<ReadonlyArray<string>> | null => {
  if (filter.kind !== "asking") return null
  const groups: Array<ReadonlyArray<string>> = []
  for (const group of filter.groups) {
    const words: Array<string> = []
    for (const one of group) {
      if (one.kind !== "term" || one.negated || !lookupable(one.word)) {
        words.length = 0
        break
      }
      words.push(one.word)
    }
    if (words.length > 0) groups.push(words)
  }
  return groups.length === 0 ? null : groups
}

export interface Lit {
  readonly at: number
  readonly end: number
}

export const litBy = (
  text: string,
  needles: ReadonlyArray<string>,
): ReadonlyArray<Lit> => {
  if (needles.length === 0 || text === "") return []
  const fold = text.toLowerCase()
  const found: Array<Lit> = []
  for (const needle of needles) {
    let at = fold.indexOf(needle)
    while (at !== -1) {
      found.push({ at, end: at + needle.length })
      at = fold.indexOf(needle, at + 1)
    }
  }
  if (found.length === 0) return []
  found.sort((one, other) => one.at - other.at || other.end - one.end)
  const merged: Array<Lit> = []
  for (const one of found) {
    const last = merged[merged.length - 1]
    if (last === undefined || one.at > last.end) {
      merged.push(one)
      continue
    }
    if (one.end > last.end) merged[merged.length - 1] = { at: last.at, end: one.end }
  }
  return fold.length === text.length ? merged : sourceOffsets(merged, text, fold)
}

const sourceOffsets = (
  runs: ReadonlyArray<Lit>,
  text: string,
  fold: string,
): ReadonlyArray<Lit> => {
  const opens: Array<number> = []
  const closes: Array<number> = []
  let at = 0
  for (const character of text) {
    const width = character.toLowerCase().length
    for (let unit = 0; unit < width; unit++) {
      opens.push(at)
      closes.push(at + character.length)
    }
    at += character.length
  }
  if (opens.length !== fold.length) return []
  return runs.map((run) => ({
    at: opens[run.at] as number,
    end: closes[run.end - 1] as number,
  }))
}

const being = (derived: Derived, at: LocatedRegular, value: IsValue): boolean => {
  switch (value) {
    case "trashed":
      return isTrashed(derived.claims, at.file)
    case "blocked":
      return isBlocked(derived, at.node.id)
    case "mirrored":
      return isMirrored(derived, at.node.id)
    case "marked":
      return storedMarker(at.node) !== undefined
    case "done":
    case "cancelled":
    case "doing":
    case "todo":
      return storedMarker(at.node) === value
  }
}

const holds = (derived: Derived, at: LocatedRegular, clause: Clause): boolean => {
  if (clause.kind === "is") return being(derived, at, clause.value)
  if (clause.kind === "has") return carries(at.node, clause.field)
  if (clause.kind === "prop") return propKeyOf(customOf(at.node), clause) !== null
  return dayWithin(at.node, clause)
}

const dayWithin = (node: RegularNode, clause: DaysClause): boolean => {
  switch (clause.of) {
    case "date": {
      const dates = datesOf(node)
      return unbounded(clause)
        ? dates.length > 0
        : dates.some(({ date }) => within(date, clause))
    }
    case "created":
      return stampWithin(node.created, clause)
    case "changed":
      return stampWithin(node.changed, clause)
  }
}

const stampWithin = (stamp: string | undefined, clause: DaysClause): boolean =>
  stamp !== undefined && !nothing(stamp) &&
  (unbounded(clause) || within(stamp, clause))

const unbounded = (clause: DaysClause): boolean =>
  clause.from === null && clause.to === null

const propKeyOf = (
  props: Custom,
  clause: Extract<Clause, { kind: "prop" }>,
): string | null => {
  for (const [key, value] of Object.entries(props)) {
    if (key.toLowerCase() !== clause.key) continue
    if (nothing(value)) continue
    const held = typeof value === "string" ? [value] : value
    if (clause.span !== undefined) {
      if (held.some((one) => inSpan(clause.span as PropSpan, one))) return key
      continue
    }
    if (clause.value === null) return key
    if (held.some((one) => one.toLowerCase() === clause.value)) return key
  }
  return null
}

const inSpan = (span: PropSpan, value: string): boolean => {
  if (span.of === "int") {
    if (!isDigitRun(value)) return false
    const held = Number(value)
    return (span.from === null || held >= span.from) && (span.to === null || held <= span.to)
  }
  return spanned(value, span.from, span.to)
}

const carries = (node: RegularNode, field: CarriedField): boolean =>
  !nothing(node[field])

const within = (date: string, clause: DaysClause): boolean =>
  spanned(date, clause.from, clause.to)

const spanned = (date: string, from: string | null, to: string | null): boolean =>
  (from === null || date >= from) &&
  (to === null ||
    date <= to ||
    date.startsWith(to))

export const matching = (
  derived: Derived,
  filter: Filter,
  scope: Scope = {},
  named?: Iterable<string>,
): ReadonlyArray<Matched> => [
  ...selecting(
    derived,
    filter,
    named === undefined ? inScopeOf(derived, scope) : namedInScope(derived, scope, named),
    scope.trashed === true || (filter.kind === "asking" && filter.speaksOfTrash),
  ),
]

const inScopeOf = (derived: Derived, scope: Scope): Iterable<LocatedRegular> => {
  const { file, under } = scope
  if (under !== undefined) return descendedFrom(derived, under, file)
  if (file !== undefined) return regularsIn(derived.byFile.get(file) ?? [])
  return regularsIn(derived.nodes)
}

function* regularsIn(records: ReadonlyArray<Located>): Generator<LocatedRegular> {
  for (const located of records) {
    if (isMirror(located.node)) continue
    yield located as LocatedRegular
  }
}

const descendedFrom = (
  derived: Derived,
  under: string,
  file: string | undefined,
): ReadonlyArray<LocatedRegular> => {
  const root = derived.byId.get(under)
  if (root === undefined || isMirror(root.node)) return []
  const found: Array<LocatedRegular> = [root as LocatedRegular]
  const seen = new Set<string>([under])
  const descending: Array<string> = [under]
  while (descending.length > 0) {
    for (const child of derived.children.get(descending.pop() as string) ?? []) {
      if (isMirror(child.node)) continue
      if (seen.has(child.node.id)) continue
      seen.add(child.node.id)
      found.push(child as LocatedRegular)
      descending.push(child.node.id)
    }
  }
  const own = file === undefined ? found : found.filter((at) => at.file === file)
  return own.sort(byCorpus)
}

const namedInScope = (
  derived: Derived,
  scope: Scope,
  named: Iterable<string>,
): ReadonlyArray<LocatedRegular> => {
  const inScope = scoping(derived, scope)
  const found: Array<LocatedRegular> = []
  for (const id of named) {
    const located = derived.byId.get(id)
    if (located === undefined || isMirror(located.node)) continue
    const at = located as LocatedRegular
    if (!inScope(at)) continue
    found.push(at)
  }
  return found.sort(byCorpus)
}

export function* selecting(
  derived: Derived,
  filter: Filter,
  candidates: Iterable<LocatedRegular>,
  putAway: boolean,
): Generator<Matched> {
  for (const at of candidates) {
    if (isLeftoverArchive(at.file)) continue
    if (!putAway && isTrashed(derived.claims, at.file)) continue
    const match = matchOf(derived, at, filter)
    if (match !== null) yield { at, match }
  }
}

const SETTLED_PENALTY = 300

const isSettled = (derived: Pick<Derived, "status">, id: string): boolean => {
  const mark = derived.status.get(id)
  return mark !== undefined && settles(mark)
}

export const ranked = (
  derived: Pick<Derived, "status">,
  matched: ReadonlyArray<Matched>,
): ReadonlyArray<Matched> => {
  const scored = matched.map((one) => ({
    one,
    score: isSettled(derived, one.at.node.id)
      ? one.match.score - SETTLED_PENALTY
      : one.match.score,
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.map((entry) => entry.one)
}

const scoping = (
  derived: Derived,
  scope: Scope,
): ((at: LocatedRegular) => boolean) => {
  const { file, under } = scope
  if (file === undefined && under === undefined) return () => true
  return (at) => {
    if (file !== undefined && at.file !== file) return false
    if (under === undefined) return true
    return insideSubtree(derived, at.node.id, under)
  }
}

export const insideSubtree = (
  derived: Derived,
  id: string,
  under: string,
): boolean =>
  id === under || ancestorsOf(derived, id).some((crumb) => crumb.node.id === under)

export interface Selected {
  readonly has: (id: string) => boolean
}

export const shownRecord = (row: Row): Located =>
  row.kind === "node" || row.kind === "mirror" ? row.shows : row.at

export const keeping = (
  rows: ReadonlyArray<Row>,
  matched: Selected,
): ReadonlyArray<Row> =>
{
  const kept = rows.flatMap((row) => {
    if (matched.has(shownRecord(row).node.id)) return [row]
    const children = keeping(row.children, matched)
    return children.length === 0 ? [] : [children === row.children ? row : { ...row, children }]
  })
  return kept.length === rows.length && kept.every((row, index) => row === rows[index]) ? rows : kept
}

export const matchedIn = (
  rows: ReadonlyArray<Row>,
  matched: Selected,
): number =>
  rows.reduce(
    (total, row) =>
      total + (matched.has(shownRecord(row).node.id) ? 1 : 0) +
      matchedIn(row.children, matched),
    0,
  )

export const rowsIn = (rows: ReadonlyArray<Row>): number =>
  rows.reduce((total, row) => total + 1 + rowsIn(row.children), 0)

export const keepingDated = (
  groups: ReadonlyArray<DayGroup>,
  matched: Selected,
): ReadonlyArray<DayGroup> =>
  groups.flatMap((group) => {
    const nodes = group.nodes.filter((entry) => matched.has(entry.shows.node.id))
    return nodes.length === 0 ? [] : [{ ...group, nodes }]
  })

export const DOCUMENT_FIELDS = ["title", "path", "tag", "body"] as const
export type DocumentField = (typeof DOCUMENT_FIELDS)[number]

const DOCUMENT_WEIGHT: Record<DocumentField, number> = {
  title: FIELD_WEIGHT.title,
  path: FIELD_WEIGHT.id,
  tag: FIELD_WEIGHT.tag,
  body: FIELD_WEIGHT.desc,
}

export interface DocumentMatch {
  readonly field: DocumentField | null
  readonly score: number
  readonly props: ReadonlyArray<string>
}

export interface MatchedDocument {
  readonly at: Bodied
  readonly match: DocumentMatch
}

export type Bodied = Markdown | Unkept

export type Ranked =
  | { readonly kind: "node"; readonly at: LocatedRegular; readonly match: Match }
  | { readonly kind: "document"; readonly at: Bodied; readonly match: DocumentMatch }
  | { readonly kind: "outline"; readonly at: Outline; readonly match: OutlineMatch }

export const rankedTogether = (
  derived: Pick<Derived, "status">,
  nodes: ReadonlyArray<Matched>,
  documents: ReadonlyArray<MatchedDocument>,
  outlines: ReadonlyArray<MatchedOutline> = [],
): ReadonlyArray<Ranked> => {
  const scored: Array<{ readonly entry: Ranked; readonly score: number }> = [
    ...nodes.map((one) => ({
      entry: { kind: "node", at: one.at, match: one.match } as const,
      score: isSettled(derived, one.at.node.id)
        ? one.match.score - SETTLED_PENALTY
        : one.match.score,
    })),
    ...documents.map((one) => ({
      entry: { kind: "document", at: one.at, match: one.match } as const,
      score: one.match.score,
    })),
    ...outlines.map(one => ({
      entry: { kind: "outline", at: one.at, match: one.match } as const,
      score: one.match.score,
    })),
  ]
  scored.sort((a, b) => b.score - a.score)
  return scored.map((one) => one.entry)
}

const foldedDocuments = new WeakMap<Bodied, Record<DocumentField, ReadonlyArray<string>>>()

const documentHay = (
  document: Bodied,
): Record<DocumentField, ReadonlyArray<string>> => {
  const before = foldedDocuments.get(document)
  if (before !== undefined) return before
  const now: Record<DocumentField, ReadonlyArray<string>> = {
    title: [document.title.toLowerCase()],
    path: [document.path.toLowerCase(), basenameOf(document.path).toLowerCase()],
    tag: document.tags.flatMap((tag) => {
      const written = tag.toLowerCase()
      return [written.slice(1), written]
    }),
    body: isMarkdown(document) ? [proseIn(document.body).toLowerCase()] : [],
  }
  foldedDocuments.set(document, now)
  return now
}

export const documentHayOf = (document: Bodied): string => {
  const hay = documentHay(document)
  return DOCUMENT_FIELDS.map((field) => hay[field].join("\n")).join("\n")
}

export const matchingDocuments = (
  documents: ReadonlyArray<Bodied>,
  filter: Filter,
  scope: Scope = {},
  named?: Iterable<string>,
): ReadonlyArray<MatchedDocument> => {
  if (filter.kind !== "asking") return []
  if (scope.file !== undefined || scope.under !== undefined) return []
  const only = named === undefined ? null : new Set(named)
  const out: Array<MatchedDocument> = []
  for (const document of documents) {
    if (isOpaque(document)) continue
    if (only !== null && !only.has(document.path)) continue
    const match = documentMatchOf(document, filter)
    if (match !== null) out.push({ at: document, match })
  }
  return out
}

const documentMatchOf = (
  document: Bodied,
  filter: Extract<Filter, { kind: "asking" }>,
): DocumentMatch | null => {
  const found = matchedBy(
    filter.groups,
    (clause) => documentHolds(document.props, clause),
    () => documentHay(document),
    DOCUMENT_FIELDS,
    DOCUMENT_WEIGHT,
  )
  if (found === null) return null
  return { ...found, props: propsOf(document.props, filter) }
}

const documentHolds = (props: Custom, clause: Clause): boolean =>
  clause.kind === "prop" && propKeyOf(props, clause) !== null

export const documentLineOf = (document: Bodied, filter: Filter, field: DocumentField | null): number | undefined => {
  if (field !== "body" || !isMarkdown(document)) return undefined
  const hay = documentHay(document).body[0] ?? ""
  let strongest = -1
  let offset: number | undefined
  for (const word of needlesOf(filter)) {
    const score = positionBonus(hay, word)
    if (score <= strongest) continue
    strongest = score
    offset = hay.indexOf(word)
  }
  return offset === undefined ? undefined : proseLineOffset(document.body) + hay.slice(0, offset).split("\n").length
}

export interface OutlineMatch {
  readonly field: "title" | "path" | null
  readonly score: number
}
export interface MatchedOutline {
  readonly at: Outline
  readonly match: OutlineMatch
}

export const matchingOutlines = (outlines: ReadonlyArray<Outline>, filter: Filter, scope: Scope = {}): ReadonlyArray<MatchedOutline> => {
  if (filter.kind !== "asking" || scope.file !== undefined || scope.under !== undefined) return []
  const found: Array<MatchedOutline> = []
  for (const outline of outlines) {
    if (outline.path.startsWith("_olai/")) continue
    const match = matchedBy(filter.groups, () => false, () => ({
      title: [outline.title.toLowerCase()],
      path: [outline.path.toLowerCase(), basenameOf(outline.path).toLowerCase()],
    }), ["title", "path"], { title: FIELD_WEIGHT.title, path: FIELD_WEIGHT.id })
    if (match !== null) found.push({ at: outline, match })
  }
  return found
}
