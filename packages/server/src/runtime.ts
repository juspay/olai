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
 *   - the cell is an OWNED source: `connect` hands the framework the fiber
 *     that follows the other ref, so the write goes through the cell's private
 *     arm, the fiber lives on the runtime's own scope (a closed runtime stops
 *     it, rather than being published into afterwards), and a failure in it
 *     settles `done` — which is the channel the caller uses to decide the
 *     process is unrecoverably faulted.
 *
 * Nothing here interprets an outline. It moves what the store decided onto the
 * wire, and that is all.
 */

import type { OutlineError, OutlineSet } from "@olai/format"
import type { Store } from "@olai/store"
import { surface } from "@olai/surface"
import {
  type ImplementSurfaceDeps,
  implementSurface,
  inMemoryStore,
  type SurfaceRuntime,
} from "@kolu/surface/server"
import { Effect, Stream, SubscriptionRef } from "effect"

/** What a transport needs, and nothing else. `ctx` is the write face, which
 *  belongs to the bindings below rather than to whoever serves them. */
export type Bound = Omit<SurfaceRuntime<typeof surface.spec>, "ctx">

export const bind = (
  store: Store<OutlineSet, ReadonlyArray<OutlineError>>,
): Effect.Effect<Bound> =>
  Effect.sync(() => {
    // Seeded empty and filled by `connect`: `SubscriptionRef.changes` delivers
    // the current value before any update, so peeking at the ref here as well
    // would be the same read twice with a window between them.
    const errors = inMemoryStore<ReadonlyArray<OutlineError>>([])

    const deps: ImplementSurfaceDeps<typeof surface.spec> = {
      cells: {
        errors: {
          store: errors,
          connect: (cell) =>
            Stream.runForEach(
              SubscriptionRef.changes(store.errors),
              (next) => Effect.sync(() => cell.set(next ?? [])),
            ),
        },
      },
      streams: {
        outlines: {
          source: () =>
            Stream.map(SubscriptionRef.changes(store.snapshot), (snapshot) =>
              snapshot === null
                ? null
                : { rev: snapshot.rev, set: snapshot.value }),
        },
      },
    }

    return implementSurface(surface, deps)
  })
