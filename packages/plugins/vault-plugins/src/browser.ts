/** Source approval is a vault capability, not permanent host management.
 * The inspector consumes its scoped client without owning its activation. */
import { definePlugin, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { name } from "./index.ts"
import { holdClient, type Client } from "./client.ts"
export { surface } from "./surface.ts"
export default definePlugin({ name, needs: [Wired], apply: Effect.gen(function*() {
  const wired = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => wired.client() as Client)), stop => Effect.sync(stop))
}) })
