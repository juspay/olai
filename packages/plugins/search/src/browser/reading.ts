/**
 * THE MATCHER THIS ROW'S OWN FACE READS, held for this row's activation.
 *
 * The header box is a face of the row that OFFERS `search.readings`, so the
 * value it reads is the very one its `apply` offers — held here rather than
 * looked up, because a face three levels inside a component cannot be handed
 * an `apply`'s value any other way.
 *
 * Private to this package. `./contracts/reading.ts` is the door other packages
 * open, and what crosses it is a TYPE and a pure `followReading`; the live
 * provider crosses no boundary at all.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import { followReading, type NodeSearch, type SearchProvider } from "../contracts/reading.ts"

const provider = heldService<SearchProvider>()

/** Told by `../browser.tsx`, for that activation. */
export const holdReading = provider.hold

/** ...and this package's own binding of the pure reading over it. */
export const createSearch = ((text, kind) =>
  followReading(provider.read, text, kind)) as NodeSearch
