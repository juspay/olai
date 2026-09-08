import { type ImplementSurfaceDeps, inMemoryChannel } from "@kolu/surface/server"
import {
  definePlugin,
  Ops,
  Surfaces,
  Vault,
} from "@olai/plugin-api/services"
import {
  type PageReading,
  samePageReading,
} from "@olai/format"
import { Effect } from "effect"

import { faces, name, surface } from "./wire.ts"

export { faces, name, surface } from "./wire.ts"

/**
 * THE GRAPH'S SERVER HALF, which holds nothing of its own.
 *
 * The reading a graph page needs is core's standing page read — `ops.page`,
 * the GATED read: one snapshot, the same one a keystroke, an agent and this
 * page already share. So this half registers a single stream whose `read`
 * forwards the request and whose `isEqual` is the schema-derived page
 * comparison, and its whole state is the pulse below.
 *
 * THE PULSE IS THE ONE THING IT KEEPS: `install` hands the framework a
 * consumer attached to a `void` channel, and `vault.revision` /
 * `vault.unloaded` publish into it, so a subscriber re-reads exactly when the
 * directory changed and never otherwise. Nothing is acquired, so nothing is
 * released beyond the registration itself — the subscriptions unwind with
 * this plugin's scope, and switching the row off closes every `graph`
 * subscription and puts the tab's page arm to `waiting`.
 */
export default definePlugin({
  name,
  needs: [Ops, Surfaces, Vault],
  apply: Effect.gen(function*() {
    const ops = yield* Ops
    const surfaces = yield* Surfaces
    const vault = yield* Vault

    const revisions = inMemoryChannel<void>()
    const install = (_input: unknown, onEvent: () => void): (() => void) =>
      revisions.consume({ onEvent, onError: () => {} })
    yield* vault.revision(() => Effect.sync(() => revisions.publish(undefined)))
    yield* vault.unloaded(Effect.sync(() => revisions.publish(undefined)))

    yield* surfaces.register({
      surface,
      faces,
      deps: {
        streams: {
          graph: {
            read: (input) => Effect.runPromise(ops.page(input)) as Promise<PageReading>,
            install,
            isEqual: samePageReading,
          },
        },
        // A transient vault read must be visible without taking down every
        // subscriber. The framework requires this for poll-shaped streams.
        onStreamReadError: (error, { stream }) => {
          Effect.runFork(Effect.logWarning(`graph ${stream} read failed: ${String(error)}`))
        },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
    })
  }),
})
