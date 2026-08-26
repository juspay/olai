/**
 * The one shape this package is handed, named once.
 *
 * `@olai/store` is generic over content and `@olai/format` says what olai's
 * content is; the pairing of the two is what an op actually operates on, and
 * spelling `Store<Reading, Verdict>` at every call site would be the same joint
 * asserted six times.
 */

import type { Reading, Verdict } from "@olai/format"
import type * as StoreModule from "@olai/store"

/** The store, as a validated outline set: the files, and the one derivation
 *  they were judged against ({@link Reading}). The store's `S` is whatever its
 *  codec calls a validated set, and olai's is the pair — so a snapshot carries
 *  the view rather than the raw material for one.
 *
 *  Its `E` is the {@link Verdict}: what the codec says when it says no, on
 *  either of its two halves — one file that would not parse, or the whole set
 *  the rules refused. Every consumer above reads its ANSWERS (`admits`,
 *  `summary`, `implicating`) rather than re-partitioning a list of rows. */
export type Store = StoreModule.Store<Reading, Verdict>
