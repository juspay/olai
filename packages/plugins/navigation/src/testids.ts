/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it. */
export const TESTID = {
  addressName: "address-name",
  addressFilter: "address-filter",
  shortcuts: "shortcuts",
  shortcut: "shortcut",
  palette: "palette",
  paletteScrim: "palette-scrim",
  paletteInput: "palette-input",
  paletteList: "palette-list",
  paletteItem: "palette-item",
  paletteAsk: "palette-ask",
  paletteItemPlace: "palette-item-place",
  paletteItemProp: "palette-item-prop",
  paletteSaid: "palette-said",
  paletteConfirm: "palette-confirm",
  pane: "pane",
  searchRefusal: "search-refusal",
  paletteAskError: "palette-ask-error",
  paletteSearchError: "palette-search-error",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/navigation": OwnedTestIds }
}
