/**
 * THE ORDER A SESSION'S SERVERS ARRIVE IN — the claim a re-rolling e2e failure
 * was named after.
 *
 * ## The bug
 *
 * The session-start registrations were handed back in the array the plugins had
 * pushed onto, under a comment that said the result came back "in dispatch
 * order, which is registration order, which is the bundle's". The last step does
 * not follow: a plugin registers when its `apply` runs, and a row's `apply` runs
 * when the loader's `import()` for that row resolves. Two rows, two imports, and
 * whichever came back first went first.
 *
 * What that reached was a conversation. The agent reported `servers: [olai odu
 * kolu]` where the same serve had reported `servers: [olai kolu odu]` the run
 * before, and the chips under the panel's header reordered with it — so a
 * scenario asserting the whole line failed on a different scenario each run,
 * which is how an ordering race reads from outside.
 *
 * ## So the claim is the ORDER, held where it can be false
 *
 * Every case below hands the items over in the WRONG order on purpose, because
 * a bench that handed them over in the bundle's order would pass over an
 * implementation that imposes nothing at all. That is exactly the bench the old
 * inline collection had: none.
 *
 * ## What moved, and what it costs this bench
 *
 * The sort used to read `@olai/bundle` directly and the bench mounted real
 * fibers on a real runtime to get at it. The rank is a SERVICE now
 * (`@olai/plugin-api`'s `Bundle`), because this package is a row and a row may
 * not import the registry — so what is under test is a pure function of a rank,
 * and the rank here is a list this file writes down. The registry half of the
 * old bench — a plugin whose fiber is gone contributes nothing — is a property
 * of the `SessionStart` offer rather than of the sort, and it is held where that
 * offer is (`../server.ts`, and `@olai/plugin-api`'s own `services.test.ts` for
 * the mechanism).
 */

import { expect, test } from "bun:test"

import { inBundleOrder } from "./order.ts"

/** A build's list, as a rank — a stranger LAST, which is the arm `indexOf`
 *  gets backwards. */
const ranked = (rows: ReadonlyArray<string>) => (plugin: string): number => {
  const at = rows.indexOf(plugin)
  return at === -1 ? rows.length : at
}

const ROWS = ["claude", "kolu", "odu"] as const
const rank = ranked(ROWS)
const named = (...names: ReadonlyArray<string>) => names.map((name) => ({ name }))
const order = (items: ReadonlyArray<{ readonly name: string }>) =>
  inBundleOrder(items, (one) => one.name, rank).map((one) => one.name)

/**
 * THE RACE, REPRODUCED — the rows handed over back to front.
 *
 * This is not a contrived order: it is one of the two orders two concurrent
 * dynamic imports can resolve in, and the one the failing runs happened to get.
 */
test("two rows that registered back to front come back in the bundle's order", () => {
  expect(order(named("odu", "kolu"))).toEqual(["kolu", "odu"])
})

/** ...and the order that was already right stays right, so the sort is not
 *  passing by reversing whatever it is handed. */
test("two rows that registered in the bundle's order are left alone", () => {
  expect(order(named("kolu", "odu"))).toEqual(["kolu", "odu"])
})

/** A NAME THE BUNDLE DOES NOT KNOW GOES LAST, and does not take a row with it.
 *  Unreachable in this build — every fiber is a row — and it is what an
 *  out-of-tree plugin will want the day one can be added: a stranger after
 *  everything the build shipped, rather than dropped or sorted to the front by
 *  an index of `-1`. */
test("a plugin the bundle never named goes last, and the rows keep their order", () => {
  expect(order(named("stranger", "odu", "kolu"))).toEqual(["kolu", "odu", "stranger"])
})

/** TWO STRANGERS KEEP THEIR ARRIVAL ORDER, which is the stability the sort
 *  inherits from `Array.prototype.sort` and the reason a process with no bundle
 *  behind it (every bench, the headless faces) gets arrival order back rather
 *  than a shuffle. */
test("rows the build ranks the same come back in the order they arrived", () => {
  expect(order(named("b-stranger", "a-stranger"))).toEqual(["b-stranger", "a-stranger"])
})

/** ONE PLUGIN MAY REGISTER MORE THAN ONE, and the two stay adjacent and in the
 *  order they were made — the reason the session-start collection is a roster
 *  rather than a table keyed by the plugin. */
test("two registrations from one plugin stay together, in the order they were made", () => {
  expect(order([{ name: "odu" }, { name: "kolu" }, { name: "odu" }]))
    .toEqual(["kolu", "odu", "odu"])
})
