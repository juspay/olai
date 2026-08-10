/**
 * The two shapes this package is handed, named once.
 *
 * `@olai/store` is generic over content and `@olai/format` says what olai's
 * content is; the pairing of the two is what an op actually operates on, and
 * spelling `Store<OutlineSet, ReadonlyArray<OutlineError>>` at every call site
 * would be the same joint asserted six times.
 */

import type { OutlineError, OutlineSet } from "@olai/format"
import type * as StoreModule from "@olai/store"

export type { OutlineError, OutlineSet }

/** The store, as an outline set. */
export type Store = StoreModule.Store<OutlineSet, ReadonlyArray<OutlineError>>
