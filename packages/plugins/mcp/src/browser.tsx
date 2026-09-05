/** Transport controls use the existing plugins panel. */
import { definePlugin } from "@olai/plugin-api"
import { Effect } from "effect"
import { name } from "./index.ts"
export { name } from "./index.ts"

export default definePlugin({ name, needs: [], apply: Effect.void })
