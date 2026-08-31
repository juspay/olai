/**
 * THAT NO TWO PLUGINS CLAIM ONE TESTID.
 *
 * `./testids.ts` merges every plugin's table into one flat record, and a spread
 * resolves a collision silently in favour of whichever was written last. A
 * silent collision here is a scenario asserting on the wrong package's element —
 * green, and about nothing. So the disjointness is COUNTED, which is the same
 * move the framework's `mergeDisjointGroups` makes about wire tags and for the identical
 * reason: a proof that rests on an argument nobody re-checks is the class of
 * thing this repo keeps turning into a test.
 *
 * Both HALVES are checked. Two plugins must not share a KEY (the spread would
 * drop one), and they must not share a VALUE either (two keys resolving to one
 * `[data-testid=…]` is a selector that matches two different components, which
 * is the failure the keys were separated to prevent).
 */

import { describe, expect, test } from "bun:test"

import { TESTID as kolu } from "@olai/plugin-kolu/testids"
import { TESTID as odu } from "@olai/plugin-odu/testids"

import { PLUGIN_TESTID } from "./testids.ts"

/** The tables, in the order `./testids.ts` spreads them. A third plugin is a
 *  line here, which is the cost the registry's three lists already pay. */
const TABLES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["kolu", kolu],
  ["odu", odu],
]

describe("the plugins' testids are disjoint", () => {
  test("the sweep is actually reading both tables", () => {
    // Not vacuous: an empty table would pass every claim below.
    for (const [name, table] of TABLES) {
      expect(Object.keys(table).length, name).toBeGreaterThan(0)
    }
  })

  test("no two plugins claim one KEY — a spread would drop one silently", () => {
    const seen = new Map<string, string>()
    const clashes: Array<string> = []
    for (const [name, table] of TABLES) {
      for (const key of Object.keys(table)) {
        const first = seen.get(key)
        if (first !== undefined) clashes.push(`${key}: ${first} and ${name}`)
        else seen.set(key, name)
      }
    }
    expect(clashes).toEqual([])
    // ...and the merge kept every one of them, which is the same fact said as a
    // count rather than as a walk.
    expect(Object.keys(PLUGIN_TESTID).length).toBe(seen.size)
  })

  test("no two plugins claim one VALUE — one selector may name one component", () => {
    const seen = new Map<string, string>()
    const clashes: Array<string> = []
    for (const [name, table] of TABLES) {
      for (const [key, id] of Object.entries(table)) {
        const first = seen.get(id)
        if (first !== undefined) clashes.push(`"${id}": ${first} and ${name}/${key}`)
        else seen.set(id, `${name}/${key}`)
      }
    }
    expect(clashes).toEqual([])
  })
})
