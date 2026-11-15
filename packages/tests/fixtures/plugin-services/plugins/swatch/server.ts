import { definePlugin, Kinds, serviceTag } from "@olai/plugin-api"
import { Effect } from "effect"

const Palette = serviceTag<{ accepts: (value: string) => boolean }>("palette.colours")
export default definePlugin({
  name: "swatch",
  needs: [Kinds, Palette],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    const palette = yield* Palette
    yield* kinds.register({
      kind: "hex",
      takes: "`swatch-hex` (a #rrggbb colour)",
      admits: palette.accepts,
    })
  }),
})
