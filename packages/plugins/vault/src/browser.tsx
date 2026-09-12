import { DocumentPath } from "@olai/format"
import type { Directory } from "./browser/state.ts"
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
import {Status} from "./browser/Status.tsx"
import {fileAccess} from "./contract.ts"
import { client } from "./client.ts"
export default definePlugin({name:"vault",needs:[Wired, Offers],apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))

 const state=yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const directory=createDirectory(client().collections.heads.use(),client().cells.manifest.use().value,client().cells["file-kinds"].use().value)
  const value: Directory = {
    ...directory,
    body: path => client().procedures.bodies.get({ path: DocumentPath.make(path) }),
    outlineDiff: (path, oldText, newText) => client().procedures.files.outlineDiff({path: DocumentPath.make(path), oldText, newText}),
  }
  return {value,dispose}
 })),state=>Effect.sync(state.dispose))
 yield* (yield* Offers).own("files",()=>state.value)
})})
export const components={status:definePlugin({name:"status",needs:[fileAccess,rendererSlots],apply:Effect.gen(function*(){
 // The reading is the SERVICE this component named, rather than a module
 // signal this row's other activation happened to have set
 // (`./browser/state.ts`).
 const served=yield* fileAccess
 yield* (yield* rendererSlots).contribute(contentStatus,{ready:()=>served.standing()==="loaded",Message:()=><Status served={served}/>})
})})}

export { surface } from "./file-surface.ts"
