/**
 * THE HEADER DOOR'S TEST IDS — this plugin's half of olai's testid table.
 *
 * A testid is a promise to a scenario. Names only, no imports.
 *
 * WHAT STAYED IN `@olai/web` is the pair the palette's shortlist shares with
 * every other box — `searchRefusal` and `searchCount` — because the shortlist
 * kit is core furniture several core doors draw with, and what it says about a
 * refused query or about "8 of 90" is one sentence about one grammar rather
 * than this door's own words.
 */
export const TESTID = {
  /** The header's door: a button that opens the palette — the magnifier on a
   *  phone, `Search` and the chord on a desktop. */
  headerSearchOpen: "header-search-open",
  searchCount: "search-count",
} as const

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/search": OwnedTestIds }
}
