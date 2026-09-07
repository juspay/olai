import { Edits, Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { dispatch } from "./surface.ts"
import { holdEdits, writeEdit } from "./browser/writes.ts"
import { createUndo } from "@olai/edit-history/undoing.ts"
import { definePlugin,Offers } from "@olai/plugin-api"
import { NO_PINS } from "@olai/format"
import { Shelf } from "olai-plugin-pins/browser/Shelf.tsx"
import { runAsync } from "@olai/web/client/run.ts"
import { client } from "./client.ts"
import { Effect } from "effect"
import { regions } from "olai-plugin-sidebar/contract"
import { navigation } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createRoot } from "solid-js"
import { holdPins, usePins } from "./browser/answered.tsx"
import { holdPinUndo, usePinUndo } from "./browser/history.ts"
import { paletteIntegration } from "./browser/Palette.tsx"
import { scopePinSaid } from "./browser/pinning.ts"
import { pinnedShelf } from "./contract.ts"
export default definePlugin({name:"pins", needs:[Wired, Offers, Edits], apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  // WHICH VERBS THIS ROW WRITES, on the app's own table — declared through
  // `Edits` rather than pushed into a module-scope map in a general package
  // (`@olai/edit-history`'s `writing.ts` carries the whole of why). The hold
  // beside it is how this row's faces spend the same table (`./browser/writes.ts`).
  const edits = yield* Edits
  yield* edits.register(dispatch["edit.apply"], edit => (ownWire.client() as Client).procedures.edit.apply(edit))
  yield* Effect.acquireRelease(Effect.sync(() => holdEdits(edits)), stop => Effect.sync(stop))

 yield* Effect.acquireRelease(Effect.sync(scopePinSaid),stop=>Effect.sync(stop))
 yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const cell=client().cells.pins.use(); const stop=holdPins(()=>cell.value()??NO_PINS)
  const stopHistory=holdPinUndo(createUndo(edit=>runAsync(writeEdit(edit))))
  return ()=>{dispose();stop();stopHistory()}
 })),stop=>Effect.sync(stop))
 // THE SHELF, on the service that names it — rather than a signal in a
 // declared door the outline read across the wall (`./contract.ts`).
 yield* (yield* Offers).own("state",()=>({ shelf: usePins() }))
})})
export const components={palette:paletteIntegration,sidebar:definePlugin({name:"sidebar", needs:[rendererSlots,pinnedShelf,navigation], apply:Effect.gen(function*(){
 const nav = yield* navigation
 const undo = usePinUndo()
 yield* (yield* rendererSlots).contribute(regions, {at:"shelf" as const, Body: () => <Shelf record={nav.focused()?.history?.record ?? undo.record} />})
})})}

export { surface } from "./surface.ts"
