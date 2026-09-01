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
    kinds: ["outline"],
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
      [{ name: "padi", file: "Fleet.olai", waiting: 0, fault: null }],
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
    const rows = ringersOf([RINGER], [{ name: "kolu", file: "work/Fleet.olai", waiting: 0, fault: null }])
    expect(rows[0]?.file).toBe("work/Fleet.olai")
  })

  test("a scope for a plugin with no row of its own is dropped", () => {
    // Somebody scoped it, then this serve was started without it. There is
    // nothing to draw — no subject, no word for what waits — and the stored
    // pick is not lost by not being offered.
    expect(ringersOf([QUIET], [{ name: "kolu", file: "Fleet.olai", waiting: 3, fault: null }])).toEqual([])
  })
})

describe("what it is holding, in the plugin's own words", () => {
  test("nothing held says nothing at all, rather than a zero", () => {
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 0, fault: null }])[0]?.held)
      .toBeNull()
  })

  test("one held takes the plugin's singular", () => {
    const row = ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 1, fault: null }])[0]
    expect(row?.held).toBe("1 fleet event waiting")
    expect(row?.waiting).toBe(1)
  })

  test("and several take its plural — core supplies the numeral and no noun", () => {
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 4, fault: null }])[0]?.held)
      .toBe("4 fleet events waiting")
  })
})

/**
 * THE TWO STATES WHERE THE ROW REPORTS A FAULT — the file this doorbell was
 * pointed at is not served any more, or it is served and is not a kind this
 * doorbell can read.
 *
 * It is the fact the whole feature turns on: a doorbell that derives nothing
 * derives nothing FOREVER, and the silence that follows is indistinguishable
 * from the silence of a subject with nothing to report. So the row carries the
 * fault AND its cause, and the strip draws that instead of a live answer — a
 * picker still naming a file nothing will ever read is the control asserting
 * something untrue.
 */
describe("a doorbell that is not watching what it names", () => {
  test("the row says so, and goes on naming the file it is about", () => {
    // The path is what somebody has to recognise to know which file it was, so
    // it stays — the row does not go blank and does not read as `off`.
    const row = ringersOf([RINGER], [{ name: "kolu", file: "lanes.olai", waiting: 0, fault: "gone" }])[0]
    expect(row?.fault).toBe("gone")
    expect(row?.file).toBe("lanes.olai")
  })

  test("and the cause travels, because the strip says a different thing for each", () => {
    // A pick stored on a document — the state a picker that offered every
    // served file could leave behind. The file is right there; nothing in it
    // can ever claim anything, so it is a fault and not a rename.
    const row = ringersOf([RINGER], [{
      name: "kolu",
      file: "2026-09-01.md",
      waiting: 0,
      fault: "unwatchable",
    }])[0]
    expect(row?.fault).toBe("unwatchable")
    expect(row?.file).toBe("2026-09-01.md")
  })

  test("off is not broken", () => {
    // A conversation nobody scoped has no file for a fault to be about, and its
    // row is drawn all the same. The two states must not collapse into one.
    expect(ringersOf([RINGER], [])[0]?.fault).toBeNull()
    expect(ringersOf([RINGER], [{ name: "kolu", file: "Fleet.olai", waiting: 0, fault: null }])[0]?.fault)
      .toBeNull()
  })

  test("what it was still holding is still counted, in the plugin's own words", () => {
    // A fault does not throw away bodies that arrived before it: the panel's
    // rule is that the alternative to holding words out of sight is not
    // dropping them, it is showing them — and that does not change because the
    // doorbell has since broken.
    const row = ringersOf([RINGER], [{ name: "kolu", file: "lanes.olai", waiting: 2, fault: "gone" }])[0]
    expect(row?.held).toBe("2 fleet events waiting")
  })
})

describe("what the picker is allowed to offer", () => {
  test("the kinds the plugin declared ride the row, because the picker filters by them", () => {
    // Core knows what a file IS (`@olai/format`'s registry) and never what a
    // wake file MEANS, so which kinds can carry a filter is the plugin's answer
    // arriving as data. {@link ./scopable.ts} is where it is spent.
    expect(ringersOf([RINGER], [])[0]?.kinds).toEqual(["outline"])
  })

  test("and a serve that declared none offers nothing, rather than everything", () => {
    // A tab left open across a downgrade. The key is optional on the wire so
    // that its absence cannot fail the roster's decode and take every plugin's
    // mount with it — and what absence MEANS here is the whole point: an empty
    // list matches no path, where a missing filter would match every one.
    const { kinds: _declared, ...said } = RINGER.wake!
    const older: BuiltPlugin = { ...RINGER, wake: said }
    expect(ringersOf([older], [])[0]?.kinds).toEqual([])
  })
})
