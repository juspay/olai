import { isLone } from "olai-plugin-navigation/workspace"
/** Shelf commands use the pins activation's history and subscriptions. */
import { definePlugin } from "@olai/plugin-api"
import type { Edit } from "@olai/surface"
import { layoutName,nameOf } from "olai-plugin-navigation/address/address.ts"
import { applying, togglePin } from "./writes.ts"
import { Effect } from "effect"
import { navigation,paletteAdapters,paletteControl } from "olai-plugin-navigation/contract"
import { holdPalette, paletteAsking } from "./box.ts"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { pinnedShelf } from "../contract.ts"
import { usePins } from "./answered.tsx"
import { usePinUndo } from "./history.ts"
import { askName,namingFor } from "./naming.ts"
import { layoutItem,pinItem } from "./palette.ts"
import { pinnedAt,pinnedLayout } from "./pins.ts"
export const paletteIntegration=definePlugin({name:"palette",needs:[navigation,rendererSlots,pinnedShelf,paletteControl],apply:Effect.gen(function*(){
 const nav=yield* navigation
 // THE APP'S URL GRAMMAR, taken off the router this component declared and
 // handed to every pure helper below (`./pins.ts`'s `pinsOf`).
 const routes=nav.routes
 // The box this row asks a name in, held for this activation (`./box.ts`).
 const box=yield* paletteControl
 yield* Effect.acquireRelease(Effect.sync(()=>holdPalette(box)),stop=>Effect.sync(stop))
 const pins=usePins(), undo=usePinUndo()
 const called=()=>nav.focused()?.title??nameOf(routes,nav.route(),undefined)
 const run=async()=>{
  if(paletteAsking()!==null)return {keepOpen:true}
  const already=pinnedAt(routes,pins(),nav.route()), naming=namingFor(routes,nav.route(),already,called())
  if(naming!==null){askName(naming);return {keepOpen:true}}
  return {said:await togglePin(routes.href(nav.route()),already,nav.focused()?.history?.record??undo.record)}
 }
 const panes=()=>layoutName(routes,nav.workspace(),(_route,index)=>nav.info(index)?.title)
 const runLayout=async()=>{
  if(paletteAsking()!==null)return {keepOpen:true}
  const already=pinnedLayout(routes,pins(),nav.workspace())
  if(already!==undefined)return {said:await applying({verb:"trash",id:already.id},nav.focused()?.history?.record??undo.record)}
  askName({kind:"layout",at:routes.layoutHref(nav.workspace()),panes:panes()})
  return {keepOpen:true}
 }
 yield* (yield* rendererSlots).contribute(paletteAdapters,{
  items:()=>[
   {...pinItem(routes,nav.route(),pins(),called()),action:{kind:"run" as const,run}},
   ...isLone(nav.workspace())?[]:[{...layoutItem(pinnedLayout(routes,pins(),nav.workspace())!==undefined,panes()),action:{kind:"run" as const,run:runLayout}}],
  ],
  accepts:request=>typeof request==="object"&&request!==null&&("verb" in request)&&
   (request.verb==="pin"||("pinned" in request&&request.pinned===true)),
  write:request=>applying(request as Edit,nav.focused()?.history?.record??undo.record),
 })
})})
