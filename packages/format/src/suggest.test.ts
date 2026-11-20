import { describe, expect, test } from "bun:test"

import { didYouMean, didYouMeanDeclared, nearestDeclared, nearestId } from "./suggest.ts"

describe("nearestId", () => {
  test("a near miss is the candidate", () => {
    expect(nearestId("kitchn", ["kitchen", "sink"])).toBe("kitchen")
  })

  test("a different word is not a suggestion", () => {
    expect(nearestId("zzz", ["kitchen"])).toBeNull()
  })

  test("a short id keeps a floor of two", () => {
    expect(nearestId("odr", ["order"])).toBe("order")
    expect(nearestId("od", ["order"])).toBeNull()
  })

  test("nothing to suggest from is null rather than a throw", () => {
    expect(nearestId("anything", [])).toBeNull()
  })

  test("a tie keeps the first candidate", () => {
    expect(nearestId("ab", ["ax", "ay"])).toBe("ax")
  })
})

test("didYouMean is the clause, or nothing at all", () => {
  expect(didYouMean("kitchn", ["kitchen"])).toBe(" — did you mean `kitchen`?")
  expect(didYouMean("zzz", ["kitchen"])).toBe("")
})

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

  test("a tie goes to the id the map offered first, not the shortest", () => {
    expect(nearestDeclared("abc", declared(["abcd", "ab"]))).toBe("abcd")
    expect(nearestDeclared("abc", declared(["ab", "abcd"]))).toBe("ab")
    expect(nearestId("abc", ["abcd", "ab"])).toBe("abcd")
    expect(nearestId("abc", ["ab", "abcd"])).toBe("ab")
  })

  test("the minted candidates come after the declared ones", () => {
    const ids = declared(["order"])
    expect(nearestDeclared("ordr", ids, ["orde"])).toBe("order")
    expect(nearestDeclared("stpe", ids, ["step"])).toBe("step")
    expect(nearestDeclared("ordr", declared([]), ["order"])).toBe("order")
    expect(nearestId("ordr", ["order", "orde"])).toBe("order")
  })

  test("a candidate one past the budget is not offered, however early it was", () => {
    const asked = "aaaabbbbc"
    const past = declared(["aaabbbcad", "zzzzzzzzz"])
    expect(nearestDeclared(asked, past)).toBeNull()
    expect(nearestId(asked, [...past.keys()])).toBeNull()
    const at = declared(["aaaabbbbcxyz"])
    expect(nearestDeclared(asked, at)).toBe("aaaabbbbcxyz")
    expect(nearestId(asked, [...at.keys()])).toBe("aaaabbbbcxyz")
  })

  test("the clause is the same clause", () => {
    expect(didYouMeanDeclared("kitchn", declared(["kitchen"])))
      .toBe(" — did you mean `kitchen`?")
    expect(didYouMeanDeclared("zzzzzzz", declared(["kitchen"]))).toBe("")
  })
})

describe("the two doors answer the same offer", () => {
  const rolling = (seed: number) => {
    let held = seed
    return (below: number): number => {
      held = (held * 1103515245 + 12345) % 2147483648
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
      const walked = nearestId(query, [...ids, ...extra])
      const found = extra.length === 0
        ? nearestDeclared(query, map)
        : nearestDeclared(query, map, extra)
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
