/**
 * THE HEADER BOX'S TEST IDS — this plugin's half of olai's testid table.
 *
 * Values did not change, which is what kept the move from also being a rename:
 * a testid is a promise to a scenario. Names only, no imports.
 *
 * WHAT STAYED IN `@olai/web` is the pair the box shares with the ⌘K palette —
 * `searchRefusal` and `searchCount` — because the shortlist kit under every box
 * is core furniture four core doors draw with, and what it says about a refused
 * query or about "8 of 90" is one sentence about one grammar rather than this
 * door's own words.
 */
export const TESTID = {
  headerSearch: "header-search",
  /** The phone's door: opens the palette, which is the same modal. */
  headerSearchOpen: "header-search-open",
  /** The results panel. `data-asked` is WHICH query the rows answer — the
   *  same attribute the palette list and the shortlist publish. */
  headerSearchResults: "header-search-results",
  headerSearchItem: "header-search-item",
  headerSearchItemPlace: "header-search-item-place",
  /** One `key value` pair on a header result row's third line. */
  headerSearchItemProp: "header-search-item-prop",
  headerSearchError: "header-search-error",
} as const
