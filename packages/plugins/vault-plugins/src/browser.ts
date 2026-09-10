/** Source approval is a vault capability, not permanent host management.
 * The inspector consumes ONE VERB of it through a declared service; this row's
 * own client stays behind this package's wall (`./index.ts`'s `Approvals`). */
import { definePlugin, Offers, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { type Approvals, name } from "./index.ts"
import { client, holdClient, type Client } from "./client.ts"
export { surface } from "./surface.ts"
export default definePlugin({ name, needs: [Wired, Offers], apply: Effect.gen(function*() {
  const wired = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => wired.client() as Client)), stop => Effect.sync(stop))
  yield* (yield* Offers).own("approval", (): Approvals => ({
    approve: (request) => client().procedures.plugins.approve(request),
  }))
}) })
