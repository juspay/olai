/**
 * WHICH TERMINAL A VALUE NAMES — against the shapes the REAL board writes.
 *
 * The first case is the production defect: the vault writes eight-character
 * prefixes (seventy-eight of its bare values) and padi keys its fleet by the
 * whole uuid, so an exact lookup answered `undefined` and the chip drew the
 * hollow "no longer in the fleet" face over a terminal that was working.
 *
 * The second describe is the file's other fold, `whoOf`, and it is here for
 * the reason it exists at all: the blank-label case was a live defect in TWO
 * spellings of one rule and had to be repaired in both at once. There is one
 * spelling now, so there is one place that pins it — for the doorbell's
 * sentence and the events feed's WHO column both.
 */

import { describe, expect, it } from "bun:test"

import { resolveTerminal, whoOf } from "./terminals.ts"

/** The fleet, as padi keys it. */
const FLEET = [
  "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44",
  "5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07",
  "5976aaaa-0000-4000-8000-000000000000",
]

describe("a terminal value", () => {
  it("resolves an EIGHT-CHARACTER PREFIX — the board's own spelling", () => {
    // THE PRODUCTION DEFECT. This is what ~78 of the vault's bare values look
    // like, and an exact lookup answered nothing for every one of them.
    expect(resolveTerminal("cb9dcd13", FLEET)).toEqual({
      kind: "one",
      id: "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44",
    })
  })

  it("resolves a full uuid, which nine of them are", () => {
    expect(resolveTerminal("5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07", FLEET)).toEqual({
      kind: "one",
      id: "5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07",
    })
  })

  it("says MANY when a prefix is too short to be an address", () => {
    // Two ids begin `5976`. Nothing here may pick one: showing a dot for
    // whichever sorted first would be a green light about a terminal the
    // reader never named.
    expect(resolveTerminal("5976", FLEET)).toEqual({ kind: "many", count: 2 })
  })

  it("says NONE for a value with prose after the id", () => {
    // About ten of the board's values are `<id> (claude --model opus,
    // dispatched …)`. Pulling the id out of a sentence is the wrong door
    // `props/door.ts` exists to refuse — deciding which part of somebody's
    // words was the point. The fix for those is the vault writing the id bare.
    expect(resolveTerminal("cb9dcd13 (claude, dispatched 16:20)", FLEET))
      .toEqual({ kind: "none" })
  })

  it("says NONE for a terminal the fleet no longer holds", () => {
    expect(resolveTerminal("deadbeef", FLEET)).toEqual({ kind: "none" })
  })

  it("names NOTHING for an empty value, rather than everything", () => {
    // Every id has the empty string as a prefix, so the walk would call this
    // ambiguous — which reads as "three terminals" for a property somebody
    // left blank.
    expect(resolveTerminal("", FLEET)).toEqual({ kind: "none" })
  })

  it("is byte-exact — a value in another case names nothing", () => {
    expect(resolveTerminal("CB9DCD13", FLEET)).toEqual({ kind: "none" })
  })

  it("answers NONE against an empty fleet, for every shape", () => {
    for (const value of ["cb9dcd13", "", "anything"]) {
      expect(resolveTerminal(value, [])).toEqual({ kind: "none" })
    }
  })
})

describe("who a row is", () => {
  it("joins repo and label in kolu's own spelling", () => {
    expect(whoOf("olai", "kolu-events-feed")).toBe("olai·kolu-events-feed")
    // The disambiguation the label alone cannot do: two checkouts, one word.
    expect(whoOf("nixos-config", "master")).toBe("nixos-config·master")
  })

  it("is the label alone where nobody named a repo", () => {
    expect(whoOf(null, "the lane the evidence rides")).toBe("the lane the evidence rides")
  })

  it("DROPS THE JOINER for a blank label, rather than dangling one", () => {
    // THE DEFECT THAT TOOK TWO REPAIRS. The wire types `label` as a plain
    // string, so a terminal with no intent line and no branch folded to
    // `olai·` — a name ending in a joiner with nothing joined to it, in a
    // doorbell sentence a person reads. Whitespace is the same case: a label
    // of spaces is a label of nothing.
    expect(whoOf("olai", "")).toBe("olai")
    expect(whoOf("olai", "  ")).toBe("olai")
  })

  it("names nothing at all when the row has neither", () => {
    // The caller's business, not this fold's: the doorbell's line drops the
    // parenthesis and the terminal id carries the sentence alone.
    expect(whoOf(null, "")).toBe("")
    expect(whoOf(null, "  ")).toBe("")
  })

  it("trims a label the way it is drawn", () => {
    expect(whoOf("olai", " panel-step ")).toBe("olai·panel-step")
  })
})
