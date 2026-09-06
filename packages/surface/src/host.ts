/** Permanent management contract; capability schemas are composed separately. */
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { OpFailure } from "@olai/format"
import { PluginRoster, NO_ROSTER, sameRoster } from "./plugins.ts"
import { Who } from "./who.ts"
import { App } from "./app.ts"
export { NO_ROSTER, type BuiltPlugin, type PluginRoster, type PluginState } from "./plugins.ts"
export type { Who } from "./who.ts"
export const hostSurface = defineSurface({
  cells: { plugins: { schema: PluginRoster, default: NO_ROSTER, verbs: ["get"], equals: sameRoster, arrayKey: "name" } },
  procedures: {
    plugins: { set: { input: Schema.Struct({ name: Schema.String, enabled: Schema.Boolean }), output: Schema.Struct({}), error: OpFailure } },
    who: { get: { output: Schema.NullOr(Who) } },
    app: { get: { output: App } },
  },
})
export const hostFaces = {
  browser: { plugins: "resource", "plugins.set": "tool", "who.get": "tool", "app.get": "tool" },
  agent: {},
} as const
