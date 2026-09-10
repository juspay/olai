import { expect, test } from "bun:test"
import { Effect } from "effect"
import { definePlugin, Directory, Kinds, Offers, mountPlugin, openPlugins } from "@olai/plugin-api/services"
import { revalidation } from "./setup.ts"

test("vault revalidates changed kinds without reacting to unrelated rows", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "2026-09-05T00:00:00Z" })
  let refreshes = 0
  yield* mountPlugin(plugins.host, definePlugin({ name: "directory", needs: [Offers], apply: Effect.gen(function*() {
    yield* (yield* Offers).offer(Directory, () => ({ root: "/test", store: {
      refresh: () => Effect.sync(() => { refreshes++ }),
    } }))
  }) }))
  const mounted = yield* mountPlugin(plugins.host, revalidation)
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(0)
  const noise = yield* mountPlugin(plugins.host, definePlugin({ name: "noise", needs: [], apply: Effect.void }))
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(0)
  const kind = yield* mountPlugin(plugins.host, definePlugin({ name: "example", needs: [Kinds], apply: Effect.gen(function*() {
    yield* (yield* Kinds).register({ kind: "test", takes: "text", admits: () => true })
  }) }))
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(1)
  yield* kind.dispose
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(2)
  yield* noise.dispose
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(2)
  yield* mounted.dispose
  yield* mountPlugin(plugins.host, definePlugin({ name: "later", needs: [], apply: Effect.void }))
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(2)
}))))
