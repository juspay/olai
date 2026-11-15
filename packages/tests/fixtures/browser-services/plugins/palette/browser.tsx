import { definePlugin, Offers } from "@olai/plugin-api"
import { Effect } from "effect"
export default definePlugin({ name: "palette", needs: [], apply: Effect.void })
export const components = {
  colours: definePlugin({ name: "ignored", needs: [Offers], apply: Effect.gen(function*() {
    yield* (yield* Offers).own("colours", () => ({ coat: "browser-palette-first" }))
  }) }),
}
