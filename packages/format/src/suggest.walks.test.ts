import { distance } from "fastest-levenshtein"
import { expect, mock, test } from "bun:test"

const real = distance

let matrices = 0
mock.module("fastest-levenshtein", () => ({
  distance: (a: string, b: string): number => {
    matrices++
    return real(a, b)
  },
}))

const { nearestDeclared, nearestId } = await import("./suggest.ts")

const IDS = ((): ReadonlyArray<string> => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  let held = 7
  const roll = (below: number): number => {
    held = (held * 1103515245 + 12345) % 2147483648
    return Math.floor(held / 65536) % below
  }
  return Array.from({ length: 2000 }, () =>
    Array.from({ length: 8 }, () => alphabet[roll(alphabet.length)]).join(""))
})()

class Counted extends Map<string, string> {
  public passes = 0
  public override keys(): MapIterator<string> {
    this.passes++
    return super.keys()
  }
}

const declared = (): Counted => new Counted(IDS.map((id) => [id, id]))

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

  expect(walked).toBe(IDS.length)
  expect(indexed).toBeLessThanOrEqual(32)
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

  expect(walkedPasses).toBe(burst.length)
  expect(held.passes).toBe(1)
  expect(walked).toBe(burst.length * IDS.length)
  expect(matrices).toBeLessThanOrEqual(burst.length * 32)
})

test("a second map is a second index — an offer is never answered off another revision's ids", () => {
  const ids = declared()
  expect(nearestDeclared(TYPO, ids)).toBe(FOUND)
  const without = new Counted(IDS.filter((id) => id !== FOUND).map((id) => [id, id]))
  expect(nearestDeclared(TYPO, without)).not.toBe(FOUND)
  expect(without.passes).toBe(1)
})
