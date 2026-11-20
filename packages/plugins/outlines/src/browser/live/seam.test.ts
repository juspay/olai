import { describe, expect, it } from "bun:test"

import { dressingFor, type Dressing, type Dressings, layOut, type Licensed } from "./seam.ts"
import type { Entry } from "olai-plugin-outlines/property-values"

const entry = (over: Partial<Entry> = {}): Entry => ({
  key: "k",
  value: "v",
  values: ["v"],
  system: false,
  listed: false,
  ...over,
})

const NOTHING = () => null
const ALSO_NOTHING = () => null
const BUILT: Dressing = { Block: NOTHING }
const RUNNING: Dressing = { Chip: NOTHING, Pane: ALSO_NOTHING }

const dressing = (table: Readonly<Record<string, Dressing>>): Dressings => (word) => table[word]

const DRESSED = dressing({ built: BUILT, running: RUNNING })

const claiming = (answers: Readonly<Record<string, string>>): Licensed => (key) => answers[key]

const DECLARED: Licensed = claiming({ pty: "built", checkout: "running" })

describe("which properties are live", () => {
  it("answers by the WORD the page says claims the value, not by the key", () => {
    expect(dressingFor(entry({ key: "pty" }), DECLARED, DRESSED)).toBe(BUILT)
    expect(dressingFor(entry({ key: "built" }), DECLARED, DRESSED)).toBeUndefined()
  })

  it("answers nothing for a word no dressing was registered under", () => {
    const stray = claiming({ k: "unregistered" })
    expect(dressingFor(entry(), stray, DRESSED)).toBeUndefined()
  })

  it("leaves SYSTEM entries alone — those are fields with verbs of their own", () => {
    expect(dressingFor(entry({ key: "pty", system: true }), DECLARED, DRESSED))
      .toBeUndefined()
  })

  it("refuses a key holding a LIST, because one face cannot report on three facts", () => {
    expect(
      dressingFor(
        entry({ key: "pty", value: "a, b", values: ["a", "b"] }),
        DECLARED,
        DRESSED,
      ),
    ).toBeUndefined()
  })

  it("looks the licence up by the VALUE it is about, so two rows can differ", () => {
    const perValue: Licensed = (key, value) =>
      key === "pty" && value === "c56b6183" ? "built" : undefined
    const naming = (value: string) => entry({ key: "pty", value, values: [value] })
    expect(dressingFor(naming("c56b6183"), perValue, DRESSED)).toBe(BUILT)
    expect(dressingFor(naming("a note about it"), perValue, DRESSED)).toBeUndefined()
  })
})

describe("laying a drawer out", () => {
  it("puts blocks under the run and leaves the run in the file's own order", () => {
    const laid = layOut([
      entry({ key: "agent" }),
      entry({ key: "pty" }),
      entry({ key: "pr" }),
    ], undefined, DECLARED, DRESSED)
    expect(laid.run.map((one) => one.entry.key)).toEqual(["agent", "pr"])
    expect(laid.blocks.map((one) => one.entry.key)).toEqual(["pty"])
  })

  it("keeps a CHIP dressing in the run, because its face draws BESIDE the value", () => {
    const laid = layOut(
      [entry({ key: "checkout" }), entry({ key: "agent" })],
      undefined,
      DECLARED,
      DRESSED,
    )
    expect(laid.run.map((one) => one.entry.key)).toEqual(["checkout", "agent"])
    expect(laid.blocks).toEqual([])
    expect(laid.run[0]?.chip).toBe(NOTHING)
    expect(laid.run[0]?.pane).toBe(ALSO_NOTHING)
    expect(laid.run[1]?.chip).toBeUndefined()
    expect(laid.run[1]?.pane).toBeUndefined()
  })

  it("draws a dressed property PLAIN while it is being edited — one text box in the vault", () => {
    const entries = [entry({ key: "pty" }), entry({ key: "checkout" })]
    const editing = layOut(entries, "pty", DECLARED, DRESSED)
    expect(editing.run.map((one) => one.entry.key)).toEqual(["pty", "checkout"])
    expect(editing.blocks).toEqual([])
    expect(layOut(entries, "checkout", DECLARED, DRESSED).run[0]?.chip).toBeUndefined()
    expect(layOut(entries, undefined, DECLARED, DRESSED).blocks.map((one) => one.entry.key))
      .toEqual(["pty"])
    expect(layOut(entries, undefined, DECLARED, DRESSED).run[0]?.chip).toBe(NOTHING)
  })

  it("hands back an empty run rather than nothing, so a drawer of only blocks draws", () => {
    const laid = layOut([entry({ key: "pty" })], undefined, DECLARED, DRESSED)
    expect(laid.run).toEqual([])
    expect(laid.blocks).toHaveLength(1)
  })
  it("a word nothing dresses draws as the plain chip it always did", () => {
    const claimed = claiming({ pty: "licensed" })
    expect(dressingFor(entry({ key: "pty" }), claimed, DRESSED)).toBeUndefined()
    const laid = layOut([entry({ key: "pty" })], undefined, claimed, DRESSED)
    expect(laid.blocks).toEqual([])
    expect(laid.run.map((one) => one.entry.key)).toEqual(["pty"])
    expect(laid.run[0]?.chip).toBeUndefined()
    expect(dressingFor(entry({ key: "pty" }), claimed, dressing({ licensed: BUILT })))
      .toBe(BUILT)
  })
})
