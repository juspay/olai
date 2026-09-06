import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import type {} from "olai-plugin-layout/slots"
/** The search provider owns live query subscriptions as well as its header.
 * Other features consume its scoped reading location; they retain their own
 * editing and navigation when the provider is absent. */
import { definePlugin, Offers, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

import { HeaderSearch } from "./browser/HeaderSearch.tsx"
import { createSearch } from "./browser/kit/nodes.ts"
import { name } from "./index.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Wired, Slots, Offers],
  apply: Effect.gen(function*() {
    const ownWire = yield* Wired
    yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))

    const slots = yield* Slots
    // A new callable identity for each activation makes replacement observable
    // even when a browser sees off/on registry events in the same batch.
    const reading: typeof createSearch = (...args: Parameters<typeof createSearch>) => createSearch(...args)
    yield* (yield* Offers).own("readings", () => reading)
    yield* slots.register("app.header", { place: "lead", body: HeaderSearch })
  }),
})

export { surface } from "./surface.ts"
