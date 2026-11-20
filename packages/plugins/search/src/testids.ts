export const TESTID = {
  headerSearch: "header-search",
  headerSearchOpen: "header-search-open",
  headerSearchResults: "header-search-results",
  headerSearchItem: "header-search-item",
  headerSearchItemPlace: "header-search-item-place",
  headerSearchItemProp: "header-search-item-prop",
  headerSearchError: "header-search-error",
  searchCount: "search-count",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/search": OwnedTestIds }
}
