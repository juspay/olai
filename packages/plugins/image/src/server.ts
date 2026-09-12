import { definePlugin, FileKinds } from "@olai/plugin-api/services"
import { Effect } from "effect"

export const name = "image"
export default definePlugin({
  name, needs: [FileKinds],
  apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({
      exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".svg"], holds: "bytes", kept: false, fetched: true,
      noun: "image", article: "an",
    })
  }),
})
