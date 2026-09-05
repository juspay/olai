/**
 * Layout occupies the renderer's root. Geometry observers are resources of that
 * entry's integration, so removing either the entry or renderer drains them.
 * They start before the face is published and reread storage on reactivation;
 * no resize or cross-tab listener is left in the permanent browser entry point.
 *
 * The face still delegates content composition to App during the remaining
 * extraction. Owning these resources does not yet establish the final layout,
 * navigation and independent content boundaries documented in Phase 18.
 */
import { definePlugin } from "@olai/plugin-api"
import { rendererSlots, root } from "olai-plugin-ui-renderer/contract"
import { Effect } from "effect"
import App from "@olai/web/client/App.tsx"
import { Fault } from "@olai/web/client/errors/Fault.tsx"
import { trackVisibleViewport } from "@olai/web/client/viewport.ts"
import { trackDesktop } from "@olai/web/client/layout/media.ts"
import { followLayout } from "@olai/web/client/layout/prefs.ts"
import { publishLayoutCss } from "@olai/web/client/layout/css.ts"
import { createRoot, ErrorBoundary } from "solid-js"
import { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [rendererSlots],
  apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(root, () => <ErrorBoundary fallback={(error) => {
      console.error(error)
      return <Fault text={String(error)} />
    }}><App /></ErrorBoundary>, {
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
