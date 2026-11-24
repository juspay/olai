/** The search provider owns live query subscriptions as well as its header
 * door. Other features consume its scoped reading location; they retain their
 * own editing and navigation when the provider is absent. */
import { fileAccess } from "olai-plugin-vault/contract"
import { createRoot, createSignal } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { boxBelow, searchKind, type Kind } from "./contracts/box.ts"
import { KindSelector, cycleKind } from "./browser/KindSelector.tsx"
import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import type { BarSeat } from "olai-plugin-layout/slots"
import type { Hung } from "@olai/plugin-api"
import { definePlugin, Offers, Slots, slotLocation } from "@olai/plugin-api"
import { Effect } from "effect"

import { HeaderSearch } from "./browser/HeaderSearch.tsx"
import { createSearch } from "./browser/kit/nodes.ts"
import { holdPalette } from "./browser/palette.ts"
import { paletteControl } from "olai-plugin-navigation/contract"
import type { SearchProvider } from "./contracts/reading.ts"
import { name } from "./index.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Wired, rendererSlots, Offers],
  apply: Effect.gen(function*() {
    const ownWire = yield* Wired
    yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))

    const slots = yield* rendererSlots
    // A new callable identity for each activation makes replacement observable
    // even when a browser sees off/on registry events in the same batch.
    const reading: SearchProvider = (...args: Parameters<SearchProvider>) => createSearch(...args)
    yield* (yield* Offers).own("readings", () => reading)
    // THE HEADER'S DOOR, a button that opens the palette. It still declares
    // `search.box.below` under it: the palette draws what hangs there (the
    // kind selector), and that location's lifetime is this face's.
    yield* slots.contribute<Hung<BarSeat>>(slotLocation("app.header"), { plugin: name, face: { place: "lead" as const, body: () => <HeaderSearch /> } }, { children: [boxBelow] })
  }),
})

/** The ⌘K palette this row's door opens, DECLARED — a component of its own so
 *  the row keeps answering with no navigation row mounted, and the press that
 *  would open a palette that is not there simply does nothing
 *  (`./browser/palette.ts`). */
export const components = {
  kind: definePlugin({ name: "kind", needs: [Offers], apply: Effect.gen(function*() {
    const owned = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const [pick, set] = createSignal<Kind>(undefined)
      return { pick, set, dispose }
    })), owned => Effect.sync(owned.dispose))
    yield* (yield* Offers).own("kind", () => ({ pick: owned.pick, set: owned.set }))
  }) }),
  selector: definePlugin({ name: "selector", needs: [searchKind, Slots, fileAccess], apply: Effect.gen(function*() {
    const state = yield* searchKind
    const files = yield* fileAccess
    yield* (yield* Slots).register("search.box.below", {
      pick: state.pick, cycle: () => cycleKind(files.claims(), state),
      body: props => <KindSelector claims={files.claims} state={state} search={props.search} />,
    })
  }) }),
  palette: definePlugin({ name: "palette", needs: [paletteControl], apply: Effect.gen(function*() {
    const box = yield* paletteControl
    yield* Effect.acquireRelease(Effect.sync(() => holdPalette(box)), stop => Effect.sync(stop))
  }) }),
}

export { surface } from "./surface.ts"
