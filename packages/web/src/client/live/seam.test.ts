/**
 * THE LIVE-PROPERTIES SEAM — that the drawer's question is the GENERAL one.
 *
 * What is under test is not the terminal door and not the CI chip: it is that
 * a face can be registered without the drawer learning anything about it, that
 * the rules a dressing must satisfy are decided in one place rather than
 * restated at each face, and that the two SHAPES a dressing can take — a chip
 * beside the value, a block that owns a row — land in the two places the
 * drawer draws. The two real tenants happen to be the first consumers; nothing
 * here imports either.
 *
 * THE FIRST DESCRIBE IS THE ONE THAT CHANGED, and it is the seam's own defect
 * being pinned. The table used to be keyed on the property KEY, so a face drew
 * wherever a vault happened to name a key after a plugin's kind and nowhere
 * else — while the server's walk and value gate followed the declared KIND. The
 * key selects nothing now; the page's LICENCE does, and the two cases that
 * matter are the two the old shape got backwards.
 */

import { describe, expect, it } from "bun:test"

import { ALL_RUNNING, dressingFor, layOut, type Licensed, registerLive } from "./seam.ts"
import type { Entry } from "../props/drawer.ts"

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
registerLive("built", BUILT, "probe")
registerLive("running", RUNNING, "probe")

/**
 * A PAGE'S ANSWERS, as the drawer hands them down — the file already spent, so
 * what this takes is the pair a run has.
 *
 * The fixtures below claim a value under a word, and the word is what the table
 * above is keyed by. Nothing here maps a key to itself: that coincidence is
 * exactly what the old shape mistook for a rule, so the cases that need it spell
 * it, and the cases that need it broken spell that.
 */
const claiming = (answers: Readonly<Record<string, string>>): Licensed => (key) => answers[key]

/** The ordinary vault: it declared `pty` as the `built` kind, which is the case
 *  a key-matching table could not draw. */
const DECLARED: Licensed = claiming({ pty: "built", checkout: "running" })

describe("which properties are live", () => {
  it("answers by the WORD the page says claims the value, not by the key", () => {
    // Two halves of one claim, and each was a live wrong answer before the
    // licence travelled. A key called `pty` wears the face its vault declared…
    expect(dressingFor(entry({ key: "pty" }), ALL_RUNNING, DECLARED)).toBe(BUILT)
    // …and a key that merely SPELLS a registered word wears nothing, because a
    // vault that declared nothing has promised nothing. This is the behaviour
    // change a reader is most likely to notice, and it is the point: a property
    // somebody happened to call `terminal` is text until the vault says
    // otherwise.
    expect(dressingFor(entry({ key: "built" }), ALL_RUNNING, DECLARED)).toBeUndefined()
  })

  it("answers nothing for a word no dressing was registered under", () => {
    // A plugin that contributes a kind and no face — or a kind whose face this
    // BUILD does not carry. The value is claimed and draws as the chip it is.
    const stray = claiming({ k: "unregistered" })
    expect(dressingFor(entry(), ALL_RUNNING, stray)).toBeUndefined()
  })

  it("leaves SYSTEM entries alone — those are fields with verbs of their own", () => {
    expect(dressingFor(entry({ key: "pty", system: true }), ALL_RUNNING, DECLARED))
      .toBeUndefined()
  })

  it("refuses a key holding a LIST, because one face cannot report on three facts", () => {
    // The wrong-door rule read one module over: a value naming three things has
    // not named one of them, and a face about one of them would have to pick.
    expect(
      dressingFor(
        entry({ key: "pty", value: "a, b", values: ["a", "b"] }),
        ALL_RUNNING,
        DECLARED,
      ),
    ).toBeUndefined()
  })

  it("looks the licence up by the VALUE it is about, so two rows can differ", () => {
    // The licence is answered per drawn value and not per key (`@olai/format`'s
    // `Licence` carries the triple), which is what lets one key on one page
    // answer two ways — a mirror of another file's row is the ordinary way that
    // happens. The seam has to spend the entry's own single value, and this is
    // the case that fails if it spends anything else.
    const perValue: Licensed = (key, value) =>
      key === "pty" && value === "c56b6183" ? "built" : undefined
    const naming = (value: string) => entry({ key: "pty", value, values: [value] })
    expect(dressingFor(naming("c56b6183"), ALL_RUNNING, perValue)).toBe(BUILT)
    expect(dressingFor(naming("a note about it"), ALL_RUNNING, perValue)).toBeUndefined()
  })
})

describe("laying a drawer out", () => {
  it("puts blocks under the run and leaves the run in the file's own order", () => {
    const laid = layOut([
      entry({ key: "agent" }),
      entry({ key: "pty" }),
      entry({ key: "pr" }),
    ], undefined, ALL_RUNNING, DECLARED)
    expect(laid.run.map((one) => one.entry.key)).toEqual(["agent", "pr"])
    expect(laid.blocks.map((one) => one.entry.key)).toEqual(["pty"])
  })

  it("keeps a CHIP dressing in the run, because its face draws BESIDE the value", () => {
    // The difference between the two shapes, and the reason the seam grew a
    // second one: a `worktree` is still a path somebody greps by and edits,
    // so its live face is an addition to the line rather than a replacement
    // of it — where a terminal door owns a row and takes the value with it.
    const laid = layOut(
      [entry({ key: "checkout" }), entry({ key: "agent" })],
      undefined,
      ALL_RUNNING,
      DECLARED,
    )
    expect(laid.run.map((one) => one.entry.key)).toEqual(["checkout", "agent"])
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
    const entries = [entry({ key: "pty" }), entry({ key: "checkout" })]
    const editing = layOut(entries, "pty", ALL_RUNNING, DECLARED)
    expect(editing.run.map((one) => one.entry.key)).toEqual(["pty", "checkout"])
    expect(editing.blocks).toEqual([])
    // A chip dressing was already in the run, so what editing takes off it is
    // its FACE — the live half goes quiet while somebody is typing the value
    // it is derived from.
    expect(layOut(entries, "checkout", ALL_RUNNING, DECLARED).run[0]?.chip).toBeUndefined()
    // ...and it all comes back the moment the editor closes.
    expect(layOut(entries, undefined, ALL_RUNNING, DECLARED).blocks.map((one) => one.entry.key))
      .toEqual(["pty"])
    expect(layOut(entries, undefined, ALL_RUNNING, DECLARED).run[0]?.chip).toBe(NOTHING)
  })

  it("hands back an empty run rather than nothing, so a drawer of only blocks draws", () => {
    const laid = layOut([entry({ key: "pty" })], undefined, ALL_RUNNING, DECLARED)
    expect(laid.run).toEqual([])
    expect(laid.blocks).toHaveLength(1)
  })

  it("a face whose plugin this serve is not running draws as a plain chip", () => {
    // THE SECOND LICENCE, and it is the whole of what `--plugins` means in a
    // browser. It is also the case that proves the two are not one question
    // said twice: the page HAS claimed this value, so whoever contributed the
    // word is running — and the plugin that registered the FACE is not. A tab
    // registers what the BUILD has, because import time is all it has, and asks
    // at the DRAW whether the serve composed the plugin whose face it is about.
    //
    // The failure this pins is not "a face is missing" — it is a face DRAWING ITS
    // OWN nothing-here arm, which is a row complaining about a daemon somebody
    // deliberately turned off rather than the plain chip an undressed property
    // has always shown. A live serve with `--plugins=` is what found it, because
    // it is invisible to a suite that only asks whether the table has an entry.
    registerLive("licensed", BUILT, "absent-tenant")
    const claimed = claiming({ pty: "licensed" })
    const off = (plugin: string): boolean => plugin !== "absent-tenant"
    expect(dressingFor(entry({ key: "pty" }), off, claimed)).toBeUndefined()
    expect(dressingFor(entry({ key: "pty" }), ALL_RUNNING, claimed)).toBe(BUILT)
    // ...and it leaves the run: no block, an ordinary chip, nothing else moved.
    const laid = layOut([entry({ key: "pty" })], undefined, off, claimed)
    expect(laid.blocks).toEqual([])
    expect(laid.run.map((one) => one.entry.key)).toEqual(["pty"])
    expect(laid.run[0]?.chip).toBeUndefined()
  })
})
