import { OpFailure } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { App } from "./app.ts"
import { NO_ROSTER } from "./plugins.ts"
import { PluginRoster } from "./plugins.ts"
import { sameRoster } from "./plugins.ts"
import { Who } from "./who.ts"
export const surface = defineSurface({
cells: {
    plugins: {
      schema: PluginRoster,
      default: NO_ROSTER,
      verbs: ["get"],
      equals: sameRoster,
      arrayKey: "name",
    }
},
procedures: {
plugins: {
      configure: {
        input: Schema.Struct({ name: Schema.String, key: Schema.String, value: Schema.NullOr(Schema.String) }),
        output: Schema.Struct({}), error: OpFailure,
      },
      set: {
        input: Schema.Struct({
          name: Schema.String,
          enabled: Schema.Boolean,
        }),
        output: Schema.Struct({}),
        error: OpFailure,
      } },
    who: {
      get: {
        output: Schema.NullOr(Who),
      },
    },
    app: {
      get: {
        output: App,
      },
    }
}
})
