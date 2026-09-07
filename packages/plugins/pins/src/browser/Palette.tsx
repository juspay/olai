/** Shelf commands use the pins activation's history and subscriptions. */
import { definePlugin } from "@olai/plugin-api"
import type { Edit } from "@olai/surface"
import { nameOf } from "olai-plugin-navigation/address/address.ts"
import { applying } from "@olai/web/client/writes.ts"
import { Effect } from "effect"
import { navigation,paletteAdapters,paletteControl } from "olai-plugin-navigation/contract"
import { holdPalette, paletteAsking } from "./box.ts"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { pinsState } from "../contract.ts"
import { usePins } from "./answered.tsx"
import { usePinUndo } from "./history.ts"
import { askName,namingFor } from "./naming.ts"
import { pinItem } from "./palette.ts"
import { sayPin,togglePin } from "./pinning.ts"
import { pinnedAt } from "./pins.ts"
export const paletteIntegration=definePlugin({name:"palette",needs:[navigation,rendererSlots,pinsState,paletteControl],apply:Effect.gen(function*(){
 const nav=yield* navigation
 // The box this row asks a name in, held for this activation (`./box.ts`).
 const box=yield* paletteControl
 yield* Effect.acquireRelease(Effect.sync(()=>holdPalette(box)),stop=>Effect.sync(stop))
 const pins=usePins(), undo=usePinUndo()
 const called=()=>nav.focused()?.title??nameOf(nav.route(),undefined)
 const run=async()=>{
  if(paletteAsking()!==null)return {keepOpen:true}
  const already=pinnedAt(pins(),nav.route()), naming=namingFor(nav.route(),already,called())
  if(naming!==null){askName(naming);return {keepOpen:true}}
  return {said:await togglePin(nav.route(),already,nav.focused()?.history?.record??undo.record)}
 }
 yield* (yield* rendererSlots).contribute(paletteAdapters,{
  items:()=>[{...pinItem(nav.route(),pins(),called()),action:{kind:"run" as const,run}}],
  accepts:request=>typeof request==="object"&&request!==null&&("verb" in request)&&
   (request.verb==="pin"||("pinned" in request&&request.pinned===true)),
  write:request=>applying(request as Edit,nav.focused()?.history?.record??undo.record),
  key:action=>{if(action==="pin")void run().then(result=>sayPin(result.said))},
 })
})})
