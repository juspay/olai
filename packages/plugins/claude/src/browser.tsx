/** This engine owns its mark and its scoped inspector row.
 * The absence sentence comes from chat's declared standing service. */
import type {} from "olai-plugin-chat/slots"
import { engineRow } from "olai-plugin-chat/browser-engines"
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"
import { ClaudeMark } from "./browser/Mark.tsx"
import { name } from "./index.ts"

export { name }
export const components = { row: engineRow(name) }

export default definePlugin({
  name,
  needs: [Slots],
  apply: Effect.gen(function*() {
    yield* (yield* Slots).register("delivery.mark", ClaudeMark)
  }),
})
