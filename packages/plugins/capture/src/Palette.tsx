import { definePlugin } from "@olai/plugin-api"
import { applied } from "@olai/web/client/writes.ts"
import { Effect,Result } from "effect"
import { navigation,paletteAdapters } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
export const capturePalette=definePlugin({name:"palette",needs:[rendererSlots,navigation],apply:Effect.gen(function*(){
 const nav=yield* navigation
 yield* (yield* rendererSlots).contribute(paletteAdapters,{
  prefix:{value:"+",label:"capture to the Inbox",empty:"type a line after + to capture it to the Inbox",after:"+ ",run:async text=>{
   const outcome=await applied({verb:"capture",title:text},nav.focused()?.history?.record??(()=>{}))
   return Result.isFailure(outcome)?{tone:"alarm" as const,text:outcome.failure.message}:{tone:"aside" as const,text:outcome.success.nudge??`captured “${outcome.success.title}” to ${outcome.success.file}`}
  }},
 })
})})
