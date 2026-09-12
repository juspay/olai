import { holdKindDrawings } from "./glyphs.tsx"
import { Edits, Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { dispatch } from "./surface.ts"
import { holdEdits } from "./writes.ts"
import { fileAccess } from "olai-plugin-vault/contract"
import { holdServed } from "./vault.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { holdShell } from "./shell.ts"
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
import { fileState,fileTypes,fileKinds } from "./contract.ts"
import { followFolders } from "./fold/folders.ts"
export default definePlugin({name:"files", needs:[Wired, Offers, Edits, fileAccess], apply:Effect.gen(function*(){
 // The served directory the tree is drawn from, held for this activation
 // (`./vault.ts`).
 const served = yield* fileAccess
 yield* Effect.acquireRelease(Effect.sync(()=>holdServed(served)),stop=>Effect.sync(stop))
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  // WHICH VERBS THIS ROW WRITES, on the app's own table — declared through
  // `Edits` rather than pushed into a module-scope map in a general package
  // (`@olai/plugin-api`'s `Edits` carries the whole of why). The hold
  // beside it is how this row's faces spend the same table (`./writes.ts`).
  const edits = yield* Edits
  yield* edits.register(dispatch["edit.apply"], edit => (ownWire.client() as Client).procedures.edit.apply(edit))
  yield* Effect.acquireRelease(Effect.sync(() => holdEdits(edits)), stop => Effect.sync(stop))

 // The minting box keeps a draft per activation; the CONTROLS themselves
 // travel on `files.state` below rather than in a signal on a declared door.
 yield* Effect.acquireRelease(Effect.void,()=>Effect.sync(clearNewFileMemory))
 yield* Effect.acquireRelease(Effect.sync(followFolders), stop => Effect.sync(stop))
 yield* (yield* Offers).own("state",()=>({Delete:DeleteFile,New:NewFile}))
})})
export const components = {
 /** The shell's geometry, DECLARED — a component of its own because content
  *  runs under another layout entirely (`./shell.ts`). */
 shell: definePlugin({name:"shell", needs:[appShell], apply:Effect.gen(function*(){
  const geometry=yield* appShell
  yield* Effect.acquireRelease(Effect.sync(()=>holdShell(geometry)),stop=>Effect.sync(stop))
 })}),
 sidebar: definePlugin({name:"sidebar", needs:[fileState,fileAccess, rendererSlots, navigation], apply:Effect.gen(function*(){
 const nav=yield* navigation, slots=yield* rendererSlots
 yield* Effect.acquireRelease(Effect.sync(()=>holdKindDrawings(slots.read)),stop=>Effect.sync(stop))
 yield* slots.contribute(railEntries,FileRail)
 yield* slots.contribute(regions,{at:"files" as const,Body:props=><Files {...props} active={fileNamed(nav.route())??nav.focused()?.file} />},{children:[fileTypes,fileKinds]})
})}) }

export { surface } from "./surface.ts"
