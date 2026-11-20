import { references } from "olai-plugin-outlines/references"
import { nodeTargets } from "./nodes.ts"
import { followLinks } from "./links.ts"
import {Clocks} from "@olai/plugin-api"
import { createGhost } from "@olai/web/client/ghost.ts"
import { protectComposition } from "@olai/web/client/composition.ts"
import { followKeys, KEYS_SETTLING, quiescence } from "@olai/web/client/quiescence.ts"
import { fileAccess } from "olai-plugin-vault/contract"
import { atElement } from "./routes.ts"
import type { FileLink } from "@olai/plugin-api"
import { definePlugin,Faces,Offers } from "@olai/plugin-api"
import { holdPaletteFaces, holdRouteFaces, routeFaces } from "./faces.ts"
import { readings } from "olai-plugin-search/reading"
import { holdReading } from "./palette/reading.ts"
import { holdLocations } from "./locations.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { holdShell } from "./palette/shell.ts"
import { holdClocks } from "./palette/clock.ts"
import { Effect } from "effect"
import { overlays } from "olai-plugin-layout/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createMemo,createRoot,createRenderEffect } from "solid-js"
import { name,navigation,content,pages,type PaletteControl } from "./index.ts"
import { askInPalette,closePalette,dropQuestion,openPalette,openPaletteAt,paletteAsking } from "./palette/state.ts"
import { paletteOpen } from "./palette/state.ts"
import { PageView } from "./PageView.tsx"
import { SelfDrawnPage, selfDrawn } from "./SelfDrawnPage.tsx"
import { followPaletteShortcut } from "./palette/shortcut.ts"
import { scopePaletteState } from "./palette/open-owner.ts"
import { Palette,resetPaletteMemory } from "./palette/Palette.tsx"
import { PaneProvider } from "./pane/context.tsx"
import { atFile,settleRoutePages } from "./routes.ts"
import { holdRoutePages,holdFiles,fileClaims,routing } from "./pages.ts"
import { Link,RouterProvider,useMaybeRouter } from "./routing.tsx"
import { createNavigation } from "./state.ts"
import { guardPageInput } from "./page-input.ts"

const File: FileLink = (props) => <Link route={props.at === undefined || fileClaims() === undefined ? atFile(props.file) : atElement(fileClaims()!, props.file, props.at)} class={props.class}
  testid={props.testid} label={props.label} tip={props.tip}>{props.children}</Link>
export default definePlugin({ name, needs: [Offers], apply: Effect.gen(function*() {
  yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const root = document.documentElement
    const previous = root.getAttribute(KEYS_SETTLING)
    createRenderEffect(() => root.setAttribute(KEYS_SETTLING, String(quiescence.count())))
    return () => {
      dispose()
      if (previous === null) root.removeAttribute(KEYS_SETTLING)
      else root.setAttribute(KEYS_SETTLING, previous)
    }
  })), stop => Effect.sync(stop))
  for(const start of [followKeys, protectComposition]) yield* Effect.acquireRelease(Effect.sync(start),stop=>Effect.sync(stop))
  const ghosts=yield* Effect.acquireRelease(Effect.sync(()=>createGhost(window)),state=>Effect.sync(state.dispose))
  yield* Effect.acquireRelease(Effect.sync(scopePaletteState),stop=>Effect.sync(stop))
  yield* (yield* Offers).own("palette",():PaletteControl=>({
    open:paletteOpen, asking:paletteAsking, show:openPalette, showAt:openPaletteAt, ask:askInPalette, dropQuestion, close:closePalette,
  }))
  yield* Effect.acquireRelease(Effect.sync(resetPaletteMemory),()=>Effect.sync(resetPaletteMemory))
  yield* Effect.acquireRelease(Effect.sync(followPaletteShortcut),stop=>Effect.sync(stop))
  const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot((dispose) => ({
    value: createNavigation(), dispose,
  }))), ({ dispose }) => Effect.sync(dispose))
  yield* Effect.acquireRelease(Effect.sync(() => guardPageInput(state.value)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => followLinks(state.value)), stop => Effect.sync(stop))
  const offers = yield* Offers
  yield* offers.own("state", () => ({...state.value, routes: routing, page: (index: number | (()=>number)) => {
    const router = useMaybeRouter() ?? state.value
    const at = () => typeof index === "function" ? index() : index
    return <RouterProvider router={router}><PaneProvider index={at()} id={router.panes()[at()]?.id}><PageView /></PaneProvider></RouterProvider>
  }}))
  yield* offers.own("links", () => ({ File }))
  yield* offers.own("gestures", () => ({ swallowGhost: ghosts.swallow }))
}) })
export const components = {
 nodes: definePlugin({ name: "nodes", needs: [references], apply: Effect.gen(function*() {
   const nodes = yield* references
   yield* Effect.acquireRelease(Effect.sync(() => nodeTargets.hold(nodes)), stop => Effect.sync(stop))
 }) }),
 matcher:definePlugin({name:"matcher",needs:[readings],apply:Effect.gen(function*(){
  const reading=yield* readings
  yield* Effect.acquireRelease(Effect.sync(()=>holdReading(reading)),stop=>Effect.sync(stop))
 })}),
 renderer:definePlugin({name:"renderer",needs:[Faces,rendererSlots],apply:Effect.gen(function*(){
 yield* holdRouteFaces(yield* Faces)
 const slots=yield* rendererSlots
 yield* slots.contribute(content,{matches:selfDrawn,Page:SelfDrawnPage},{children:[pages]})
 yield* Effect.acquireRelease(Effect.sync(()=>holdLocations(slots.read)),stop=>Effect.sync(stop))
 yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
   const stop=holdRoutePages(createMemo(()=>settleRoutePages(routeFaces("app.route"))))
   return ()=>{dispose();stop()}
 })),stop=>Effect.sync(stop))
})}), files:definePlugin({name:"files",needs:[fileAccess],apply:Effect.gen(function*(){
 const files=yield* fileAccess
 yield* Effect.acquireRelease(Effect.sync(()=>holdFiles(files)),stop=>Effect.sync(stop))
})}), palette:definePlugin({name:"palette",needs:[navigation,rendererSlots,Clocks,Faces,appShell],apply:Effect.gen(function*(){
 yield* holdPaletteFaces(yield* Faces)
 const geometry=yield* appShell
 yield* Effect.acquireRelease(Effect.sync(()=>holdShell(geometry)),stop=>Effect.sync(stop))
 const clock=yield* Clocks
 yield* Effect.acquireRelease(Effect.sync(()=>holdClocks(clock)),stop=>Effect.sync(stop))
 const nav=yield* navigation
 yield* (yield* rendererSlots).contribute(overlays,props=><RouterProvider router={nav}><Palette go={nav.go} toggleDirectory={props.toggleDirectory}/></RouterProvider>)
})}),}
