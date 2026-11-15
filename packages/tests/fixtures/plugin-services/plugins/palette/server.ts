import { definePlugin, Offers } from "@olai/plugin-api"
import { Effect } from "effect"
export default definePlugin({ name: "palette", needs: [Offers], apply: Effect.gen(function*() {
  yield* (yield* Offers).own("colours", () => ({ accepts: (value: string) => /^#[0-9a-f]{6}$/i.test(value) }))
}) })
