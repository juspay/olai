import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { locations, location, slotFacade } from "@olai/plugin-api"
import { slotContracts } from "./slots.ts"
import { faces } from "./wire.ts"

test("wake controls wait for the strip, withdraw with their plugin, and return on registration", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const store = yield* locations()
  const slots = slotFacade(store)
  const face = () => null
  const owner = yield* Scope.make()
  yield* Scope.provide(slots.forOwner("mail").register("conversation.wake", face), owner)
  yield* store.settled
  expect(slots.faces.hung("conversation.wake")).toEqual([])
  yield* store.forOwner("chat").contribute(location("root", "one"), null, { children: [slotContracts["conversation.wake"]] })
  yield* store.settled
  expect(slots.faces.hung("conversation.wake")[0]?.face).toBe(face)
  yield* Scope.close(owner, Exit.void)
  yield* store.settled
  expect(slots.faces.hung("conversation.wake")).toEqual([])
  yield* slots.forOwner("mail").register("conversation.wake", face)
  yield* store.settled
  expect(slots.faces.hung("conversation.wake")[0]?.plugin).toBe("mail")
}))))
test("the scope writer belongs only to the browser face", () => {
  expect(faces.browser["conversation.scope"]).toBe("tool")
  expect("agent" in faces).toBe(false)
})
