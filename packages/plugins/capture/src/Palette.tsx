import { TESTID } from "olai-plugin-capture/testids"
import { definePlugin } from "@olai/plugin-api"
import { atOnce } from "@olai/web/client/settled.ts"

import { applied } from "@olai/web/client/writes.ts"
import { Effect,Result } from "effect"
import { navigation,paletteAdapters } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
export const capturePalette=definePlugin({name:"palette",needs:[rendererSlots,navigation],apply:Effect.gen(function*(){
 const nav=yield* navigation
 yield* (yield* rendererSlots).contribute(paletteAdapters,{
  items:()=>[{id:"capture",label:"Capture to the Inbox",hint:"+ a line",action:{kind:"prefix" as const,prefix:"+ "},taking:atOnce,search:"capture inbox add quick note new node jot"}],
  prefix:{value:"+",testid:TESTID.paletteCapture,label:"capture to the Inbox",empty:"type a line after + to capture it to the Inbox",after:"+ ",run:async text=>{
   const outcome=await applied({verb:"capture",title:text},nav.focused()?.history?.record??(()=>{}))
   return Result.isFailure(outcome)?{tone:"alarm" as const,text:outcome.failure.message}:{tone:"aside" as const,text:outcome.success.nudge??`captured “${outcome.success.title}” to ${outcome.success.file}`}
  }},
 })
})})
