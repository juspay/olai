/**
 * THE THIRD LAYER OF ONE INVARIANT — that one `[data-testid=…]` names one
 * component — held where the two inner layers left a gap.
 *
 * `selector(id: TestId | PluginTestId)` one file over treats the app's own
 * table and every plugin's merged table as ONE namespace of attribute values: a
 * scenario writes `selector(TESTID.prop)` or `selector(PLUGIN_TESTID.padi)` and
 * the browser sees the same `[data-testid=…]` grammar either way. So a value
 * spelled in both tables is a selector that matches two different components,
 * and the scenario that spends it is green about the wrong element.
 *
 * That invariant is enforced twice already and neither reaches this seam:
 * `olai-plugin-kolu/src/testids.ts` refuses a collision between a tenant's two
 * halves AT the composition, and `@olai/plugin-api/src/testids.test.ts` holds
 * the plugins' doors disjoint from each other. Both are inside the plugin
 * world. Nothing compared it with the APP's table — the outermost and most
 * consumer-visible of the three — which is an inconsistent application of the
 * same judgement rather than a scoping decision anybody argued for.
 *
 * The appliance fold is what made it worth writing: kolu's ten `terminal*` /
 * `events*` ids used to sit behind a second package's own door that nothing
 * imported, and now they are spread into `PLUGIN_TESTID` and reachable through
 * this seam. The collision surface grew by ten values; the check for it did not
 * exist.
 *
 * VALUES rather than keys, because the value is what the selector spends. Two
 * tables may both call something `mount` — they are different objects and the
 * consumer names them apart. What they may not both spell is `"padi"`.
 */

import { expect, test } from "bun:test"

import { PLUGIN_TESTID } from "@olai/plugin-api/testids"

import { TESTID } from "./testids.ts"

test("the reading is not vacuous", () => {
  // A table that came back empty would make the claim below pass over nothing —
  // the one failure mode every sweep in this tree carries a floor against.
  expect(Object.keys(TESTID).length).toBeGreaterThan(20)
  expect(Object.keys(PLUGIN_TESTID).length).toBeGreaterThan(5)
})

test("no app testid is spelled by a plugin's", () => {
  const theirs = new Map(Object.entries(PLUGIN_TESTID).map(([key, id]) => [id as string, key]))
  const clashes = Object.entries(TESTID)
    .filter(([, id]) => theirs.has(id as string))
    .map(([key, id]) => `"${String(id)}": web's ${key} and the plugins' ${theirs.get(id as string)}`)
  expect(clashes.sort()).toEqual([])
})
