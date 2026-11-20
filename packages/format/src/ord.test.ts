import { describe, expect, test } from "bun:test"

import { ordBetween } from "./ord.ts"
const between = (before: string | null, after: string | null): string => {
  const minted = ordBetween(before, after)
  if (minted === null) {
    throw new Error(
      `expected room between \`${before ?? "(start)"}\` and \`${after ?? "(end)"}\``,
    )
  }
  if (before !== null) expect(before < minted).toBe(true)
  if (after !== null) expect(minted < after).toBe(true)
  return minted
}

describe("ordBetween", () => {
  test("the first child of an empty parent", () => {
    expect(ordBetween(null, null)).toBe("a0")
  })

  test("appending stays short — the common case must not grow", () => {
    let last = between(null, null)
    const minted = [last]
    for (let n = 0; n < 200; n++) {
      last = between(last, null)
      minted.push(last)
    }
    expect([...minted].sort()).toEqual(minted)
    expect(last.length).toBeLessThanOrEqual(4)
  })

  test("prepending stays short too", () => {
    let first = between(null, null)
    for (let n = 0; n < 50; n++) first = between(null, first)
    expect(first.length).toBeLessThanOrEqual(4)
  })

  test("inserting between two neighbours, repeatedly", () => {
    const low = "a0"
    let high = "a1"
    for (let n = 0; n < 60; n++) high = between(low, high)
  })

  test("existing files' spellings are neighbours it can work with", () => {
    between("a0", "a1")
    between("a1", null)
    between(null, "a0")
  })

  test("a hand-written neighbour still admits an insert", () => {
    for (const [before, after] of [
      ["zzz", null],
      [null, "zzz"],
      ["1", "2"],
      ["hello", "world"],
      ["a0", "a00000001"],
      ["", "5"],
    ] as ReadonlyArray<readonly [string | null, string | null]>) {
      between(before, after)
    }
  })

  test("a run of inserts against a hand-written neighbour keeps fitting", () => {
    let high = "world"
    for (let n = 0; n < 8; n++) high = between("hello", high)
  })

  test("no room is `null`, never a key in the wrong place", () => {
    expect(ordBetween("b", "a")).toBe(null)
    expect(ordBetween("b", "b0")).toBe(null)
    expect(ordBetween("hello", "hello000")).toBe(null)
  })
})
