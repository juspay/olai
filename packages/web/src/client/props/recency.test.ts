/**
 * THE TWO SPELLINGS, as a table — which the header always promised and did not
 * have, and whose absence is why the wait-chip's empty capsule survived.
 */

import { describe, expect, it } from "bun:test"

import { DAY, HOUR, MINUTE } from "../clock.ts"
import { recencyText } from "./recency.ts"

const NOW = 1_700_000_000_000
const agoBy = (ms: number): number => NOW - ms

describe("the wait-chip capsule — compact, and never empty", () => {
  it("is a DASH when the terminal has no activity to date", () => {
    // kolu's rule, verbatim: "A never-active row has no honest duration, and
    // the capsule cannot render empty." An empty violet capsule reads as a
    // rendering bug rather than as unknown — which is exactly what olai drew,
    // for every asking terminal padi had never seen activity in.
    expect(recencyText("wait-chip", null, NOW)).toBe("—")
  })

  it("is compact — the suffix would wrap the eight-character track", () => {
    expect(recencyText("wait-chip", agoBy(30 * 1000), NOW)).toBe("<1m")
    expect(recencyText("wait-chip", agoBy(7 * MINUTE), NOW)).toBe("7m")
    expect(recencyText("wait-chip", agoBy(3 * HOUR), NOW)).toBe("3h")
    expect(recencyText("wait-chip", agoBy(2 * DAY), NOW)).toBe("2d")
  })

  it("...and never says `ago` — 'waiting on you for 20h ago' is not a sentence", () => {
    expect(recencyText("wait-chip", agoBy(20 * HOUR), NOW)).not.toContain("ago")
  })
})

describe("the body phrase — a sentence, and empty when there is nothing to say", () => {
  it("says NOTHING for a terminal with no activity to date", () => {
    // The opposite of the capsule, and the reason the mode has to reach this
    // function at all: on a line, absence should read as absence.
    expect(recencyText("ago", null, NOW)).toBe("")
  })

  it("says `just now` under a minute rather than a measurement", () => {
    expect(recencyText("ago", agoBy(30 * 1000), NOW)).toBe("just now")
  })

  it("says `5m ago` above one", () => {
    expect(recencyText("ago", agoBy(5 * MINUTE), NOW)).toBe("5m ago")
    expect(recencyText("ago", agoBy(3 * HOUR), NOW)).toBe("3h ago")
  })
})

describe("a clock that disagrees", () => {
  it("reads a FUTURE stamp as the smallest unit rather than a negative number", () => {
    // Two machines whose clocks differ is ordinary, and `-4m` on a row is a
    // bug report waiting to be filed about the wrong thing.
    expect(recencyText("wait-chip", NOW + 4 * MINUTE, NOW)).toBe("<1m")
    expect(recencyText("ago", NOW + 4 * MINUTE, NOW)).toBe("just now")
  })
})

describe("hidden", () => {
  it("spells like the body, and the row draws none of it", () => {
    // `hidden` carries no text in kolu's union at all; olai passes one and the
    // row ignores it. Pinned so a future reader knows it is deliberate rather
    // than an arm nobody thought about.
    expect(recencyText("hidden", null, NOW)).toBe("")
  })
})
