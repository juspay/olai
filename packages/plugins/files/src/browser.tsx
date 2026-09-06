import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { registerWriter } from "@olai/edit-history/writing.ts"
import { dispatch } from "./surface.ts"
import { fileAccess } from "olai-plugin-vault/contract"
import { DeleteFile } from "./file/DeleteFile.tsx"
import { clearNewFileMemory,NewFile } from "./file/NewFile.tsx"
/** Directory membership and folder preferences belong to files, independently
 * of sidebar presentation. Content providers register creation controls. */
import { definePlugin,Offers } from "@olai/plugin-api"
import { Effect } from "effect"
import { navigation } from "olai-plugin-navigation/contract"
import { fileNamed } from "olai-plugin-navigation/routes"
import { railEntries,regions } from "olai-plugin-sidebar/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { Files } from "./Files.tsx"
import { FileRail } from "./Rail.tsx"
import { fileState,fileTypes,holdFileControls } from "./contract.ts"
import { followFolders } from "./fold/folders.ts"
export default definePlugin({name:"files", needs:[Wired, Offers, fileAccess], apply:Effect.gen(function*(){
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => registerWriter(dispatch["surface/edit/apply"].cases, edit => (ownWire.client() as Client).procedures.edit.apply(edit))), stop => Effect.sync(stop))

 yield* Effect.acquireRelease(Effect.sync(()=>holdFileControls({Delete:DeleteFile,New:NewFile})),stop=>Effect.sync(()=>{stop();clearNewFileMemory()}))
 yield* Effect.acquireRelease(Effect.sync(followFolders), stop => Effect.sync(stop))
 yield* (yield* Offers).own("state",()=>({Delete:DeleteFile,New:NewFile}))
})})
export const components = { sidebar: definePlugin({name:"sidebar", needs:[fileState,fileAccess, rendererSlots, navigation], apply:Effect.gen(function*(){
 const nav=yield* navigation, slots=yield* rendererSlots
 yield* slots.contribute(railEntries,FileRail)
 yield* slots.contribute(regions,{at:"files" as const,Body:props=><Files {...props} active={fileNamed(nav.route())??nav.focused()?.file} />},{children:[fileTypes]})
})}) }

export { surface } from "./surface.ts"
