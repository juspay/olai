/** The browser vault owns one membership/head subscription. Layout and files
 * are independent consumers; withdrawing files cannot dispose a live editor. */
import {definePlugin,Offers} from "@olai/plugin-api"
import {Effect} from "effect"
import {createRoot} from "solid-js"
import {rendererSlots} from "olai-plugin-ui-renderer/contract"
import {contentStatus} from "olai-plugin-layout/contract"
import {createDirectory} from "./browser/directory.ts"
import {holdServed} from "./browser/served.tsx"
import {holdDirectory,directory} from "./browser/state.ts"
import {Status} from "./browser/Status.tsx"
import {fileAccess} from "./contract.ts"
import {olai} from "@olai/web/client/wire.ts"
export default definePlugin({name:"vault",needs:[Offers],apply:Effect.gen(function*(){
 const state=yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const value=createDirectory(olai.collections.heads.use(),olai.cells.manifest.use().value)
  const stops=[holdDirectory(value),holdServed(value)]
  return {value,dispose:()=>{dispose();for(const stop of stops)stop()}}
 })),state=>Effect.sync(state.dispose))
 yield* (yield* Offers).own("files",()=>state.value)
})})
export const components={status:definePlugin({name:"status",needs:[fileAccess,rendererSlots],apply:Effect.gen(function*(){
 yield* (yield* rendererSlots).contribute(contentStatus,{ready:()=>directory()?.standing()==="loaded",Message:Status})
})})}
