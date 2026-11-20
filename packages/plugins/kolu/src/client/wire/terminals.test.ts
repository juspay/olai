import { describe, expect, it } from "bun:test"

import { resolveTerminal, whoOf } from "./terminals.ts"

const FLEET = [
  "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44",
  "5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07",
  "5976aaaa-0000-4000-8000-000000000000",
]

describe("a terminal value", () => {
  it("resolves an EIGHT-CHARACTER PREFIX — the board's own spelling", () => {
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
    expect(resolveTerminal("5976", FLEET)).toEqual({ kind: "many", count: 2 })
  })

  it("says NONE for a value with prose after the id", () => {
    expect(resolveTerminal("cb9dcd13 (claude, dispatched 16:20)", FLEET))
      .toEqual({ kind: "none" })
  })

  it("says NONE for a terminal the fleet no longer holds", () => {
    expect(resolveTerminal("deadbeef", FLEET)).toEqual({ kind: "none" })
  })

  it("names NOTHING for an empty value, rather than everything", () => {
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
    expect(whoOf("nixos-config", "master")).toBe("nixos-config·master")
  })

  it("is the label alone where nobody named a repo", () => {
    expect(whoOf(null, "the lane the evidence rides")).toBe("the lane the evidence rides")
  })

  it("DROPS THE JOINER for a blank label, rather than dangling one", () => {
    expect(whoOf("olai", "")).toBe("olai")
    expect(whoOf("olai", "  ")).toBe("olai")
  })

  it("names nothing at all when the row has neither", () => {
    expect(whoOf(null, "")).toBe("")
    expect(whoOf(null, "  ")).toBe("")
  })

  it("trims a label the way it is drawn", () => {
    expect(whoOf("olai", " panel-step ")).toBe("olai·panel-step")
  })
})
