import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"

export default definePlugin({
  name: "swatch",
  needs: [Kinds],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({
      kind: "hex",
      takes: "`swatch-hex` (a #rrggbb colour)",
      admits: (value: string) => /^#[0-9a-f]{6}$/i.test(value),
    })
  }),
})
