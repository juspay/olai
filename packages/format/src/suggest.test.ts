/**
 * The typo rule, on its own.
 *
 * It has two readers — the validator's `unknown-target` on load, and the ops
 * layer's refusal of the same target at the plan — and what they must agree
 * about is exactly what is asserted here: how far is close enough. A test
 * through either reader would pin the sentence rather than the budget.
 *
 * IT HAS TWO DOORS NOW, and the second half of this file is the differential
 * that makes them one answer: {@link nearestId} walks the candidates it is
 * given, and {@link nearestDeclared} answers the same question over the MAP of
 * ids a set declares, off an index held against it (`./suggest.ts`, roadmap
 * `perf-didyoumean`). The walk is the reference arm and it stays in the tree
 * for that reason — the fast door is only worth having if it cannot part
 * company with it, TIES INCLUDED, and a tie is exactly where a door that walks
 * a length bucket at a time would go wrong on its own.
 *
 * What this file does NOT assert is what the second door was built for: that a
 * burst pays for one pass and an ask costs a handful of matrices rather than
 * one per id. That is a count, and it is `./suggest.walks.test.ts`'s.
 */

import { describe, expect, test } from "bun:test"

import { didYouMean, didYouMeanDeclared, nearestDeclared, nearestId } from "./suggest.ts"

describe("nearestId", () => {
  test("a near miss is the candidate", () => {
    expect(nearestId("kitchn", ["kitchen", "sink"])).toBe("kitchen")
  })

  test("a different word is not a suggestion", () => {
    // `zzz` against `kitchen` is a distance of seven, and offering it would
    // train a reader to ignore the clause.
    expect(nearestId("zzz", ["kitchen"])).toBeNull()
  })

  /** The budget is a third of the id's length and never less than two, so a
   *  SHORT id still gets a suggestion — one or two characters out of four is
   *  the misspelling people actually make. */
  test("a short id keeps a floor of two", () => {
    expect(nearestId("odr", ["order"])).toBe("order")
    expect(nearestId("od", ["order"])).toBeNull()
  })

  test("nothing to suggest from is null rather than a throw", () => {
    expect(nearestId("anything", [])).toBeNull()
  })

  /** Ties go to the first candidate offered, so two readings of one set say the
   *  same thing rather than whichever the iteration order handed over. */
  test("a tie keeps the first candidate", () => {
    expect(nearestId("ab", ["ax", "ay"])).toBe("ax")
  })
})

test("didYouMean is the clause, or nothing at all", () => {
  expect(didYouMean("kitchn", ["kitchen"])).toBe(" — did you mean `kitchen`?")
  expect(didYouMean("zzz", ["kitchen"])).toBe("")
})

// ── the two doors, held to one answer ──────────────────────────────────

/** The ids as a map, which is what a derivation hands the second door — the
 *  VALUES are nothing to it, so they are the id back. */
const declared = (ids: Iterable<string>): ReadonlyMap<string, string> =>
  new Map([...ids].map((id) => [id, id]))

describe("nearestDeclared", () => {
  test("it is the walk's answer, over the map that holds the ids", () => {
    const ids = declared(["kitchen", "sink", "order"])
    expect(nearestDeclared("kitchn", ids)).toBe("kitchen")
    expect(nearestDeclared("odr", ids)).toBe("order")
    expect(nearestDeclared("zzzzzzz", ids)).toBeNull()
    expect(nearestDeclared("anything", declared([]))).toBeNull()
  })

  /**
   * THE TIE ACROSS TWO LENGTHS, which is the one case the index could get wrong
   * for a reason the walk cannot have: it reads a length bucket at a time, so
   * `ab` (bucket 2) is reached before `abcd` (bucket 4) whatever order the map
   * offered them in. Both are one edit from `abc`, and the answer has to be the
   * one the map offered FIRST — otherwise one typo is corrected two ways
   * depending on which door the caller went through.
   */
  test("a tie goes to the id the map offered first, not the shortest", () => {
    expect(nearestDeclared("abc", declared(["abcd", "ab"]))).toBe("abcd")
    expect(nearestDeclared("abc", declared(["ab", "abcd"]))).toBe("ab")
    // ...and the walk agrees, which is the whole point of the pair.
    expect(nearestId("abc", ["abcd", "ab"])).toBe("abcd")
    expect(nearestId("abc", ["ab", "abcd"])).toBe("ab")
  })

  /** The ids a call is MINTING are offered too, and last: a typo of a sibling
   *  being born is corrected to that sibling, and a tie with a declared id goes
   *  to the declared one — which is where the concatenated walk this replaced
   *  put them. */
  test("the minted candidates come after the declared ones", () => {
    const ids = declared(["order"])
    expect(nearestDeclared("ordr", ids, ["orde"])).toBe("order")
    expect(nearestDeclared("stpe", ids, ["step"])).toBe("step")
    expect(nearestDeclared("ordr", declared([]), ["order"])).toBe("order")
    // The walk over the concatenation is the same answer, by construction.
    expect(nearestId("ordr", ["order", "orde"])).toBe("order")
  })

  test("the clause is the same clause", () => {
    expect(didYouMeanDeclared("kitchn", declared(["kitchen"])))
      .toBe(" — did you mean `kitchen`?")
    expect(didYouMeanDeclared("zzzzzzz", declared(["kitchen"]))).toBe("")
  })
})

/**
 * THE DIFFERENTIAL, over generated corpora rather than over the cases above.
 *
 * Three corpora, because the shape of the id space is the whole of what decides
 * whether the index's length band and character bound rule anything out — and
 * a suite that only asked the human-slug one would be measuring the friendly
 * case:
 *
 *   - MINTED ids, eight base-36 characters, which is what `Ops`' own minter
 *     produces and therefore what a real vault is nearly all of. Every id is
 *     one length, so the band rules out nothing and the character bound is the
 *     only thing standing in front of the matrix;
 *   - SLUGS, the names a person writes, whose lengths spread — where the band
 *     is what does the work;
 *   - MIXED, which is every real directory, plus the pathological neighbours a
 *     generator does not produce on its own: an id and the same id with one
 *     character taken off, so ties across two buckets are dense.
 *
 * The QUERIES are what a refusal actually carries: a typo of a real id (one
 * deleted, one substituted, two transposed), an id that is really there, a
 * word from somewhere else entirely, and the short ids where the budget's floor
 * of two is what answers.
 */
describe("the two doors answer the same offer", () => {
  /** A deterministic generator: `Math.random` would make a failure something
   *  nobody can re-run, and the corpora below have to be the same corpora on
   *  every machine. */
  const rolling = (seed: number) => {
    let held = seed
    return (below: number): number => {
      held = (held * 1103515245 + 12345) % 2147483648
      // The HIGH bits: this generator's low ones cycle in a handful of steps,
      // which would make a corpus of ids that share their characters far more
      // than real ones do — and a candidate bound read off the characters would
      // be measured against a fixture rather than against a vault.
      return Math.floor(held / 65536) % below
    }
  }

  const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
  const WORDS = [
    "kitchen",
    "order",
    "install",
    "garden",
    "beds",
    "compost",
    "shed",
    "roof",
    "invoice",
    "reconcile",
    "perf",
    "walks",
    "capture",
    "batch",
    "assemble",
  ]

  const minted = (howMany: number): ReadonlyArray<string> => {
    const roll = rolling(7)
    return Array.from({ length: howMany }, () =>
      Array.from({ length: 8 }, () => ALPHABET[roll(ALPHABET.length)]).join(""))
  }

  const slugs = (howMany: number): ReadonlyArray<string> => {
    const roll = rolling(11)
    return Array.from({ length: howMany }, (_, which) => {
      const parts = 1 + roll(3)
      return [
        ...Array.from({ length: parts }, () => WORDS[roll(WORDS.length)]),
        String(which),
      ].join("-")
    })
  }

  /** Every way a person mistypes an id, plus the two answers that are not a
   *  typo at all. `undefined` where a corpus is too small to reach the
   *  candidate a mangling needs. */
  const mangled = (id: string, roll: (below: number) => number): ReadonlyArray<string> => {
    const at = roll(id.length)
    const dropped = id.slice(0, at) + id.slice(at + 1)
    const swapped = id.slice(0, at) + "x" + id.slice(at + 1)
    const turned = at + 1 < id.length
      ? id.slice(0, at) + id[at + 1] + id[at] + id.slice(at + 2)
      : id
    return [dropped, swapped, turned, id, id.toUpperCase(), `${id}${id}`]
  }

  const holds = (ids: ReadonlyArray<string>, extra: ReadonlyArray<string> = []): void => {
    const map = declared(ids)
    const roll = rolling(23)
    const asked: Array<string> = []
    for (const id of ids) asked.push(...mangled(id, roll))
    asked.push("zzz", "od", "a", "", "not-an-id-at-all", "kitchn", "ordr")
    for (const query of asked) {
      // The walk over the CONCATENATION is what the second door replaced, extra
      // candidates and all — so the reference arm is written the way the caller
      // used to spell it.
      const walked = nearestId(query, [...ids, ...extra])
      const found = extra.length === 0
        ? nearestDeclared(query, map)
        : nearestDeclared(query, map, extra)
      // The query rides the comparison so a failure names the typo it happened
      // at rather than only the two ids.
      expect([query, found]).toEqual([query, walked])
    }
  }

  test("over minted ids — one length, so the character bound is all there is", () => {
    holds(minted(400))
  })

  test("over slugs — lengths that spread, so the band is what narrows", () => {
    holds(slugs(400))
  })

  test("over both, with the neighbours a tie needs", () => {
    const ids = [...minted(200), ...slugs(200)]
    holds([...ids, ...ids.map((id) => id.slice(1))])
  })

  test("with ids a call is minting beside them", () => {
    holds(slugs(200), ["step", "steps", "stpe"])
  })
})
