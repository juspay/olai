import { fileAccess } from "olai-plugin-vault/contract"
import { Edits, Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { dispatch } from "./surface.ts"
import { holdEdits, writeEdit } from "./browser/writes.ts"
import { createUndo } from "@olai/edit-history/undoing.ts"
import { definePlugin,Offers } from "@olai/plugin-api"
import { holdLocations } from "./browser/locations.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { client } from "./client.ts"
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
export default definePlugin({name:"trash", needs:[Wired, Offers, Edits], apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  // WHICH VERBS THIS ROW WRITES, on the app's own table — declared through
  // `Edits` rather than pushed into a module-scope map in a general package
  // (`@olai/plugin-api`'s `Edits` carries the whole of why). The hold
  // beside it is how this row's faces spend the same table (`./browser/writes.ts`).
  const edits = yield* Edits
  yield* edits.register(dispatch["edit.apply"], edit => (ownWire.client() as Client).procedures.edit.apply(edit))
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
 // The page view and the titles this page draws are other rows' contributions
 // (`./browser/locations.ts`).
 yield* Effect.acquireRelease(Effect.sync(()=>holdLocations(slots.read)),stop=>Effect.sync(stop))
 yield* slots.contribute(content,{matches:route=>route.kind==="trash",Page:()=> <TrashPageView files={files} />})
})}),sidebar:definePlugin({name:"sidebar", needs:[rendererSlots,navigation,trashState], apply:Effect.gen(function*(){
 yield* (yield* rendererSlots).contribute(vaultEntries, Trash)
})})}

export { surface } from "./surface.ts"
