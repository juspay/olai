/** Mount the real component with no navigation provider. Its declaration must
 * remain alive even when the location's owning Files container withdraws. */
import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { openTestPlugins } from "@olai/plugin-api/testlib"
import { locations, location, mountPlugin, rowReport } from "@olai/plugin-api"
import { provide, settled } from "@olai/effect-cordis"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { fileKinds } from "olai-plugin-files/contract"
import { glyphComponent } from "olai-plugin-pdf/testlib"
test("the PDF glyph component stays mounted without navigation and reconnects its waiting contribution", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const plugins = yield* openTestPlugins({ vars: {}, now: () => "", served: "/" })
  const slots = yield* locations()
  yield* provide(plugins.host, rendererSlots, owner => ({ ...slots.forOwner(owner), read: slots.read, inspect: slots.inspect }))
  yield* mountPlugin(plugins.host, { ...glyphComponent(() => null), name: "pdf-glyph" })
  yield* settled(plugins.host, ["pdf-glyph"])
  expect((yield* rowReport(plugins.host, ["pdf-glyph"])).get("pdf-glyph")?.state).toBe("running")
  expect(slots.read(fileKinds)).toEqual([])
  const container = yield* Scope.make()
  yield* Scope.provide(slots.forOwner("files").contribute(location("root", "one"), null, { children: [fileKinds] }), container)
  yield* slots.settled
  const contribution = slots.read(fileKinds)[0]?.value
  expect(contribution?.by).toEqual({ kind: "pdf" })
  yield* Scope.close(container, Exit.void)
  yield* slots.settled
  expect(slots.read(fileKinds)).toEqual([])
  expect((yield* rowReport(plugins.host, ["pdf-glyph"])).get("pdf-glyph")?.state).toBe("running")
  yield* slots.forOwner("files").contribute(location("root", "one"), null, { children: [fileKinds] })
  yield* slots.settled
  expect(slots.read(fileKinds)[0]?.value).toBe(contribution)
}))))
