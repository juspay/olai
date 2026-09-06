import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
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
import { client } from "olai-plugin-vault/client"
export default definePlugin({name:"vault",needs:[Wired, Offers],apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))

 const state=yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const value=createDirectory(client().collections.heads.use(),client().cells.manifest.use().value)
  const stops=[holdDirectory(value),holdServed(value)]
  return {value,dispose:()=>{dispose();for(const stop of stops)stop()}}
 })),state=>Effect.sync(state.dispose))
 yield* (yield* Offers).own("files",()=>state.value)
})})
export const components={status:definePlugin({name:"status",needs:[fileAccess,rendererSlots],apply:Effect.gen(function*(){
 yield* (yield* rendererSlots).contribute(contentStatus,{ready:()=>directory()?.standing()==="loaded",Message:Status})
})})}

export { surface } from "./file-surface.ts"
