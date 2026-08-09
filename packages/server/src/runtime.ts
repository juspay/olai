/**
 * The surface, bound to the store.
 *
 * Two members, two bindings, and both are the same shape they will be when the
 * store goes live in phase 3:
 *
 *   - the stream is `SubscriptionRef.changes` verbatim — current value first,
 *     then every later one — which is already surface's snapshot-then-deltas
 *     contract, so a watcher publishing a second revision needs no change here
 *     at all;
 *   - the cell is pumped by a fiber following the other ref, for the same
 *     reason. Today it publishes once; tomorrow it publishes on every reload,
 *     and the wiring is the same wiring.
 *
 * Nothing here interprets an outline. It moves what the store decided onto the
 * wire, and that is all.
 */

import { surface } from "@olai/surface"
import type { OutlineError, OutlineSet } from "@olai/format"
import type { Store } from "@olai/store"
import {
  implementSurface,
  inMemoryStore,
  type SurfaceHandlers,
} from "@kolu/surface/server"
import { Effect, Stream, SubscriptionRef } from "effect"
import type { Rpc, RpcGroup } from "effect/unstable/rpc"

export interface Bound {
  readonly group: RpcGroup.RpcGroup<Rpc.Any>
  readonly handlers: SurfaceHandlers
  /** Resolves on orderly shutdown and REJECTS on structural wiring death — a
   *  builder that threw, a source whose install threw. A serving site that
   *  ignored it would answer subscriptions with silence. */
  readonly done: Promise<void>
  readonly close: () => Promise<void>
}

export const bind = (store: Store<OutlineSet, ReadonlyArray<OutlineError>>) =>
  Effect.gen(function*() {
    // Seeded empty and filled by the pump below: `SubscriptionRef.changes`
    // delivers the current value before any update, so peeking at the ref here
    // as well would be the same read twice with a window between them.
    const errors = inMemoryStore<ReadonlyArray<OutlineError>>([])

    const runtime = implementSurface(surface, {
      cells: { errors: { store: errors } },
      streams: {
        outlines: {
          source: () =>
            Stream.map(SubscriptionRef.changes(store.snapshot), (snapshot) =>
              snapshot === null
                ? null
                : { rev: snapshot.rev, set: snapshot.value }),
        },
      },
      // The deps object is erased because surface's `ImplementSurfaceDeps<S>`
      // is inferred through the spec's schemas, and the inference does not
      // survive a spec assembled in another package. drishti does the same at
      // its one call site. The cost is bounded: the two handlers above are the
      // only code the cast covers, and both are exercised by the e2e suite.
    } as never)

    // Writes go through the framework's cell face, never `errors.set`, so the
    // cell's dedup and its publish both fire.
    yield* Effect.forkScoped(
      Stream.runForEach(SubscriptionRef.changes(store.errors), (next) =>
        Effect.sync(() => {
          runtime.ctx.cells.errors.set(next ?? [])
        })),
    )

    return {
      group: runtime.group as RpcGroup.RpcGroup<Rpc.Any>,
      handlers: runtime.handlers as SurfaceHandlers,
      done: runtime.done,
      close: () => runtime.close(),
    }
  })
