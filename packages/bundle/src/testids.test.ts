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

import { BUNDLE_NAMES as PLUGIN_NAMES } from "./rows.ts"
import { PLUGIN_TESTID } from "./testids.ts"

/**
 * THE TABLES, DERIVED FROM THE ROSTER rather than written beside it.
 *
 * It was two hand-written rows, and the cost was a shape the count below cannot
 * see: a third plugin added to `./testids.ts` but not here is caught only while
 * it contributes a key nothing else has — a table that fully ALIASES existing
 * keys slips both halves, because the merged object is no longer than the two
 * this file knows about. The roster is the thing that decides which plugins
 * exist; reading it is what makes this file follow the registry the way every
 * other list in this package does.
 *
 * A DYNAMIC IMPORT, because the door's address is composed from the name — the
 * same composition `olai-plugin-<name>` is everywhere else in this package —
 * and a static import cannot be. It is top-level `await` in a test module,
 * which bun runs directly; nothing bundles this file.
 */
const TABLES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = await Promise.all(
  PLUGIN_NAMES.map(async (name) => {
    const door = (await import(`olai-plugin-${name}/testids`)) as {
      TESTID: Readonly<Record<string, string>>
    }
    return [name, door.TESTID] as const
  }),
)

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
