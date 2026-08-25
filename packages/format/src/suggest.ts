/**
 * "did you mean" — the one rule for guessing what an unknown id was meant to be.
 *
 * An unknown reference is nearly always a misspelling, and naming the candidate
 * turns a search into a keystroke. That is true of a `mirror` target the
 * validator refuses on load, and it is true of the same target refused at the
 * plan by the ops layer — one question, asked at two moments, and a second copy
 * of the budget arithmetic would be two answers to it: the file that will not
 * load suggesting `kitchen` while the write that would have created it suggests
 * nothing.
 *
 * The BUDGET is what makes it a suggestion rather than a nearest-neighbour
 * report: a third of the id's length, and never less than two, so `kitchn`
 * finds `kitchen` and `nope` does not find `order`. A guess further away than
 * that is a different word, and offering one would teach the reader to distrust
 * the offer.
 *
 * ## What it costs, and what {@link nearestDeclared} does about it
 *
 * The question is a nearest neighbour over the ids a set declares, and the
 * plain form below ({@link nearestId}) answers it by walking every candidate
 * and computing an edit distance for the ones a length difference does not rule
 * out. That is the right shape for a handful of paths — the outlines of a
 * directory, the `.md` a `write_document` could have meant — and it is the
 * wrong shape for the ids, which is where every burst comes from: a stale tab
 * replaying refused edits asks it once per refusal, and a hand-edited file with
 * a dozen dangling references asks it a dozen times PER WRITE, through the
 * validator's `unknown-target` (`./rules.ts`). On a vault of a few thousand
 * minted ids — eight base-36 characters, so nearly all one length — the length
 * test rules out nothing at all and each ask is a full matrix per id
 * (roadmap `perf-didyoumean`).
 *
 * So the ids get a door of their own, over the MAP that holds them, and it
 * changes two things and no answer:
 *
 *   - the candidates are held BY LENGTH and by a character MASK, built once per
 *     map and remembered against it ({@link declaredIn}), so a burst against
 *     one revision pays for one pass and the asks after it are lookups;
 *   - a candidate is rejected by two integers before any matrix is built. Both
 *     tests are LOWER BOUNDS on the edit distance and neither can rule out a
 *     winner: a length difference is one (the plain form already spends it),
 *     and so is the number of distinct characters one string has that the other
 *     does not — every one of them has to be substituted or deleted, and no
 *     single edit can account for two. That is two popcounts, against a matrix
 *     of the two lengths multiplied.
 *
 * **THE ANSWER IS THE SAME ANSWER**, ties included, and that is a differential
 * rather than a claim: `./suggest.test.ts` holds the two doors to each other
 * over generated corpora, and the ops layer holds the refusal SENTENCES to the
 * ones the walk produced (`@olai/ops`' `walks.test.ts`). Ties go to the first
 * candidate offered whichever door answered, which is why a candidate carries
 * the position it was offered at rather than being compared where it was found.
 *
 * **WHAT IT DOES NOT BUY, said plainly.** The scan is still linear in the
 * length bucket — this makes the WORK per candidate a pair of integer
 * operations instead of a matrix, and makes a burst pay for one pass rather
 * than one per refusal; it does not make the offer sublinear in the vault. That
 * would be a deletion-neighbourhood index (SymSpell) or an n-gram inverted one,
 * which is thousands of keys per thousand ids to maintain at the fold for a
 * question nobody asks until something is already refused. The bench prints
 * what the two doors cost per ask and per burst
 * (`@olai/ops`' `walks.bench.ts`).
 */

import { distance } from "fastest-levenshtein"

/** How far off a candidate may be and still be offered: a third of the id's
 *  length, never less than two. ONE function, because both doors below spend it
 *  and a second spelling would be the budget drifting between the walk and the
 *  index. */
const budgetFor = (id: string): number => Math.max(2, Math.floor(id.length / 3))

/** The closest candidate within the typo budget, or `null` when nothing is
 *  close enough to be one. Ties go to the first candidate offered, so two
 *  readings of the same set suggest the same id. */
export const nearestId = (
  id: string,
  candidates: Iterable<string>,
): string | null => {
  const budget = budgetFor(id)
  let best: string | null = null
  let bestDistance = budget + 1
  for (const candidate of candidates) {
    // A length difference is a LOWER BOUND on the edit distance, so a candidate
    // further away than the budget in length alone cannot win — skipping it is
    // exact rather than approximate, and it is what keeps this affordable on a
    // set of a few thousand ids, where the alternative is a full matrix per
    // candidate for every unresolved reference in a broken file.
    if (Math.abs(candidate.length - id.length) >= bestDistance) continue
    const gap = distance(id, candidate)
    if (gap < bestDistance) {
      best = candidate
      bestDistance = gap
    }
  }
  return best
}

/** The same answer as the clause an error message ends with, and the empty
 *  string when there is nothing to suggest — so a caller composes one sentence
 *  rather than branching around a `null`. */
export const didYouMean = (id: string, candidates: Iterable<string>): string =>
  clause(nearestId(id, candidates))

// ── the ids a set declares ─────────────────────────────────────────────

/**
 * One candidate, as the index holds it: the id, the characters it is made of,
 * and WHERE IT WAS OFFERED.
 *
 * The position is the tie rule made portable. {@link nearestId} above breaks a
 * tie by iteration order because it walks the candidates in the order it was
 * given them; this walks a length bucket at a time, which is a different order
 * — so the order the ids came in has to travel with them, or two doors over one
 * map would offer different ids for one typo.
 */
interface Candidate {
  readonly id: string
  /** A bit per character CLASS, folded into sixty-one of them across two words
   *  ({@link charsOf}). A fold makes two characters look like one, which can
   *  only make the bound below SMALLER — so a collision costs a matrix that was
   *  not needed and can never rule out a candidate that should have won. */
  readonly low: number
  readonly high: number
  readonly at: number
}

/** The ids of one map, held the way {@link nearestDeclared} reads them: by
 *  length, in the order the map offered them. */
type Declared = ReadonlyMap<number, ReadonlyArray<Candidate>>

/**
 * The index for one map of ids, built when somebody asks and remembered
 * against the map itself.
 *
 * KEYED ON THE MAP, which is what makes this sound rather than a cache with an
 * invalidation rule. `Derived.byId` is a value: a rebuild mints a new map, and
 * a patch hands on a layer that is COPY-ON-WRITE and never written through once
 * sealed (`./overlay.ts` states that as a law, not an economy) — so a map a
 * reader is holding cannot gain or lose an id, and an index built from one is
 * about that revision for as long as anybody can ask. A `WeakMap` is then the
 * whole of the lifetime rule: the index lives exactly as long as the map it
 * describes, and a revision nobody holds any more takes its index with it.
 *
 * It is the burst that pays for this. One refused edit walks the ids once
 * either way; a stale tab replaying twenty of them, or a validation naming a
 * dozen dangling targets, walks them once instead of twenty times.
 */
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

/**
 * The closest of the ids a set DECLARES, or `null` — {@link nearestId}'s answer
 * over the map that holds them, reached through {@link declaredIn}'s index.
 *
 * `also` is for the one caller whose candidates are not all in the map: a
 * capture may name a sibling it is minting in the same call, so a typo of one
 * of THOSE has to be offered too (`@olai/ops`' `wiring`). They are scanned
 * AFTER the declared ids and with the plain walk, which is where they belong in
 * both senses — there are a handful of them, and being last is what makes a tie
 * between a declared id and a minted one go to the declared one, exactly as the
 * concatenated iteration this replaced did.
 */
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
  // ONLY THE LENGTHS THAT COULD HOLD A WINNER. The band is the same lower bound
  // the walk spends per candidate, asked once of the index instead.
  for (let length = id.length - budget; length <= id.length + budget; length++) {
    if (length <= 0) continue
    for (const candidate of declared.get(length) ?? []) {
      // The tightest threshold a candidate could still win under: no further
      // than the budget, and no further than the best so far — a candidate
      // EQUAL to the best is still worth the matrix, because it may have been
      // offered earlier.
      const ceiling = Math.min(bestDistance, budget)
      if (apart(asked, candidate) > ceiling) continue
      const gap = distance(id, candidate.id)
      // WITHIN THE BUDGET FIRST, and that clause is not redundant: `bestAt`
      // starts at infinity, so a tie-break that did not check the budget would
      // let the very first candidate past it at `budget + 1` — which is the one
      // distance the offer must never be made at.
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

/** {@link nearestDeclared} as the clause a message ends with — {@link
 *  didYouMean}'s twin over the ids, and the door every unknown-id refusal in
 *  the tree above actually calls. */
export const didYouMeanDeclared = (
  id: string,
  known: ReadonlyMap<string, unknown>,
  also?: Iterable<string> | undefined,
): string => clause(nearestDeclared(id, known, also))

/** The clause, or nothing — one spelling for both doors, so the two cannot come
 *  to word the same offer differently. */
const clause = (best: string | null): string =>
  best === null ? "" : ` — did you mean \`${best}\`?`

/**
 * A LOWER BOUND on the edit distance between two strings, from the characters
 * they are made of and nothing else.
 *
 * A character one string has and the other does not must be substituted or
 * deleted, and one edit cannot account for two of them — so the count of
 * distinct characters on either side that the other lacks is a floor under the
 * distance, in both directions. Two popcounts, where the matrix it stands in
 * front of is the two lengths multiplied.
 */
const apart = (asked: Chars, other: Chars): number =>
  Math.max(
    counted(asked.low & ~other.low) + counted(asked.high & ~other.high),
    counted(other.low & ~asked.low) + counted(other.high & ~asked.high),
  )

/** The two words a character set is held in — sixty-one classes, which is what
 *  two 31-bit words hold and enough for an id's whole alphabet to have a class
 *  of its own. */
interface Chars {
  readonly low: number
  readonly high: number
}

/**
 * The characters of one string as a bit set.
 *
 * WHICH CLASS a character falls in is a table rather than a modulus, and the
 * difference is worth the ten lines: an id is letters, digits, `-` and `_`
 * ({@link ./node.ts}'s `ID_SHAPE`), and every modulus small enough to fit two
 * words lands the digits on top of ten of the letters — which on a vault of
 * minted ids (eight base-36 characters) is a third of the alphabet folded
 * together and a bound weak enough that it stops ruling much out. Measured, on
 * the count this file's `./suggest.walks.test.ts` asserts.
 *
 * CASE IS FOLDED, deliberately and as the one fold left: `Order` and `order`
 * share a class. A fold can only make {@link apart} SMALLER — it never rules
 * out a candidate that should have won — and an id space that distinguishes two
 * spellings by case alone is one where the matrix is the honest answer anyway.
 */
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

/** One character's class, in 0..60 — the alphabet an id is made of first, then
 *  the punctuation a path adds, then one shared tail for everything else (this
 *  is asked of paths and of prose-shaped keys too, so it cannot refuse a
 *  character it did not expect). */
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

/** How many bits are set — the textbook parallel count, over the 32 bits the
 *  fold above uses. */
const counted = (bits: number): number => {
  let held = bits - ((bits >> 1) & 0x55555555)
  held = (held & 0x33333333) + ((held >> 2) & 0x33333333)
  held = (held + (held >> 4)) & 0x0f0f0f0f
  return (held * 0x01010101) >>> 24
}
