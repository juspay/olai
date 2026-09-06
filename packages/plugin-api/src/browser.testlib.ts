/** Browser API fixture with a real renderer-owned registry but no DOM. The
 * notebook catalog is declared by the fixture shell, never by openApp. */
import type { Locations } from "@olai/effect-cordis"
import { Effect } from "effect"
import { definePlugin, locations, location, mountPlugin, Offers, slotFacade, slotLocation, type App } from "./browser.ts"
import { TEST_SLOTS } from "./slots.testlib.ts"

export const installTestRenderer = (app: App, changed?: () => void, reading?: () => void) => Effect.gen(function*() {
  let store!: Locations
  yield* mountPlugin(app.host, definePlugin({
    name: "ui-renderer", needs: [Offers], apply: Effect.gen(function*() {
      store = yield* locations({ changed })
      const facade = slotFacade(store, reading)
      const offers = yield* Offers
      yield* offers.own("legacy-slots", facade.forOwner)
      yield* offers.own("faces", () => facade.faces)
      yield* offers.own("integrations", () => facade.management)
    }),
  }))
  yield* store.forOwner("test-shell").contribute(location("root", "one"), null, {
    children: TEST_SLOTS,
  })
  yield* store.settled
  return store
})
