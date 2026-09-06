import { createUndo } from "@olai/edit-history/undoing.ts"
import { definePlugin,Offers } from "@olai/plugin-api"
import { NO_PINS } from "@olai/surface"
import { Shelf } from "olai-plugin-pins/browser/Shelf.tsx"
import { runAsync } from "@olai/web/client/run.ts"
import { olai } from "@olai/web/client/wire.ts"
import { Effect } from "effect"
import { regions } from "olai-plugin-sidebar/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createRoot } from "solid-js"
import { holdPins } from "./browser/answered.tsx"
import { holdPinUndo } from "./browser/history.ts"
import { paletteIntegration } from "./browser/Palette.tsx"
import { scopePinSaid } from "./browser/pinning.ts"
import { pinsState } from "./contract.ts"
export default definePlugin({name:"pins", needs:[Offers], apply:Effect.gen(function*(){
 yield* Effect.acquireRelease(Effect.sync(scopePinSaid),stop=>Effect.sync(stop))
 yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const cell=olai.cells.pins.use(); const stop=holdPins(()=>cell.value()??NO_PINS)
  const stopHistory=holdPinUndo(createUndo(edit=>runAsync(olai.procedures.edit.apply(edit))))
  return ()=>{dispose();stop();stopHistory()}
 })),stop=>Effect.sync(stop))
 yield* (yield* Offers).own("state",()=>({}))
})})
export const components={palette:paletteIntegration,sidebar:definePlugin({name:"sidebar", needs:[rendererSlots,pinsState], apply:Effect.gen(function*(){
 yield* (yield* rendererSlots).contribute(regions, {at:"shelf" as const, Body: Shelf})
})})}
