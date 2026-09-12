import { expect, test } from "bun:test"
import { Effect } from "effect"
import { definePlugin, Directory, FileKinds, Kinds, Offers, mountPlugin, openPlugins } from "@olai/plugin-api/services"
import { openViews } from "./views.ts"
import { revalidation } from "./setup.ts"

test("vault revalidates changed kinds without reacting to unrelated rows", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "2026-09-05T00:00:00Z" })
  let refreshes = 0
  const views = openViews()
  let readingClaims = views.fileKinds.current()
  yield* mountPlugin(plugins.host, definePlugin({ name: "vault", needs: [Offers], apply: Effect.gen(function*() {
    yield* (yield* Offers).own("file-kinds", views.fileKinds.provision)
  }) }))
  yield* mountPlugin(plugins.host, definePlugin({ name: "directory", needs: [Offers], apply: Effect.gen(function*() {
    yield* (yield* Offers).offer(Directory, () => ({ root: "/test", store: {
      read: () => Effect.succeed({ snapshot: { value: { claims: readingClaims } } }),
      refresh: () => Effect.sync(() => { refreshes++; readingClaims = views.fileKinds.current() }),
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
  const file = yield* mountPlugin(plugins.host, definePlugin({ name: "file-test", needs: [FileKinds], apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({ exts: [".example"], holds: "text", kept: false, fetched: false, noun: "file", article: "a" })
  }) }))
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(3)
  yield* file.dispose
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(4)
  yield* mounted.dispose
  yield* mountPlugin(plugins.host, definePlugin({ name: "later", needs: [], apply: Effect.void }))
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(4)
  // The claim predates the subscription but postdates the published reading.
  yield* mountPlugin(plugins.host, definePlugin({ name: "early", needs: [FileKinds], apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({ exts: [".early"], holds: "text", kept: true, fetched: false, noun: "file", article: "a" })
  }) }))
  yield* mountPlugin(plugins.host, revalidation)
  yield* Effect.sleep("10 millis")
  expect(refreshes).toBe(5)
}))))
