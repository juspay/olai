import { definePlugin, FileKinds } from "@olai/plugin-api/services"
import { Effect } from "effect"

export const name = "pdf"
export default definePlugin({
  name, needs: [FileKinds],
  apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({
      exts: [".pdf"], holds: "bytes", kept: false, fetched: true,
      noun: "PDF", article: "a",
    })
  }),
})
