import { distance } from "fastest-levenshtein"

const budgetFor = (id: string): number => Math.max(2, Math.floor(id.length / 3))

export const nearestId = (
  id: string,
  candidates: Iterable<string>,
): string | null => {
  const budget = budgetFor(id)
  let best: string | null = null
  let bestDistance = budget + 1
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - id.length) >= bestDistance) continue
    const gap = distance(id, candidate)
    if (gap < bestDistance) {
      best = candidate
      bestDistance = gap
    }
  }
  return best
}

export const didYouMean = (id: string, candidates: Iterable<string>): string =>
  clause(nearestId(id, candidates))

interface Candidate {
  readonly id: string
  readonly low: number
  readonly high: number
  readonly at: number
}

type Declared = ReadonlyMap<number, ReadonlyArray<Candidate>>

const INDEXED = new WeakMap<ReadonlyMap<string, unknown>, Declared>()

export const declaredIn = (known: ReadonlyMap<string, unknown>): Declared => {
  const held = INDEXED.get(known)
  if (held !== undefined) return held
  const byLength = new Map<number, Array<Candidate>>()
  let at = 0
  for (const id of known.keys()) {
    const bucket = byLength.get(id.length)
    const candidate: Candidate = { id, ...charsOf(id), at: at++ }
    if (bucket === undefined) byLength.set(id.length, [candidate])
    else bucket.push(candidate)
  }
  INDEXED.set(known, byLength)
  return byLength
}

export const nearestDeclared = (
  id: string,
  known: ReadonlyMap<string, unknown>,
  also?: Iterable<string> | undefined,
): string | null => {
  const budget = budgetFor(id)
  const asked = charsOf(id)
  let best: string | null = null
  let bestDistance = budget + 1
  let bestAt = Number.POSITIVE_INFINITY
  const declared = declaredIn(known)
  for (let length = id.length - budget; length <= id.length + budget; length++) {
    if (length <= 0) continue
    for (const candidate of declared.get(length) ?? []) {
      const ceiling = Math.min(bestDistance, budget)
      if (apart(asked, candidate) > ceiling) continue
      const gap = distance(id, candidate.id)
      if (gap > budget) continue
      if (gap < bestDistance || (gap === bestDistance && candidate.at < bestAt)) {
        best = candidate.id
        bestDistance = gap
        bestAt = candidate.at
      }
    }
  }
  for (const candidate of also ?? []) {
    if (Math.abs(candidate.length - id.length) >= bestDistance) continue
    const gap = distance(id, candidate)
    if (gap < bestDistance) {
      best = candidate
      bestDistance = gap
    }
  }
  return best
}

export const didYouMeanDeclared = (
  id: string,
  known: ReadonlyMap<string, unknown>,
  also?: Iterable<string> | undefined,
): string => clause(nearestDeclared(id, known, also))

const clause = (best: string | null): string =>
  best === null ? "" : ` — did you mean \`${best}\`?`

const apart = (asked: Chars, other: Chars): number =>
  Math.max(
    counted(asked.low & ~other.low) + counted(asked.high & ~other.high),
    counted(other.low & ~asked.low) + counted(other.high & ~asked.high),
  )

interface Chars {
  readonly low: number
  readonly high: number
}

const charsOf = (id: string): Chars => {
  let low = 0
  let high = 0
  for (let at = 0; at < id.length; at++) {
    const which = classOf(id.charCodeAt(at))
    if (which < 31) low |= 1 << which
    else high |= 1 << (which - 31)
  }
  return { low, high }
}

const classOf = (code: number): number => {
  if (code >= 48 && code <= 57) return code - 48
  if (code >= 97 && code <= 122) return code - 87
  if (code >= 65 && code <= 90) return code - 55
  if (code === 45) return 36
  if (code === 95) return 37
  if (code === 47) return 38
  if (code === 46) return 39
  return 40 + (code % 21)
}

const counted = (bits: number): number => {
  let held = bits - ((bits >> 1) & 0x55555555)
  held = (held & 0x33333333) + ((held >> 2) & 0x33333333)
  held = (held + (held >> 4)) & 0x0f0f0f0f
  return (held * 0x01010101) >>> 24
}
