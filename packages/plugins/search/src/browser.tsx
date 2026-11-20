import { holdServed, servedDirectory } from "./browser/vault.ts"
import { fileAccess } from "olai-plugin-vault/contract"
import { createRoot, createSignal } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { boxBelow, searchKind, type Kind } from "./contracts/box.ts"
import { holdFaces } from "./browser/faces.ts"
import { KindSelector, cycleKind } from "./browser/KindSelector.tsx"
import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import type { BarSeat } from "olai-plugin-layout/slots"
import type { Hung } from "@olai/plugin-api"
import { definePlugin, Offers, Slots, Faces, slotLocation } from "@olai/plugin-api"
import { Effect } from "effect"

import { HeaderSearch } from "./browser/HeaderSearch.tsx"
import { createSearch } from "./browser/kit/nodes.ts"
import { holdReading } from "./browser/reading.ts"
import { holdPalette } from "./browser/palette.ts"
import { Clocks } from "@olai/plugin-api"
import { holdClocks } from "./browser/clock.ts"
import { paletteControl } from "olai-plugin-navigation/contract"
import type { SearchProvider } from "./contracts/reading.ts"
import { name } from "./index.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Wired, rendererSlots, Faces, Offers],
  apply: Effect.gen(function*() {
    const ownWire = yield* Wired
    yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))

    const slots = yield* rendererSlots
    yield* holdFaces(yield* Faces)
    const reading: SearchProvider = (...args: Parameters<SearchProvider>) => createSearch(...args)
    yield* Effect.acquireRelease(Effect.sync(() => holdReading(reading)), stop => Effect.sync(stop))
    yield* (yield* Offers).own("readings", () => reading)
    yield* slots.contribute<Hung<BarSeat>>(slotLocation("app.header"), { plugin: name, face: { place: "lead" as const, body: () => <HeaderSearch claims={servedDirectory()?.claims()} /> } }, { children: [boxBelow] })
  }),
})

export const components = {
  files: definePlugin({ name: "files", needs: [fileAccess], apply: Effect.gen(function*() {
    const files = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(files)), stop => Effect.sync(stop))
  }) }),
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
  clock: definePlugin({ name: "clock", needs: [Clocks], apply: Effect.gen(function*() {
    const clock = yield* Clocks
    yield* Effect.acquireRelease(Effect.sync(() => holdClocks(clock)), stop => Effect.sync(stop))
  }) }),
  palette: definePlugin({ name: "palette", needs: [paletteControl], apply: Effect.gen(function*() {
    const box = yield* paletteControl
    yield* Effect.acquireRelease(Effect.sync(() => holdPalette(box)), stop => Effect.sync(stop))
  }) }),
}

export { surface } from "./surface.ts"
