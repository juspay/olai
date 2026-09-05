import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { location, locations, slotFacade, slotLocation } from "./browser.ts"

test("legacy and native entries share occupancy, child withdrawal, and one diagnostic ledger", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const store = yield* locations()
  const legacy = slotFacade(store)
  const native = store.forOwner("native")
  const shell = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void))
  const panel = slotLocation("app.panel")
  const marks = slotLocation("delivery.mark")
  let starts = 0
  let stops = 0
  yield* legacy.forOwner("chat").register("app.panel", () => null, { children: [marks] })
  yield* native.contribute(marks, { plugin: "native", face: () => null }, {
    key: "native",
    activate: Effect.acquireRelease(Effect.sync(() => { starts++ }), () => Effect.sync(() => { stops++ })),
  })
  yield* store.settled
  expect(legacy.faces.only("app.panel")).toBeNull()
  expect(store.inspect().every((entry) => entry.state === "waiting")).toBe(true)
  const duplicate = yield* Effect.exit(native.contribute(panel, { plugin: "native", face: () => null }))
  expect(Exit.isFailure(duplicate)).toBe(true)
  yield* Scope.provide(store.forOwner("shell").contribute(location("root", "one"), null, { children: [panel] }), shell)
  yield* store.settled
  expect(starts).toBe(1)
  expect(legacy.faces.hung("delivery.mark")[0]?.plugin).toBe("native")
  expect(store.read(panel)[0]?.value ?? null).toBe(legacy.faces.only("app.panel"))
  yield* Scope.close(shell, Exit.void)
  yield* store.settled
  expect(stops).toBe(1)
  expect(legacy.faces.hung("delivery.mark")).toEqual([])
  expect(store.inspect()).toHaveLength(2)
}))))
