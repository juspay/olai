import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"

export default definePlugin({
  name: "reader",
  needs: [],
  apply: Effect.void,
})
