/**
 * THE BLOCK SEAM — that the drawer's question is the GENERAL one.
 *
 * What is under test is not the terminal door: it is that a property renderer
 * can be registered without the drawer learning anything about it, and that the
 * three rules a block must satisfy are decided in one place rather than
 * restated at each renderer. The terminal door happens to be the first
 * consumer; nothing here imports it.
 */

import { describe, expect, it } from "bun:test"

import { blockFor, layOut, registerBlock } from "./blocks.ts"
import type { Entry } from "./drawer.ts"

const entry = (over: Partial<Entry> = {}): Entry => ({
  key: "k",
  value: "v",
  values: ["v"],
  system: false,
  listed: false,
  ...over,
})

/** A renderer with no component in it — the seam does not care what a block
 *  DRAWS, which is the whole of what it buys. */
const NOTHING = () => null
registerBlock("built", NOTHING)

describe("which properties draw as blocks", () => {
  it("answers by the property's KEY, and by nothing else about it", () => {
    expect(blockFor(entry({ key: "built" }))).toBe(NOTHING)
    expect(blockFor(entry({ key: "unregistered" }))).toBeUndefined()
  })

  it("leaves SYSTEM entries alone — those are fields with verbs of their own", () => {
    expect(blockFor(entry({ key: "built", system: true }))).toBeUndefined()
  })

  it("refuses a key holding a LIST, because a row cannot report on three facts", () => {
    // The wrong-door rule read one module over: a value naming three things has
    // not named one of them, and a renderer that owns a row would have to pick.
    expect(blockFor(entry({ key: "built", value: "a, b", values: ["a", "b"] })))
      .toBeUndefined()
  })
})

describe("laying a drawer out", () => {
  it("puts blocks under the run and leaves the run in the file's own order", () => {
    const laid = layOut([
      entry({ key: "agent" }),
      entry({ key: "built" }),
      entry({ key: "pr" }),
    ])
    expect(laid.run.map((one) => one.key)).toEqual(["agent", "pr"])
    expect(laid.blocks.map((one) => one.entry.key)).toEqual(["built"])
  })

  it("draws a block as a CHIP while it is being edited — one text box in the vault", () => {
    // The read/write split: a block is the read face and the chip is the write
    // face, so no block renderer has to grow a text box of its own.
    const entries = [entry({ key: "built" })]
    expect(layOut(entries, "built").run.map((one) => one.key)).toEqual(["built"])
    expect(layOut(entries, "built").blocks).toEqual([])
    // ...and it goes back to being a block the moment the editor closes.
    expect(layOut(entries, undefined).blocks.map((one) => one.entry.key)).toEqual(["built"])
  })

  it("hands back an empty run rather than nothing, so a drawer of only blocks draws", () => {
    const laid = layOut([entry({ key: "built" })])
    expect(laid.run).toEqual([])
    expect(laid.blocks).toHaveLength(1)
  })
})
