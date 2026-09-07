/**
 * THE MATCHER THE COMPOSER READS, held for the activation that declared it.
 *
 * The `@` list in the composer and the *assign to node…* shortlist go through
 * `search.readings`. Declared on `../browser.tsx`'s `search` component so the
 * panel, the transcript and the roster keep working with no matcher mounted —
 * which is what the empty read below draws.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import { followReading, type NodeSearch, type SearchProvider } from "olai-plugin-search/reading"

const provider = heldService<SearchProvider>()

export const holdReading = provider.hold

export const createSearch = ((text, kind) =>
  followReading(provider.read, text, kind)) as NodeSearch
