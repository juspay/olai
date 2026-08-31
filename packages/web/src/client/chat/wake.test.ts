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
      [{ name: "padi", file: "Fleet.olai", waiting: 0, gone: false }],
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
    const rows = ringersOf([RINGER], [{ name: "kolu", file: "work/Fleet.olai", waiting: 0, gone: false }])
    expect(rows[0]?.file).toBe("work/Fleet.olai")
  })

  test("a scope for a plugin with no row of its own is dropped", () => {
    // Somebody scoped it, then this serve was started without it. There is
    // nothing to draw — no subject, no word for what waits — and the stored
    // pick is not lost by not being offered.
    expect(ringersOf([QUIET], [{ name: "kolu", file: "Fleet.olai", waiting: 3, gone: false }])).toEqual([])
  })
})

describe("what it is holding, in the plugin's own words", () => {
  test("nothing held says nothing at all, rather than a zero", () => {
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 0, gone: false }])[0]?.held)
      .toBeNull()
  })

  test("one held takes the plugin's singular", () => {
    const row = ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 1, gone: false }])[0]
    expect(row?.held).toBe("1 fleet event waiting")
    expect(row?.waiting).toBe(1)
  })

  test("and several take its plural — core supplies the numeral and no noun", () => {
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 4, gone: false }])[0]?.held)
      .toBe("4 fleet events waiting")
  })
})

/**
 * THE ONE STATE WHERE THE ROW REPORTS A FAULT — the file this doorbell was
 * pointed at is not served any more.
 *
 * It is the fact the whole feature turns on: a doorbell over a renamed file
 * derives nothing forever, and the silence that follows is indistinguishable
 * from the silence of a subject with nothing to report. So the row carries it,
 * and the strip draws it instead of a live answer — a picker still naming a
 * file nothing will ever read is the control asserting something untrue.
 */
describe("a doorbell whose file went away", () => {
  test("the row says so, and goes on naming the file that went", () => {
    // The path is what somebody has to recognise to know which file it was, so
    // it stays — the row does not go blank and does not read as `off`.
    const row = ringersOf([RINGER], [{ name: "kolu", file: "lanes.olai", waiting: 0, gone: true }])[0]
    expect(row?.gone).toBe(true)
    expect(row?.file).toBe("lanes.olai")
  })

  test("off is not broken", () => {
    // A conversation nobody scoped has no file for a fault to be about, and its
    // row is drawn all the same. The two states must not collapse into one.
    expect(ringersOf([RINGER], [])[0]?.gone).toBe(false)
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 0, gone: false }])[0]?.gone)
      .toBe(false)
  })

  test("what it was still holding is still counted, in the plugin's own words", () => {
    // A fault does not throw away bodies that arrived before it: the panel's
    // rule is that the alternative to holding words out of sight is not
    // dropping them, it is showing them — and that does not change because the
    // doorbell has since broken.
    const row = ringersOf([RINGER], [{ name: "kolu", file: "lanes.olai", waiting: 2, gone: true }])[0]
    expect(row?.held).toBe("2 fleet events waiting")
  })
})
