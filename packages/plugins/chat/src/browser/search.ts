import { heldService } from "@olai/ui-primitives/held.ts"
import { followReading, type NodeSearch, type SearchProvider } from "olai-plugin-search/reading"

const provider = heldService<SearchProvider>()

export const holdReading = provider.hold

export const createSearch = ((text, kind) =>
  followReading(provider.read, text, kind)) as NodeSearch
