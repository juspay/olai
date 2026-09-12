import { definePlugin, FileKinds } from "@olai/plugin-api/services"
import { Effect } from "effect"

export const name = "csv"
export default definePlugin({
  name, needs: [FileKinds],
  apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({
      exts: [".csv"], holds: "text", kept: false, fetched: false,
      noun: "table", article: "a",
    })
  }),
})
