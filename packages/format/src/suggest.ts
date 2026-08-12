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
 */

import { distance } from "fastest-levenshtein"

/** The closest candidate within the typo budget, or `null` when nothing is
 *  close enough to be one. Ties go to the first candidate offered, so two
 *  readings of the same set suggest the same id. */
export const nearestId = (
  id: string,
  candidates: Iterable<string>,
): string | null => {
  const budget = Math.max(2, Math.floor(id.length / 3))
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
export const didYouMean = (id: string, candidates: Iterable<string>): string => {
  const best = nearestId(id, candidates)
  return best === null ? "" : ` — did you mean \`${best}\`?`
}
