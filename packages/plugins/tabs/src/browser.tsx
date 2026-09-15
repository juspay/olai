/**
 * THE TABS ROW — the set of open tabs, per browser, and the lane the router
 * walks history in for the tab in front.
 *
 * THE ROW activates with navigation and nothing that draws: the set, its
 * stored copy, the lane and the chords are all it holds. What DRAWS is on
 * components, each waiting for what it needs — the strip for the layout's
 * shell and a renderer, the link menu for a renderer, and the needs-you dot
 * for the chat row.
 *
 * ACQUIRED in this order and released in the reverse: the state's root, the
 * service, the lane (`switchLane(id)` … `switchLane(null)`), following the
 * router and writing the stored set, and the chords. So on release the chords
 * go first, then the store stops following, then the window gets its history
 * back, and only then is the service withdrawn and the root disposed.
 */
import { Effect } from "effect"
import { createRoot } from "solid-js"

import { definePlugin, Offers, Slots } from "@olai/plugin-api"
import { overlays, shell, strip } from "olai-plugin-layout/contract"
import { navigation } from "olai-plugin-navigation/contract"
import type {} from "olai-plugin-navigation/slots"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"

import { chordsOf } from "./chords.ts"
import type { TabsState } from "./contract.ts"
import { name, tabsState } from "./index.ts"
import { LinkMenu } from "./Links.tsx"
import { createTabs } from "./store.ts"
import { Strip } from "./Strip.tsx"

export default definePlugin({
  name,
  needs: [navigation, Offers, Slots],
  apply: Effect.gen(function* () {
    const router = yield* navigation
    const state = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => ({ value: createTabs(router), dispose }))),
      ({ dispose }) => Effect.sync(dispose),
    )
    yield* (yield* Offers).own("state", (): TabsState => state.value)
    yield* Effect.acquireRelease(Effect.sync(() => state.value.takeLane()), (release) => Effect.sync(release))
    yield* Effect.acquireRelease(Effect.sync(() => state.value.follow()), (stop) => Effect.sync(stop))
    const slots = yield* Slots
    for (const chord of chordsOf(state.value)) yield* slots.register("app.keys", chord)
  }),
})

export const components = {
  /** The strip, in layout's seat above the panes. It names `layout.shell` —
   *  never the row, which activates under any layout or none — and tells the
   *  set whether it is drawn on a desktop. */
  strip: definePlugin({
    name: "strip",
    needs: [tabsState, navigation, shell, rendererSlots],
    apply: Effect.gen(function* () {
      const tabs = yield* tabsState
      const router = yield* navigation
      const geometry = yield* shell
      yield* Effect.acquireRelease(Effect.sync(() => tabs.draw(geometry.desktop)), (release) => Effect.sync(release))
      yield* (yield* rendererSlots).contribute(strip, () => <Strip tabs={tabs} router={router} />)
    }),
  }),
  /** Open in new tab, on any in-app link (`./Links.tsx`). */
  links: definePlugin({
    name: "links",
    needs: [tabsState, navigation, rendererSlots],
    apply: Effect.gen(function* () {
      const tabs = yield* tabsState
      const router = yield* navigation
      yield* (yield* rendererSlots).contribute(overlays, () => <LinkMenu tabs={tabs} router={router} />)
    }),
  }),
}
