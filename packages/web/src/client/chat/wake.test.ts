/**
 * The doorbell rows, over values.
 *
 * The cases that matter are the ones where a row must NOT be offered — a plugin
 * this serve did not compose, and one that declares no doorbell at all — because
 * both draw a picker whose pick nothing would ever read, and neither looks
 * broken on screen. After that: that `off` is a row rather than an absence,
 * since the whole point of a control is that it can be found before it has been
 * used, and that the count is worded in the PLUGIN's noun with only the numeral
 * core's.
 */

import type { BuiltPlugin } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { ringersOf } from "./wake.ts"

/** A plugin that can ring, as the roster carries one. The words are a
 *  fixture's and not core's — every one of them arrives on the wire. */
const RINGER: BuiltPlugin = {
  name: "kolu",
  running: true,
  wake: {
    subject: "wake on terminal activity",
    from: "terminals from",
    waiting: { one: "fleet event waiting", many: "fleet events waiting" },
  },
}

/** ... and one that rings nobody, which is the ordinary case. */
const QUIET: BuiltPlugin = { name: "odu", running: true }

describe("which plugins are offered a doorbell at all", () => {
  test("one that is running and declares a wake", () => {
    const rows = ringersOf([RINGER], [])
    expect(rows.map((row) => row.name)).toEqual(["kolu"])
    expect(rows[0]?.subject).toBe("wake on terminal activity")
  })

  test("but not one this serve did not compose", () => {
    // Its serving half is not on the wire, so a pick stored against it would
    // be a pick nothing will ever read.
    expect(ringersOf([{ ...RINGER, running: false }], [])).toEqual([])
  })

  test("and not one that declares no wake", () => {
    expect(ringersOf([QUIET], [])).toEqual([])
  })

  test("in the order the build lists them, not the order they were scoped", () => {
    const second: BuiltPlugin = { ...RINGER, name: "padi" }
    const rows = ringersOf(
      [RINGER, second],
      [{ name: "padi", file: "Fleet.olai", waiting: 0 }],
    )
    expect(rows.map((row) => row.name)).toEqual(["kolu", "padi"])
  })
})

describe("what one row says", () => {
  test("a conversation nobody has scoped still gets its row, pointed at nothing", () => {
    const rows = ringersOf([RINGER], [])
    expect(rows[0]?.file).toBeNull()
    expect(rows[0]?.held).toBeNull()
  })

  test("and one that was scoped names the file it was pointed at", () => {
    const rows = ringersOf([RINGER], [{ name: "kolu", file: "work/Fleet.olai", waiting: 0 }])
    expect(rows[0]?.file).toBe("work/Fleet.olai")
  })

  test("a scope for a plugin with no row of its own is dropped", () => {
    // Somebody scoped it, then this serve was started without it. There is
    // nothing to draw — no subject, no word for what waits — and the stored
    // pick is not lost by not being offered.
    expect(ringersOf([QUIET], [{ name: "kolu", file: "Fleet.olai", waiting: 3 }])).toEqual([])
  })
})

describe("what it is holding, in the plugin's own words", () => {
  test("nothing held says nothing at all, rather than a zero", () => {
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 0 }])[0]?.held)
      .toBeNull()
  })

  test("one held takes the plugin's singular", () => {
    const row = ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 1 }])[0]
    expect(row?.held).toBe("1 fleet event waiting")
    expect(row?.waiting).toBe(1)
  })

  test("and several take its plural — core supplies the numeral and no noun", () => {
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 4 }])[0]?.held)
      .toBe("4 fleet events waiting")
  })
})
