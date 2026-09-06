import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { registerWriter } from "@olai/edit-history/writing.ts"
import { dispatch } from "./surface.ts"
import { writeEdit } from "@olai/edit-history/writing.ts"
import { createUndo } from "@olai/edit-history/undoing.ts"
import { definePlugin,Offers } from "@olai/plugin-api"
import { NO_PINS } from "@olai/format"
import { Shelf } from "olai-plugin-pins/browser/Shelf.tsx"
import { runAsync } from "@olai/web/client/run.ts"
import { client } from "olai-plugin-pins/client"
import { Effect } from "effect"
import { regions } from "olai-plugin-sidebar/contract"
import { navigation } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createRoot } from "solid-js"
import { holdPins } from "./browser/answered.tsx"
import { holdPinUndo, usePinUndo } from "./browser/history.ts"
import { paletteIntegration } from "./browser/Palette.tsx"
import { scopePinSaid } from "./browser/pinning.ts"
import { pinsState } from "./contract.ts"
export default definePlugin({name:"pins", needs:[Wired, Offers], apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => registerWriter(dispatch["edit.apply"].cases, edit => (ownWire.client() as Client).procedures.edit.apply(edit))), stop => Effect.sync(stop))

 yield* Effect.acquireRelease(Effect.sync(scopePinSaid),stop=>Effect.sync(stop))
 yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const cell=client().cells.pins.use(); const stop=holdPins(()=>cell.value()??NO_PINS)
  const stopHistory=holdPinUndo(createUndo(edit=>runAsync(writeEdit(edit))))
  return ()=>{dispose();stop();stopHistory()}
 })),stop=>Effect.sync(stop))
 yield* (yield* Offers).own("state",()=>({}))
})})
export const components={palette:paletteIntegration,sidebar:definePlugin({name:"sidebar", needs:[rendererSlots,pinsState,navigation], apply:Effect.gen(function*(){
 const nav = yield* navigation
 const undo = usePinUndo()
 yield* (yield* rendererSlots).contribute(regions, {at:"shelf" as const, Body: () => <Shelf record={nav.focused()?.history?.record ?? undo.record} />})
})})}

export { surface } from "./surface.ts"
