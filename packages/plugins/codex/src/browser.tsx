/** The Codex engine's mark and no-agent install sentence. */
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

import { CodexMark } from "./browser/Mark.tsx"
import { name } from "./index.ts"
import { INSTALL } from "./install.ts"

export { name }

export default definePlugin({
  name,
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("delivery.mark", CodexMark)
    yield* slots.register("engine.install", INSTALL)
  }),
})
