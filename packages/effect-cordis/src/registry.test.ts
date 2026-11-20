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
  const refused = await Effect.runPromiseExit(
    Scope.provide(held.hold("refused"), Scope.makeUnsafe()),
  )
  expect(Exit.isFailure(refused)).toBe(true)
  expect(held.read()).toEqual(["kept"])
  expect(said.length).toBe(2)
})
