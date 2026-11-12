import { expect, test } from "bun:test"
import { Effect } from "effect"
import { definePlugin, Directory, FileKinds, Kinds, Offers, mountPlugin, openPlugins } from "@olai/plugin-api/services"
import { openViews } from "./views.ts"
import { revalidation } from "./setup.ts"

/** How long a refresh that IS coming is waited for. Generous because the only
 *  thing it buys is tolerance of a loaded machine: a refresh that arrives in a
 *  microtask returns on the first look, and one that never arrives fails at
 *  the deadline with the count it stopped at. */
const ARRIVES = 2_000

/** ... and how long a refresh that must NOT come is given to turn up. A quiet
 *  period is the only way to assert an absence, so this one is a real wait. */
const QUIET = "10 millis"

test("vault revalidates changed kinds without reacting to unrelated rows", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openPlugins({ vars: {}, now: () => "2026-09-05T00:00:00Z" })
  let refreshes = 0
  const views = openViews()
  let readingClaims = views.fileKinds.current()
  // WAITED FOR RATHER THAN SLEPT THROUGH: a mount publishes through a
  // subscription, and how long that takes is the scheduler's business. A fixed
  // sleep makes the assertion a bet on a quiet machine, which is a test that
  // fails under load and says nothing when it does.
  const reached = (want: number) =>
    Effect.gen(function*() {
      const until = Date.now() + ARRIVES
      while (refreshes < want && Date.now() < until) yield* Effect.sleep("1 millis")
      expect(refreshes).toBe(want)
    })
  /** ... and the other claim: no refresh at all, which only a quiet period can
   *  say. */
  const stayed = (want: number) =>
    Effect.gen(function*() {
      yield* Effect.sleep(QUIET)
      expect(refreshes).toBe(want)
    })
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
  yield* stayed(0)
  const noise = yield* mountPlugin(plugins.host, definePlugin({ name: "noise", needs: [], apply: Effect.void }))
  yield* stayed(0)
  const kind = yield* mountPlugin(plugins.host, definePlugin({ name: "example", needs: [Kinds], apply: Effect.gen(function*() {
    yield* (yield* Kinds).register({ kind: "test", takes: "text", admits: () => true })
  }) }))
  yield* reached(1)
  yield* kind.dispose
  yield* reached(2)
  yield* noise.dispose
  yield* stayed(2)
  const file = yield* mountPlugin(plugins.host, definePlugin({ name: "file-test", needs: [FileKinds], apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({ exts: [".example"], holds: "text", kept: false, fetched: false, noun: "file", article: "a" })
  }) }))
  yield* reached(3)
  yield* file.dispose
  yield* reached(4)
  yield* mounted.dispose
  yield* mountPlugin(plugins.host, definePlugin({ name: "later", needs: [], apply: Effect.void }))
  yield* stayed(4)
  // The claim predates the subscription but postdates the published reading.
  yield* mountPlugin(plugins.host, definePlugin({ name: "early", needs: [FileKinds], apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({ exts: [".early"], holds: "text", kept: true, fetched: false, noun: "file", article: "a" })
  }) }))
  yield* mountPlugin(plugins.host, revalidation)
  yield* reached(5)
}))))
