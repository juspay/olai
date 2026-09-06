import { slotContracts as navigationSlots } from "olai-plugin-navigation/slots"
import { slotContracts } from "./slots.ts"
import { PanelHandle } from "./layout/Handle.tsx"
/**
 * Layout occupies the renderer's root. Geometry observers are resources of that
 * entry's integration, so removing either the entry or renderer drains them.
 * They start before the face is published and reread storage on reactivation;
 * no resize or cross-tab listener is left in the permanent browser entry point.
 *
 * The frame consumes navigation and content contributions. Each content
 * provider owns its own models and editor state.
 */
import { definePlugin,Offers } from "@olai/plugin-api"
import { Fault } from "@olai/web/client/errors/Fault.tsx"
import { publishLayoutCss } from "olai-plugin-layout/layout/css.ts"
import { trackVisibleViewport } from "olai-plugin-layout/viewport.ts"
import { Effect } from "effect"
import { content,navigation,paletteAdapters } from "olai-plugin-navigation/contract"
import { rendererSlots,root } from "olai-plugin-ui-renderer/contract"
import { createRoot,ErrorBoundary } from "solid-js"
import Frame from "./Frame.tsx"
import { contentStatus,holdPanelHandle,name,overlays,sidebar,tools } from "./index.ts"
import { trackDesktop } from "./layout/media-owner.ts"
import { followLayout } from "./layout/prefs-owner.ts"

export default definePlugin({
  name,
  needs: [rendererSlots, Offers, navigation],
  apply: Effect.gen(function*() {
    yield* Effect.acquireRelease(Effect.sync(()=>holdPanelHandle(PanelHandle)),stop=>Effect.sync(stop))
    const slots = yield* rendererSlots
    const router = yield* navigation
    // Offers publishes in the outer plugin activation. Location activations
    // run in their own Cordis host; publishing there would make the bar
    // invisible to the plugins that consume it. This provider needs the
    // renderer, so either row leaving revokes the service.
    yield* (yield* Offers).own("bar", () => bar)
    yield* slots.contribute(root, () => <ErrorBoundary fallback={(error) => {
      console.error(error)
      return <Fault text={String(error)} />
    }}><Frame slots={slots} router={router} /></ErrorBoundary>, {
      children: [sidebar, tools, contentStatus, overlays, content, paletteAdapters, ...Object.values(slotContracts), ...Object.values(navigationSlots)],
      activate: Effect.gen(function*() {
        for (const start of [trackVisibleViewport, trackDesktop, followLayout]) {
          yield* Effect.acquireRelease(Effect.sync(start), (stop) => Effect.sync(stop))
        }
        yield* Effect.acquireRelease(Effect.sync(() => createRoot((dispose) => {
          publishLayoutCss()
          return dispose
        })), (dispose) => Effect.sync(dispose))
      }),
    })
  }),
})

import { bar } from "./bar.tsx"

import { calledApp,followName } from "@olai/web/client/named.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { connectionReadout,olai } from "@olai/web/client/wire.ts"
export const components = {
  deployment: definePlugin({name: "deployment", needs: [Offers], apply: Effect.gen(function*() {
    yield* Effect.acquireRelease(Effect.sync(() => followName({
      readout: connectionReadout, ask: () => runAsync(olai.procedures.app.get()),
    })), stop => Effect.sync(stop))
    yield* (yield* Offers).own("deployment", () => ({called: calledApp}))
  })}),
}
