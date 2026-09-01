/**
 * THAT THIS TENANT'S TWO TABLES ARE DISJOINT — the same claim
 * `@olai/plugin-api`'s `testids.test.ts` makes about two PLUGINS, made here
 * about the two MODULES one plugin merges.
 *
 * ## Why it is needed, and why the appliance fold is what needed it
 *
 * Before the fold, `./ui/testids.ts` was a whole package's `./testids` door and
 * `./testids.ts` was another, so both were rows in the registry's `TABLES` and
 * the disjointness sweep up there covered both. The fold made them two modules
 * of one package with one door, and kolu's entry in that sweep is now the
 * POST-MERGE object — so a key lost in the spread is gone before the walk one
 * floor up ever sees it, and its count (`Object.keys(PLUGIN_TESTID).length ===
 * seen.size`) counts the survivors against the survivors.
 *
 * The first draft of the merged door claimed the compiler covered this: *"a key
 * spelled twice inside this package is a duplicate-key error on the literal
 * below."* It is not. `{ ...ui, padi: "padi" }` is a spread followed by an
 * explicit key — legal TypeScript, and the explicit key silently wins.
 * TypeScript's duplicate-key diagnostic fires only for two LITERAL keys in one
 * literal. So the guarantee the package wall used to carry went into prose, and
 * this file is it put back as a test.
 *
 * ## Why a local mirror rather than a shared walk
 *
 * `@olai/plugin-api` imports this package; this package may not import it back,
 * which is the cycle the manifests decline to express and the fence holds as an
 * equality. So the instrument cannot be shared downward, and the choice is
 * between forty lines of walk in a testlib nobody else would use and this — the
 * same two halves, over two tables, in the package that owns them.
 *
 * BOTH HALVES, for the reason the sweep upstairs gives: two modules must not
 * share a KEY (the spread would drop one) and must not share a VALUE either
 * (two keys resolving to one `[data-testid=…]` is a selector that matches two
 * different components, which is the failure the keys were separated to
 * prevent).
 */

import { describe, expect, test } from "bun:test"

import { TESTID as merged } from "./testids.ts"
import { TESTID as ui } from "./ui/testids.ts"

/** What `./testids.ts` spreads, and what it declares itself — the second read
 *  off the merged object by SUBTRACTION, because the module has no other name
 *  for its own half and inventing one would be a third place a key is written. */
const own: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(merged).filter(([key]) => !(key in ui)),
)

const TABLES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["ui", ui],
  ["browser", own],
]

describe("this tenant's testid tables are disjoint", () => {
  test("the sweep is actually reading both tables", () => {
    // Not vacuous: an empty table would pass every claim below. And `own` is a
    // subtraction, so an `ui` that swallowed the whole merged object would
    // leave it empty — which this is the floor against.
    for (const [name, table] of TABLES) {
      expect(Object.keys(table).length, name).toBeGreaterThan(0)
    }
  })

  test("no key is spelled in both — a spread would drop one silently", () => {
    const clashes = Object.keys(ui).filter((key) => key in own)
    expect(clashes).toEqual([])
    // ...and the merge kept every one of them, which is the same fact said as a
    // count rather than as a walk. This is what the SUBTRACTION above cannot
    // catch on its own: a key `ui` and this module both declare lands in `ui`'s
    // half by definition, so the count is what notices one went missing.
    expect(Object.keys(merged).length).toBe(Object.keys(ui).length + Object.keys(own).length)
  })

  test("no value is spelled in both — one selector may name one component", () => {
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
