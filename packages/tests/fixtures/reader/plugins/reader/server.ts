import { definePlugin, Kinds } from "@olai/plugin-api"
import { Effect } from "effect"

import { splitPair } from "./pairs.ts"

export default definePlugin({
  name: "reader",
  needs: [Kinds],
  apply: Effect.gen(function*() {
    const kinds = yield* Kinds
    yield* kinds.register({
      kind: "pair",
      takes: "`reader-pair`: a French sentence, ` | `, and its English",
      admits: (value: string) => splitPair(value) !== null,
    })
  }),
})
