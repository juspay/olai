import { slotContracts as navigationSlots } from "olai-plugin-navigation/slots"
import { slotContracts } from "./slots.ts"
import { definePlugin,Faces,Offers } from "@olai/plugin-api"
import { holdFaces } from "./faces.ts"
import { holdRouting } from "./routing.ts"
import { Fault } from "./Fault.tsx"
import { publishLayoutCss } from "olai-plugin-layout/layout/css.ts"
import { trackVisibleViewport } from "olai-plugin-layout/viewport.ts"
import { Effect } from "effect"
import { content,navigation,paletteAdapters } from "olai-plugin-navigation/contract"
import { rendererSlots,root } from "olai-plugin-ui-renderer/contract"
import { createRoot,ErrorBoundary } from "solid-js"
import Frame from "./Frame.tsx"
import { contentStatus,name,overlays,type Shell,sidebar,strip,thumbs,tools } from "./index.ts"
import { trackDesktop } from "./layout/media-owner.ts"
import {
  createLayoutState, holdLayoutState, desktop, resetSidebarWidth,
  revealSidebar, setSidebarOpen, setSidebarWidth, sidebarOpen, sidebarWidth, toggleSidebar,
} from "./layout/live.ts"
import { followLayout } from "./layout/prefs-owner.ts"

export default definePlugin({
  name,
  needs: [rendererSlots, Offers, navigation, Faces],
  apply: Effect.gen(function*() {
    yield* Effect.acquireRelease(Effect.sync(() => holdLayoutState(createLayoutState())), stop => Effect.sync(stop))
    yield* holdFaces(yield* Faces)
    const slots = yield* rendererSlots
    const router = yield* navigation
    yield* Effect.acquireRelease(Effect.sync(() => holdRouting(router.routes)), stop => Effect.sync(stop))
    yield* (yield* Offers).own("bar", () => bar)
    yield* (yield* Offers).own("shell", (): Shell => ({
      desktop, sidebarOpen, setSidebarOpen, toggleSidebar, revealSidebar, sidebarWidth, setSidebarWidth,
      resetSidebarWidth,
    }))
    yield* slots.contribute(root, () => <ErrorBoundary fallback={(error) => {
      console.error(error)
      return <Fault text={String(error)} />
    }}><Frame slots={slots} router={router} /></ErrorBoundary>, {
      children: [sidebar, tools, contentStatus, overlays, strip, thumbs, content, paletteAdapters, ...Object.values(slotContracts), ...Object.values(navigationSlots)],
      activate: Effect.gen(function*() {
        for (const start of [trackVisibleViewport, trackDesktop, followLayout]) {
          yield* Effect.acquireRelease(Effect.sync(start), (stop) => Effect.sync(stop))
        }
        yield* Effect.acquireRelease(Effect.sync(() => createRoot((dispose) => {
          publishLayoutCss(() => slots.read(strip).length > 0, () => slots.read(thumbs).length > 0)
          return dispose
        })), (dispose) => Effect.sync(dispose))
      }),
    })
  }),
})

import { bar } from "./bar.tsx"

import { calledApp,followName,startedAt } from "./named.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { connectionReadout,olai } from "@olai/web/client/wire.ts"
export const components = {
  deployment: definePlugin({name: "deployment", needs: [Offers], apply: Effect.gen(function*() {
    yield* Effect.acquireRelease(Effect.sync(() => followName({
      readout: connectionReadout, ask: () => runAsync(olai.procedures.app.get()),
    })), stop => Effect.sync(stop))
    yield* (yield* Offers).own("deployment", () => ({called: calledApp, started: startedAt}))
  })}),
}
