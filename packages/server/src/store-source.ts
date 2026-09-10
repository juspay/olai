/** Store lifetime adapted to a stable reading source. The composition root
 * supplies host changes; surface binding never needs to know why a store left
 * or returned. Fixed fixtures keep the store's direct initial delivery. */
import type { Store } from "@olai/ops"
import type { Reading, Verdict } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { Stream, SubscriptionRef } from "effect"

export interface StoreSource {
  readonly current: () => Store | undefined
  readonly reads: Stream.Stream<{ readonly snapshot: Snapshot<Reading> | null }>
  readonly errors: Stream.Stream<Verdict | null>
}

export const fixedStore = (store: Store): StoreSource => ({
  current: () => store,
  reads: store.reads,
  errors: SubscriptionRef.changes(store.errors),
})

export const liveStore = (current: StoreSource["current"], changes: Stream.Stream<unknown>): StoreSource => {
  const stores = Stream.changes(Stream.map(changes, current))
  return {
    current,
    reads: Stream.switchMap(stores, (store): StoreSource["reads"] => store ? store.reads : Stream.succeed({ snapshot: null })),
    errors: Stream.switchMap(stores, (store) => store ? SubscriptionRef.changes(store.errors) : Stream.succeed(null)),
  }
}
