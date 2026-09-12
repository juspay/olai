import { definePlugin, FileKinds } from "@olai/plugin-api/services"
import { Effect } from "effect"
import { parseOutline, serializeOutline, type OutlineFormat } from "@olai/format"
const format: OutlineFormat = { parse: parseOutline, serialize: serializeOutline }

export const name = "olai"
export default definePlugin({
  name, needs: [FileKinds],
  apply: Effect.gen(function*() {
    yield* (yield* FileKinds).register({
      exts: [".olai"], holds: "nodes", kept: true, fetched: false,
      noun: "outline", article: "an", format,
    })
  }),
})
