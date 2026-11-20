import { declaredKinds } from "@olai/bundle/bundle"
import type { KindVocabulary } from "@olai/format"
import type { Plugins } from "@olai/plugin-api/services"
import { Effect } from "effect"

export const propKinds = (plugins: Plugins | null): Effect.Effect<KindVocabulary> =>
  plugins === null
    ? Effect.succeed({ built: new Map(), enabled: new Map() })
    : Effect.map(
      declaredKinds,
      (built) => ({
        built,
        get enabled() {
          return plugins.kinds()
        },
      }),
    )
