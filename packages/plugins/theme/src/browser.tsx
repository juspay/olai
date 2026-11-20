import { definePlugin, Offers } from "@olai/plugin-api"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { sections } from "olai-plugin-preferences/contract"
import { Effect } from "effect"
import { appearance, name } from "./index.ts"
import { createAppearance } from "./state.ts"
import { AppearanceRows } from "./AppearanceRows.tsx"

export default definePlugin({
  name, needs: [Offers], apply: Effect.gen(function*() {
    const state = yield* createAppearance
    yield* (yield* Offers).own("appearance", () => state)
  }),
})
import { deployment } from "olai-plugin-layout/contract"
import { followDeployment } from "./naming.ts"
export const components = {
  naming: definePlugin({ name: "naming", needs: [appearance, deployment], apply: Effect.gen(function*() {
    const view = yield* appearance
    const source = yield* deployment
    yield* followDeployment(view.chrome, source.called)
  }) }),
  preferences: definePlugin({ name: "preferences", needs: [appearance, rendererSlots], apply: Effect.gen(function*() {
    const state = yield* appearance
    yield* (yield* rendererSlots).contribute(sections, { heading: "appearance" as const, order: 0, scope: "browser" as const, body: () => <AppearanceRows state={state} /> })
  }) }),
}
