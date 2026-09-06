import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { registerWriter } from "@olai/edit-history/writing.ts"
import { dispatch } from "./surface.ts"
import { writeEdit } from "@olai/edit-history/writing.ts"
import { createUndo } from "@olai/edit-history/undoing.ts"
import { definePlugin,Offers } from "@olai/plugin-api"
import { runAsync } from "@olai/web/client/run.ts"
import { client } from "olai-plugin-trash/client"
import { Effect } from "effect"
import { content,navigation } from "olai-plugin-navigation/contract"
import { browserState } from "olai-plugin-outlines/contract"
import { vaultEntries } from "olai-plugin-sidebar/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createRoot } from "solid-js"
import { holdTrashUndo } from "./browser/history.ts"
import { TrashPageView } from "./browser/PageView.tsx"
import { trashState } from "./contract.ts"
import { Trash } from "./Entry.tsx"
export default definePlugin({name:"trash", needs:[Wired, Offers], apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => registerWriter(dispatch["surface/edit/apply"].cases, edit => (ownWire.client() as Client).procedures.edit.apply(edit))), stop => Effect.sync(stop))

 yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const stop=holdTrashUndo(createUndo(edit=>runAsync(writeEdit(edit))))
  return ()=>{dispose();stop()}
 })),stop=>Effect.sync(stop))
 yield* (yield* Offers).own("state",()=>({}))
})})
export const components={content:definePlugin({name:"content",needs:[navigation,rendererSlots,browserState,trashState],apply:Effect.gen(function*(){
 yield* (yield* rendererSlots).contribute(content,{matches:route=>route.kind==="trash",Page:TrashPageView})
})}),sidebar:definePlugin({name:"sidebar", needs:[rendererSlots,navigation,trashState], apply:Effect.gen(function*(){
 yield* (yield* rendererSlots).contribute(vaultEntries, Trash)
})})}

export { surface } from "./surface.ts"
