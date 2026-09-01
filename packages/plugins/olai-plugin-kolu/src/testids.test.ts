/**
 * THAT THE MERGE BEHIND `./testids` LOSES NOTHING — the guarantee the package
 * wall used to carry, put back as a test.
 *
 * ## What the fold took away
 *
 * Before the appliance fold, `./ui/testids.ts` was one package's `./testids`
 * door and `../testids.ts` was another's, so both were rows in
 * `@olai/plugin-api`'s `testids.test.ts` and its disjointness sweep covered
 * both. The fold made them two modules of one package with ONE door, and
 * kolu's row in that sweep is now the POST-MERGE object — so a key lost in the
 * spread is gone before the walk one floor up ever runs, and that file's count
 * (`Object.keys(PLUGIN_TESTID).length === seen.size`) compares the survivors
 * with the survivors.
 *
 * ## Two drafts of this file were wrong, and the second one is worth recording
 *
 * The first was PROSE: the door's header claimed a key spelled twice would be
 * "a duplicate-key error on the literal below". It is not — `{ ...ui, padi: … }`
 * is a legal spread override and the explicit key silently wins, because
 * TypeScript's duplicate-key diagnostic fires only for two literal keys in ONE
 * literal.
 *
 * The second was a TEST THAT COULD NOT FAIL. It reconstructed the chrome half
 * by SUBTRACTION — the keys of the merged object that are not in `ui` — and
 * then asked whether the two halves shared a key. They never can: a key both
 * halves declare is in `ui`, so the subtraction removes it from the other side,
 * and the clash list is empty by construction. Its count check was blind for
 * the same reason — the merged object is short by exactly one key and the
 * derived half is short by exactly one key, so the two sides agree. Planted
 * against a real collision, both assertions reported clean while `ui`'s value
 * was gone.
 *
 * A derived second value cannot witness what the derivation dropped. So this
 * file asks the question with no derived value in it at all:
 *
 *   1. EVERY id `./ui/testids.ts` declares is the id the DOOR carries. That is
 *      the invariant "the spread lost nothing", stated directly. An overriding
 *      key makes the door disagree with `ui` on that key, and it goes red
 *      naming it.
 *   2. NO TWO KEYS in the door share a VALUE. One `[data-testid=…]` may name
 *      one component; two keys resolving to one selector is the failure the
 *      keys were separated to prevent, and it is the half that survives even
 *      when nothing was lost.
 *
 * ## Why a local file rather than a row in the sweep upstairs
 *
 * `@olai/plugin-api` imports this package; this package may not import it back,
 * which is the cycle the manifests decline to express and the fence holds as an
 * equality per package. The instrument cannot be shared downward, and the ui
 * half has no package door to be a row through. Two assertions in the package
 * that owns both halves is the whole of the alternative.
 */

import { expect, test } from "bun:test"

import { TESTID as door } from "./testids.ts"
import { TESTID as ui } from "./ui/testids.ts"

test("the reading is not vacuous", () => {
  // An empty `ui` would make the first claim below a walk over nothing, and a
  // door that WAS `ui` would make it a comparison of one value with itself.
  expect(Object.keys(ui).length).toBeGreaterThan(0)
  expect(Object.keys(door).length).toBeGreaterThan(Object.keys(ui).length)
})

test("every id the ui half declares is the id the door carries", () => {
  // Pairs rather than a bare equality, so a failure names the KEY as well as
  // the two values — which is what somebody has to go and look at.
  const lost = Object.entries(ui)
    .filter(([key, id]) => (door as Record<string, string>)[key] !== id)
    .map(([key, id]) => `${key}: ui says "${id}", the door says "${(door as Record<string, string>)[key]}"`)
  expect(lost).toEqual([])
})

test("no two keys in the door share a value", () => {
  const seen = new Map<string, string>()
  const clashes: Array<string> = []
  for (const [key, id] of Object.entries(door)) {
    const first = seen.get(id)
    if (first !== undefined) clashes.push(`"${id}": ${first} and ${key}`)
    else seen.set(id, key)
  }
  expect(clashes).toEqual([])
})
