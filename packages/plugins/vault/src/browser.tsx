/** Directory contents use core’s existing surface. This row adds no browser face. */
import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"

export default definePlugin({ name, needs: [], apply: Effect.void })
