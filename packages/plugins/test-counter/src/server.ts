/** State and procedures live on the server activation. No vault, directory,
 * operations, navigation or renderer is required to serve this capability. */
import { definePlugin, Surfaces } from "@olai/plugin-api/services"
import { Effect } from "effect"
import { name, surface, faces } from "./wire.ts"
export { name, surface } from "./wire.ts"
export default definePlugin({ name, needs: [Surfaces], apply: Effect.gen(function*() {
  let count = 0
  yield* (yield* Surfaces).register({ surface, faces, deps: {
    procedures: { counter: {
      read: () => Effect.succeed(count),
      increment: () => Effect.sync(() => ++count),
    } },
  } })
}) })
