/**
 * THE MATCHER THE PALETTE READS, held for the activation that declared it.
 *
 * The palette's node rows go through `search.readings`, which is
 * `olai-plugin-search`'s. A DECLARED dependency, on a component of its own
 * (`../browser.tsx`'s `search`), so the runtime knows navigation reads the
 * matcher and the plugins panel can say so — where the reach used to be a
 * generic host lookup nothing declared.
 *
 * The palette itself is NOT held against it. A serve with no matcher opens the
 * palette, takes a query and answers the refusal the grammar already had words
 * for (`search_is_a_plugin.feature`: *no matcher*), which is what the empty
 * read below draws.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import { followReading, type NodeSearch, type SearchProvider } from "olai-plugin-search/reading"

const provider = heldService<SearchProvider>()

export const holdReading = provider.hold

export const createSearch = ((text, kind) =>
  followReading(provider.read, text, kind)) as NodeSearch
