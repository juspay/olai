/**
 * THE TWO TABLES, WITH TOY ENTRIES — the rules a door built on them rests on,
 * and no olai noun in the file.
 *
 * `@olai/plugin-api`'s benches hold the same rules against the REAL tables (the
 * vocabulary a validator judges with, the siblings a wire composes, the faces a
 * page draws). These are the primitives' own, because a table that stopped
 * telling its host it had moved would fail there in three places at once and be
 * diagnosed in none of them.
 *
 * ## What is here and what is not
 *
 * {@link ./registry.ts}'s keyed half is exercised end to end by every door built
 * on it, and its own three rules are argued at length in that file. What had no
 * bench anywhere is the ROSTER's `changed` — the parameter its header spent a
 * paragraph explaining it would never need, added for the tab's list slots,
 * where a page DRAWS from a roster and a section whose plugin unloaded is on
 * screen until something says the table moved. The rule that arrived with it is
 * the keyed table's own, word for word: THE ENTRY GOES BEFORE THE FAILURE DOES.
 */

import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"

import { roster } from "./registry.ts"
import { standing } from "./standing.ts"

test("a roster with no `changed` holds and releases, and nobody is told anything", async () => {
  const held = roster<string>()
  const run = standing()
  const scope = Scope.makeUnsafe()
  await Effect.runPromise(Scope.provide(held.hold("one"), scope))
  await run(held.hold("other"))
  expect(held.read()).toEqual(["one", "other"])
  await Effect.runPromise(Scope.close(scope, Exit.void))
  expect(held.read()).toEqual(["other"])
})

/** TOLD ON EVERY HOLD AND EVERY RELEASE — the keyed table's contract, on the
 *  half that had none. Once per entry rather than once per plugin: a reader that
 *  drew after the first of two would otherwise never hear about the second. */
test("a roster tells its host on the way in and on the way out", async () => {
  const said: Array<number> = []
  const held = roster<string>(() => said.push(1))
  const scope = Scope.makeUnsafe()
  await Effect.runPromise(Scope.provide(held.hold("one"), scope))
  await Effect.runPromise(Scope.provide(held.hold("other"), scope))
  expect(said.length).toBe(2)
  await Effect.runPromise(Scope.close(scope, Exit.void))
  expect(held.read()).toEqual([])
  expect(said.length).toBe(4)
})

/**
 * THE ENTRY GOES BEFORE THE FAILURE DOES.
 *
 * A host that refuses a re-read throws out of `changed`, and a failure in
 * `acquire` is a resource that was never acquired — so the release never runs
 * and a naive `set(); changed()` leaves the entry behind. What that costs is
 * written out on {@link ./registry.ts}: the refusing plugin lands `failed`, its
 * entry is still in the table, and the next plugin to register re-runs the
 * host's re-compose over a table holding a face nothing mounted.
 *
 * The keyed table has enforced that since it was written. This is the same claim
 * one function up, where the rule arrived with the parameter.
 */
test("a roster entry the host refused is not left behind", async () => {
  let refusing = false
  const said: Array<number> = []
  const held = roster<string>(() => {
    said.push(1)
    if (refusing) throw new Error("the host refuses this frame")
  })
  const run = standing()
  await run(held.hold("kept"))
  refusing = true
  // A STANDING SCOPE that is never closed, deliberately: an entry left behind by
  // the refusal has nothing to unwind it, so `read()` below is the whole claim.
  // Under `Effect.scoped` the close would have taken it back out either way and
  // the case would pass over the bug it is named after.
  const refused = await Effect.runPromiseExit(
    Scope.provide(held.hold("refused"), Scope.makeUnsafe()),
  )
  expect(Exit.isFailure(refused)).toBe(true)
  // The refused entry is gone and the one already held is untouched.
  expect(held.read()).toEqual(["kept"])
  // ...and the host was NOT told again on the way out of the refusal: it never
  // took the entry, so deleting it puts the table back exactly where the last
  // successful change left it and there is nothing for a re-read to do.
  expect(said.length).toBe(2)
})
