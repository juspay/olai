/**
 * THE LIVE-PROPERTIES SEAM — that the drawer's question is the GENERAL one.
 *
 * What is under test is not the terminal door and not the CI chip: it is that
 * a face can be registered without the drawer learning anything about it, that
 * the three rules a dressing must satisfy are decided in one place rather than
 * restated at each face, and that the two SHAPES a dressing can take — a chip
 * beside the value, a block that owns a row — land in the two places the
 * drawer draws. The two real tenants happen to be the first consumers; nothing
 * here imports either.
 */

import { describe, expect, it } from "bun:test"

import { dressingFor, layOut, registerLive } from "./live.ts"
import type { Entry } from "./drawer.ts"

const entry = (over: Partial<Entry> = {}): Entry => ({
  key: "k",
  value: "v",
  values: ["v"],
  system: false,
  listed: false,
  ...over,
})

/** Faces with no component in them — the seam does not care what a dressing
 *  DRAWS, which is the whole of what it buys. */
const NOTHING = () => null
const ALSO_NOTHING = () => null
const BUILT = { Block: NOTHING }
const RUNNING = { Chip: NOTHING, Pane: ALSO_NOTHING }
registerLive("built", BUILT)
registerLive("running", RUNNING)

describe("which properties are live", () => {
  it("answers by the property's KEY, and by nothing else about it", () => {
    expect(dressingFor(entry({ key: "built" }))).toBe(BUILT)
    expect(dressingFor(entry({ key: "unregistered" }))).toBeUndefined()
  })

  it("leaves SYSTEM entries alone — those are fields with verbs of their own", () => {
    expect(dressingFor(entry({ key: "built", system: true }))).toBeUndefined()
  })

  it("refuses a key holding a LIST, because one face cannot report on three facts", () => {
    // The wrong-door rule read one module over: a value naming three things has
    // not named one of them, and a face about one of them would have to pick.
    expect(dressingFor(entry({ key: "built", value: "a, b", values: ["a", "b"] })))
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
    expect(laid.run.map((one) => one.entry.key)).toEqual(["agent", "pr"])
    expect(laid.blocks.map((one) => one.entry.key)).toEqual(["built"])
  })

  it("keeps a CHIP dressing in the run, because its face draws BESIDE the value", () => {
    // The difference between the two shapes, and the reason the seam grew a
    // second one: a `worktree` is still a path somebody greps by and edits,
    // so its live face is an addition to the line rather than a replacement
    // of it — where a terminal door owns a row and takes the value with it.
    const laid = layOut([entry({ key: "running" }), entry({ key: "agent" })])
    expect(laid.run.map((one) => one.entry.key)).toEqual(["running", "agent"])
    expect(laid.blocks).toEqual([])
    expect(laid.run[0]?.chip).toBe(NOTHING)
    expect(laid.run[0]?.pane).toBe(ALSO_NOTHING)
    // ...and an undressed entry carries neither, so the drawer draws exactly
    // what it drew before this seam existed.
    expect(laid.run[1]?.chip).toBeUndefined()
    expect(laid.run[1]?.pane).toBeUndefined()
  })

  it("draws a dressed property PLAIN while it is being edited — one text box in the vault", () => {
    // The read/write split: a dressing is the read face and the chip is the
    // write face, so no face has to grow a text box of its own.
    const entries = [entry({ key: "built" }), entry({ key: "running" })]
    const editing = layOut(entries, "built")
    expect(editing.run.map((one) => one.entry.key)).toEqual(["built", "running"])
    expect(editing.blocks).toEqual([])
    // A chip dressing was already in the run, so what editing takes off it is
    // its FACE — the live half goes quiet while somebody is typing the value
    // it is derived from.
    expect(layOut(entries, "running").run[0]?.chip).toBeUndefined()
    // ...and it all comes back the moment the editor closes.
    expect(layOut(entries, undefined).blocks.map((one) => one.entry.key)).toEqual(["built"])
    expect(layOut(entries, undefined).run[0]?.chip).toBe(NOTHING)
  })

  it("hands back an empty run rather than nothing, so a drawer of only blocks draws", () => {
    const laid = layOut([entry({ key: "built" })])
    expect(laid.run).toEqual([])
    expect(laid.blocks).toHaveLength(1)
  })
})
