import { fileAccess } from "olai-plugin-vault/contract"
import { Edits, Wired, editApply } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { dispatch } from "./surface.ts"
import { holdEdits, writeEdit } from "./browser/writes.ts"
import { createUndo } from "@olai/edit-history/undoing.ts"
import { definePlugin,Offers,Slots } from "@olai/plugin-api"
import { holdLocations } from "./browser/locations.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { client } from "./client.ts"
import { Effect } from "effect"
import { content,navigation } from "olai-plugin-navigation/contract"
import { browserState } from "olai-plugin-outlines/contract"
import type {} from "olai-plugin-sidebar/slots"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createRoot } from "solid-js"
import { holdTrashUndo } from "./browser/history.ts"
import { TrashPageView } from "./browser/PageView.tsx"
import { trashState } from "./contract.ts"
import { Trash, TrashRail } from "./Entry.tsx"
export default definePlugin({name:"trash", needs:[Wired, Offers, Edits], apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  const edits = yield* Edits
  yield* edits.register(dispatch["edit.apply"], edit => editApply(ownWire.client() as Client, edit))
  yield* Effect.acquireRelease(Effect.sync(() => holdEdits(edits)), stop => Effect.sync(stop))

 yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
  const stop=holdTrashUndo(createUndo(edit=>runAsync(writeEdit(edit))))
  return ()=>{dispose();stop()}
 })),stop=>Effect.sync(stop))
 yield* (yield* Offers).own("state",()=>({}))
})})
export const components={content:definePlugin({name:"content",needs:[navigation,rendererSlots,browserState,trashState,fileAccess],apply:Effect.gen(function*(){
 const files=yield* fileAccess
 const slots=yield* rendererSlots
 yield* Effect.acquireRelease(Effect.sync(()=>holdLocations(slots.read)),stop=>Effect.sync(stop))
 yield* slots.contribute(content,{matches:route=>route.kind==="trash",Page:()=> <TrashPageView files={files} />})
})}),
 sidebar:definePlugin({name:"sidebar", needs:[Slots,navigation,trashState], apply:Effect.gen(function*(){
 yield* (yield* Slots).register("sidebar.entry", { place: "foot", body: Trash, rail: TrashRail })
})})}

export { surface } from "./surface.ts"
