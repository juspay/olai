/**
 * THE MATCHER THE OUTLINE READS, held for the activation that declared it.
 *
 * Two doors of this row spend it — the `@`-completion in an editor and the two
 * shortlists (the move picker, the edge panel) — and both draw a refusal rather
 * than disappearing when there is no matcher mounted, which is the empty read
 * below. The dependency is declared on `../browser.tsx`'s `search` component,
 * so the outline itself keeps editing and navigating when the matcher leaves.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import { followReading, type NodeSearch, type SearchProvider } from "olai-plugin-search/reading"

const provider = heldService<SearchProvider>()

export const holdReading = provider.hold

export const createSearch = ((text, kind) =>
  followReading(provider.read, text, kind)) as NodeSearch
