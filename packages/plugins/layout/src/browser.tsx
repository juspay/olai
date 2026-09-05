/**
 * Layout occupies the renderer's root. Geometry observers are resources of that
 * entry's integration, so removing either the entry or renderer drains them.
 * They start before the face is published and reread storage on reactivation;
 * no resize or cross-tab listener is left in the permanent browser entry point.
 *
 * The frame still composes notebook-specific providers during the remaining
 * extraction. Owning these resources does not yet establish the final layout,
 * navigation and independent content boundaries documented in Phase 18.
 */
import { definePlugin, slotLocation } from "@olai/plugin-api"
import { rendererSlots, root } from "olai-plugin-ui-renderer/contract"
import { Effect } from "effect"
import Frame from "./Frame.tsx"
import { Fault } from "@olai/web/client/errors/Fault.tsx"
import { trackVisibleViewport } from "@olai/web/client/viewport.ts"
import { trackDesktop } from "@olai/web/client/layout/media.ts"
import { followLayout } from "@olai/web/client/layout/prefs.ts"
import { publishLayoutCss } from "@olai/web/client/layout/css.ts"
import { createRoot, ErrorBoundary } from "solid-js"
import { name, sidebar, tools } from "./index.ts"

export default definePlugin({
  name,
  needs: [rendererSlots],
  apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    yield* slots.contribute(root, () => <ErrorBoundary fallback={(error) => {
      console.error(error)
      return <Fault text={String(error)} />
    }}><Frame slots={slots} /></ErrorBoundary>, {
      children: [sidebar, tools, ...([
        "app.panel", "app.header", "app.banner", "app.viewer", "app.mount",
        "app.keys", "app.command", "app.palette", "app.route",
        "outline.row.chip", "outline.row.pane",
        "outline.row.block", "outline.row.door", "outline.row.action",
      ] as const).map(slotLocation)],
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
