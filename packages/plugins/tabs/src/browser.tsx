import { Effect } from "effect"
import { createRoot } from "solid-js"

import { chatState } from "olai-plugin-chat/attention"

import { definePlugin, Offers, Slots } from "@olai/plugin-api"
import { overlays, shell, strip } from "olai-plugin-layout/contract"
import { navigation } from "olai-plugin-navigation/contract"
import type {} from "olai-plugin-navigation/slots"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"

import { marksOver } from "./attention.ts"
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
    yield* Effect.acquireRelease(Effect.sync(() => router.offerTabs(workspace => state.value.open(workspace))), release => Effect.sync(release))
    const slots = yield* Slots
    for (const chord of chordsOf(state.value)) yield* slots.register("app.keys", chord)
  }),
})

export const components = {
  strip: definePlugin({
    name: "strip",
    needs: [tabsState, navigation, shell, rendererSlots],
    apply: Effect.gen(function* () {
      const tabs = yield* tabsState
      const router = yield* navigation
      const geometry = yield* shell
      yield* (yield* rendererSlots).contribute(strip, () => <Strip tabs={tabs} router={router} />)
      yield* Effect.acquireRelease(Effect.sync(() => tabs.draw(geometry.desktop)), (release) => Effect.sync(release))
    }),
  }),
  attention: definePlugin({
    name: "attention",
    needs: [tabsState, chatState, navigation],
    apply: Effect.gen(function* () {
      const tabs = yield* tabsState
      const chat = yield* chatState
      const router = yield* navigation
      yield* Effect.acquireRelease(
        Effect.sync(() => createRoot((dispose) => {
          const releases = marksOver(chat, router.routes, tabs.tabs).map((reading) => tabs.dot(reading))
          return () => {
            for (const release of releases.reverse()) release()
            dispose()
          }
        })),
        (stop) => Effect.sync(stop),
      )
    }),
  }),
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
