import {Clocks} from "@olai/plugin-api"
import { followGhosts } from "@olai/web/client/ghost.ts"
import { protectComposition } from "@olai/web/client/composition.ts"
import { followKeys, KEYS_SETTLING, quiescence } from "@olai/web/client/quiescence.ts"
import { fileAccess } from "olai-plugin-vault/contract"
import { holdOpens } from "./opens.tsx"
import { atElement } from "./routes.ts"
/** History and focus activate without layout or renderer. A separate renderer
 * integration owns content registrations; layout withdrawal leaves history and
 * the focused location alive. Each reactivation creates fresh subscriptions. */
import type { FileLink } from "@olai/plugin-api"
import { definePlugin,Faces,Offers } from "@olai/plugin-api"
import { holdFaces, hung } from "./faces.ts"
import { readings } from "olai-plugin-search/reading"
import { holdReading } from "./palette/reading.ts"
import { Effect } from "effect"
import { overlays } from "olai-plugin-layout/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createMemo,createRoot,createRenderEffect } from "solid-js"
import { name,navigation } from "./index.ts"
import { PageView } from "./PageView.tsx"
import { followPaletteShortcut } from "./palette/shortcut.ts"
import { scopePaletteState } from "./palette/open-owner.ts"
import { Palette,resetPaletteMemory } from "./palette/Palette.tsx"
import { PaneProvider } from "./pane/context.tsx"
import { atFile,holdRoutePages,settleRoutePages } from "./routes.ts"
import { Link,RouterProvider } from "./routing.tsx"
import { createNavigation } from "./state.ts"

const File: FileLink = (props) => <Link route={atFile(props.file)} class={props.class}
  testid={props.testid} label={props.label} title={props.title}>{props.children}</Link>
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
  for(const start of [followKeys, protectComposition, followGhosts]) yield* Effect.acquireRelease(Effect.sync(start),stop=>Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(scopePaletteState),stop=>Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(resetPaletteMemory),()=>Effect.sync(resetPaletteMemory))
  yield* Effect.acquireRelease(Effect.sync(followPaletteShortcut),stop=>Effect.sync(stop))
  const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot((dispose) => ({
    value: createNavigation(), dispose,
  }))), ({ dispose }) => Effect.sync(dispose))
  const offers = yield* Offers
  yield* offers.own("state", () => ({...state.value, page: (index: number | (()=>number)) => <RouterProvider router={state.value}><PaneProvider index={typeof index==="function"?index():index}><PageView /></PaneProvider></RouterProvider>}))
  yield* offers.own("links", () => ({ File }))
}) })
/**
 * WHICH URLS THE MOUNTED PLUGINS CLAIM — a COMPONENT, because the row is not
 * allowed to want it.
 *
 * The row's own header is the argument: history and focus activate without a
 * renderer, so naming {@link Faces} on the row would hold navigation itself
 * `waiting` on a tab that draws nothing. What genuinely depends on the renderer
 * is this one reading, and it is the reading that waits — the audit's rule that
 * only the integration using a departed service stops. With no renderer there
 * are no contributed routes to read, which is the same empty answer this
 * settled before.
 */
export const components = {
 /** The matcher, DECLARED — a component of its own so the palette keeps opening
  *  and keeps saying *no matcher* when the row is absent
  *  (`./palette/reading.ts`). */
 search:definePlugin({name:"search",needs:[readings],apply:Effect.gen(function*(){
  const reading=yield* readings
  yield* Effect.acquireRelease(Effect.sync(()=>holdReading(reading)),stop=>Effect.sync(stop))
 })}),
 routes:definePlugin({name:"routes",needs:[Faces],apply:Effect.gen(function*(){
 yield* holdFaces(yield* Faces)
 yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>{
   const stop=holdRoutePages(createMemo(()=>settleRoutePages(hung("app.route"))))
   return ()=>{dispose();stop()}
 })),stop=>Effect.sync(stop))
})}), files:definePlugin({name:"files",needs:[fileAccess,Offers],apply:Effect.gen(function*(){
 const files=yield* fileAccess
 const opens=(path:string,at?:string)=>files.paths().includes(path)?atElement(path,at??null):undefined
 yield* Effect.acquireRelease(Effect.sync(()=>holdOpens(opens)),stop=>Effect.sync(stop))
 yield* (yield* Offers).own("file-links",()=>opens)
})}), palette:definePlugin({name:"palette",needs:[navigation,rendererSlots,Clocks,Faces],apply:Effect.gen(function*(){
 yield* holdFaces(yield* Faces)
 const nav=yield* navigation
 yield* (yield* rendererSlots).contribute(overlays,props=><RouterProvider router={nav}><Palette go={nav.go} toggleDirectory={props.toggleDirectory}/></RouterProvider>)
})}),}
