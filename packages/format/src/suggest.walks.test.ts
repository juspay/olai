/**
 * WHAT AN OFFER COSTS — matrices per ask, and passes over the ids per burst.
 *
 * `./suggest.test.ts` holds the two doors to one answer. This holds the second
 * door to the reason it exists (roadmap `perf-didyoumean`), because an
 * equivalence proves nothing about cost: a door that answered identically by
 * walking every id and building a matrix per one of them would pass every case
 * in that file.
 *
 * TWO COUNTS, and they are two different claims:
 *
 *   - MATRICES PER ASK. The edit distance is the expensive half — the two
 *     lengths multiplied, per candidate — and the walk pays it for every id a
 *     length difference does not rule out, which on a vault of minted ids is
 *     every id there is. Counted by wrapping the LIBRARY both doors call rather
 *     than by instrumenting either of them, which is `../../ops/src/pending`'s
 *     rule for counting subprocesses: an arm that had to be told it was being
 *     measured would be measuring something else. The wrapper delegates to the
 *     real function, so nothing about either answer changes;
 *   - PASSES OVER THE IDS PER BURST. The index is built once per MAP and held
 *     against it, so a stale tab replaying twenty refused edits reads the ids
 *     once rather than twenty times. Counted by handing the door a map that
 *     counts what is asked of it — the same wrapping trick one level up.
 *
 * The BURST is the shape the roadmap node was filed on, and the two counts
 * together are the whole of the claim: one pass for the burst, and a handful of
 * matrices per ask inside it, against one pass and a corpus of matrices per ask
 * before.
 */

import { distance } from "fastest-levenshtein"
import { expect, mock, test } from "bun:test"

/** The library's own function, COPIED OUT before the mock below is installed.
 *  An ESM import is a live binding and `mock.module` rewrites it in place, so
 *  a wrapper that called the imported name would call itself — this is a value
 *  taken at evaluation, which is the one thing the rewrite cannot reach. */
const real = distance

/** Every edit distance either door computes. Wrapped BEFORE the module under
 *  test is loaded — `mock.module` first, `await import` after, because a static
 *  import of `./suggest.ts` would be hoisted above the mock
 *  (`@olai/web`'s `chat/declared.browsertest.ts` explains the same dance). The
 *  real function is what answers, so this is a counter and not a stub. */
let matrices = 0
mock.module("fastest-levenshtein", () => ({
  distance: (a: string, b: string): number => {
    matrices++
    return real(a, b)
  },
}))

const { nearestDeclared, nearestId } = await import("./suggest.ts")

/** A vault's worth of MINTED ids — eight base-36 characters, which is what the
 *  ops layer's minter produces and therefore the shape a real directory is
 *  nearly all of. It is also the hostile shape for this: every id is one
 *  length, so nothing is ruled out by the band and the character bound is the
 *  only thing standing in front of the matrix. Deterministic, so a count is a
 *  number a reader can re-run rather than a sample. */
const IDS = ((): ReadonlyArray<string> => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  let held = 7
  const roll = (below: number): number => {
    held = (held * 1103515245 + 12345) % 2147483648
    // The HIGH bits, for `./suggest.test.ts`'s reason: this generator's low ones
    // cycle in a handful of steps, and a corpus whose ids share their characters
    // far more than real ones do would make the count below a fact about the
    // fixture.
    return Math.floor(held / 65536) % below
  }
  return Array.from({ length: 2000 }, () =>
    Array.from({ length: 8 }, () => alphabet[roll(alphabet.length)]).join(""))
})()

/** The ids as a derivation holds them, plus a count of how often anything
 *  walked the keys. A `Map` subclass rather than a `Proxy`: what is being
 *  counted is one method, and the door reads it exactly once per index it
 *  builds. */
class Counted extends Map<string, string> {
  public passes = 0
  public override keys(): MapIterator<string> {
    this.passes++
    return super.keys()
  }
}

const declared = (): Counted => new Counted(IDS.map((id) => [id, id]))

/**
 * A typo of an id that is really there, so both doors have a winner to find —
 * the case where a search cannot stop early is the case worth counting.
 *
 * ONE CHARACTER SUBSTITUTED, never dropped, and never for the character already
 * there: the walk's own length bound tightens as it goes, so a query one
 * character SHORTER than the ids would let it skip the whole tail once it had
 * found a winner one edit away, and an exact hit would let it skip everything.
 * Either would make the count below flatter than what a refused edit really
 * costs — a typo of the same length is the honest case, and it is also the
 * commonest one.
 */
const typoOf = (id: string, at: number): string =>
  `${id.slice(0, at)}${id[at] === "z" ? "y" : "z"}${id.slice(at + 1)}`

const FOUND = IDS[900] as string
const TYPO = typoOf(FOUND, 4)

test("one ask: the walk builds a matrix per id, the index builds a handful", () => {
  const ids = declared()

  matrices = 0
  expect(nearestId(TYPO, ids.keys())).toBe(FOUND)
  const walked = matrices

  matrices = 0
  expect(nearestDeclared(TYPO, ids)).toBe(FOUND)
  const indexed = matrices

  // The walk pays for the corpus: every id is within the budget in LENGTH, so
  // the one bound it has rules out nothing at all.
  expect(walked).toBe(IDS.length)
  // The index pays for the plausible ones. Thirty-two is a ceiling with room in
  // it rather than the number this happens to produce — what must not be true
  // is that it scales with the vault — and the ratio is printed by the bench.
  expect(indexed).toBeLessThanOrEqual(32)
  // ...and it did not win by answering nothing: both found the id above.
  expect(indexed).toBeGreaterThan(0)
})

test("a burst against one revision reads the ids once, not once per refusal", () => {
  const ids = declared()
  const burst = IDS.slice(0, 20).map((id) => typoOf(id, 3))

  matrices = 0
  for (const query of burst) expect(nearestId(query, ids.keys())).not.toBeNull()
  const walked = matrices
  const walkedPasses = ids.passes

  const held = declared()
  matrices = 0
  for (const query of burst) expect(nearestDeclared(query, held)).not.toBeNull()

  // ONE PASS for the whole burst, against one per refusal — which is the
  // sentence the roadmap node was filed with.
  expect(walkedPasses).toBe(burst.length)
  expect(held.passes).toBe(1)
  // And the matrices scale with the burst rather than with the burst times the
  // vault.
  expect(walked).toBe(burst.length * IDS.length)
  expect(matrices).toBeLessThanOrEqual(burst.length * 32)
})

test("a second map is a second index — an offer is never answered off another revision's ids", () => {
  const ids = declared()
  expect(nearestDeclared(TYPO, ids)).toBe(FOUND)
  // The same typo, over a map that does not hold the id it would name. A cache
  // keyed on anything but the map itself answers with the winner above.
  const without = new Counted(IDS.filter((id) => id !== FOUND).map((id) => [id, id]))
  expect(nearestDeclared(TYPO, without)).not.toBe(FOUND)
  expect(without.passes).toBe(1)
})
