/** Appearance is useful before and without any UI. The provider requires only
 * Offers, acquires fresh storage-backed state and DOM ownership in its scope,
 * and publishes the value before preferences can consume it. Cleanup restores
 * prior presentation and removes listeners; another activation rereads storage.
 * The separate preferences component names the extra renderer dependency and
 * waits for the preferences-owned section location. Its absence cannot stop
 * the provider or introduce a theme/preferences/layout dependency cycle. */
import { definePlugin, Offers } from "@olai/plugin-api"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { sections } from "olai-plugin-preferences/contract"
import { Effect } from "effect"
import { appearance, name } from "./index.ts"
import { createAppearance } from "./state.ts"
import { AppearanceRows } from "./AppearanceRows.tsx"

/** Provider lifetime is independent of both the shell and preferences UI. */
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
    yield* (yield* rendererSlots).contribute(sections, () => <AppearanceRows state={state} />)
  }) }),
}
