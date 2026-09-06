import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { implementRootedSurfaces, inMemoryStore } from "@kolu/surface/server"
import { Effect, Schema, SubscriptionRef } from "effect"
import { followSubscription } from "./subscription.ts"

const cell = defineSurface({ cells: { errors: { schema: Schema.Number, default: 0, verbs: ["get"] } } })
test("withdrawing and reopening an active vault subscription preserves the host runtime", async () => {
  const root = implementRootedSurfaces(defineSurface({}), {}, {})
  let failure: unknown
  void root.done.catch(error => { failure = error })
  try {
    for (const initial of [1, 10]) {
      const source = await Effect.runPromise(SubscriptionRef.make(initial))
      const values: number[] = []
      const mounted = root.mount("vault", cell, { cells: { errors: {
        store: inMemoryStore(0), connect: target => followSubscription(source, value => { values.push(value); target.set(value) }),
      } } })
      await Effect.runPromise(SubscriptionRef.set(source, initial + 1))
      await Promise.resolve()
      expect(values).toEqual([initial, initial + 1])
      await mounted.drop()
      await Effect.runPromise(SubscriptionRef.set(source, initial + 2))
      await Promise.resolve()
      expect(values).toEqual([initial, initial + 1])
      expect(failure).toBeUndefined()
    }
  } finally { await root.close() }
  await expect(root.done).resolves.toBeUndefined()
})

test("an actual subscription publisher defect still faults its runtime", async () => {
  const source = await Effect.runPromise(SubscriptionRef.make(0))
  const root = implementRootedSurfaces(defineSurface({}), {}, {})
  const boom = new Error("publisher defect")
  root.mount("vault", cell, { cells: { errors: { store: inMemoryStore(0), connect: () => followSubscription(source, () => { throw boom }) } } })
  await expect(root.done).rejects.toBe(boom)
  await root.close()
})
