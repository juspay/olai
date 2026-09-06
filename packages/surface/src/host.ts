/** Permanent management contract; capability schemas are composed separately. */
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { OpFailure } from "@olai/format"
import { PluginRoster, NO_ROSTER, sameRoster } from "./plugins.ts"
import { Who } from "./who.ts"
import { App } from "./app.ts"
export { NO_ROSTER, type BuiltPlugin, type PluginRoster, type PluginState } from "./plugins.ts"
export type { Who } from "./who.ts"
export { surface as hostSurface } from "./core.ts"
export const hostFaces = {
  browser: { plugins: "resource", "plugins.set": "tool", "who.get": "tool", "app.get": "tool" },
  agent: {},
} as const
