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
export const components = {
  preferences: definePlugin({ name: "preferences", needs: [appearance, rendererSlots], apply: Effect.gen(function*() {
    const state = yield* appearance
    yield* (yield* rendererSlots).contribute(sections, () => <AppearanceRows state={state} />)
  }) }),
}
