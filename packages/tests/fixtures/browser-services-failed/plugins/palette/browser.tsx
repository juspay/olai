import { definePlugin, Offers } from "@olai/plugin-api"
import { Effect } from "effect"
export default definePlugin({ name: "palette", needs: [Offers], apply: Effect.gen(function*() {
  yield* (yield* Offers).own("colours", () => ({ coat: "browser-palette-first" }))
  yield* Effect.die(new Error("palette initialization failed"))
}) })
