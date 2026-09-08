import { definePlugin, Offers, Wired } from "@olai/plugin-api"
import { Effect } from "effect"

import { graphWire, holdGraphWire, type GraphClient } from "./browser/wire.ts"
import { name, surface } from "./wire.ts"

export { name, surface } from "./wire.ts"

/**
 * THE BROWSER ROW. `Wired` for the tab's client factory, `Offers` so the row
 * publishes its readiness as a service (`graph.state`) rather than announcing
 * it through a module variable — the door carries the wire READ as a value,
 * so a component that arrives before the row is simply not mounted and one
 * that outlives it reads a closed door, and nothing here is a magic lookup
 * `HeldByThisActivation` has to know about.
 */
export default definePlugin({
  name,
  needs: [Wired, Offers],
  apply: Effect.gen(function*() {
    const wired = yield* Wired
    yield* holdGraphWire(() => wired.client() as GraphClient)
    yield* (yield* Offers).own("state", () => ({ wire: () => graphWire() }))
  }),
})
