import { definePlugin, FileKinds } from "@olai/plugin-api/services"
import { Effect } from "effect"

export const name = "hypertext"
export default definePlugin({
  name, needs: [FileKinds],
  apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({
      exts: [".html"], holds: "text", kept: false, fetched: true,
      noun: "page", article: "a",
    })
  }),
})
