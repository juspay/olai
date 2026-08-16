/**
 * The one shape this package is handed, named once.
 *
 * `@olai/store` is generic over content and `@olai/format` says what olai's
 * content is; the pairing of the two is what an op actually operates on, and
 * spelling `Store<Reading, ReadonlyArray<OutlineError>>` at every call site
 * would be the same joint asserted six times.
 */

import type { OutlineError, Reading } from "@olai/format"
import type * as StoreModule from "@olai/store"

/** The store, as a validated outline set: the files, and the one derivation
 *  they were judged against ({@link Reading}). The store's `S` is whatever its
 *  codec calls a validated set, and olai's is the pair — so a snapshot carries
 *  the view rather than the raw material for one. */
export type Store = StoreModule.Store<Reading, ReadonlyArray<OutlineError>>
