/** What the palette calls its rows — at the root and inside a level — see
 *  `olai-plugin-search`'s `Result.tsx` `RowTestids` for why the three travel
 *  as one value. */
import { TESTID } from "olai-plugin-navigation/testids"
import type { RowTestids } from "olai-plugin-search/ui/Result.tsx"

export const PALETTE_ROW: RowTestids = {
  row: TESTID.paletteItem,
  place: TESTID.paletteItemPlace,
  prop: TESTID.paletteItemProp,
}
