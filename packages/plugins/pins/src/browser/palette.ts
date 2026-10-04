/** Palette pin commands describe the focused page and the open layout. */
import type { Shelf } from "@olai/format"

import type { PaletteItem } from "olai-plugin-navigation/palette-model"
import { atOnce } from "@olai/web/client/settled.ts"
import type { Route } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting as Routing } from "olai-plugin-navigation/workspace"
import { namingFor } from "./naming.ts"
import { pinnedAt } from "./pins.ts"

export const pinItem = (
  /** The app's URL grammar, handed in — see `./pins.ts`'s `pinsOf`. */
  routes: Routing,
  route: Route,
  shelf: Shelf,
  /** The live page name, used on the second line and naming placeholder. */
  called: string,
): PaletteItem => {
  // ASKED ONCE, and handed to the rule beside it: whether this page is on the
  // shelf is a parse of every row, and the label and the question are two
  // readings of that one answer rather than two walks of the same list.
  const already = pinnedAt(routes, shelf, route)
  return {
    id: "pin-page",
    label: already !== undefined
      ? "Unpin this page"
      : namingFor(routes, route, already, called) === null
      ? "Pin this page"
      : "Pin this page…",
    // WHICH page, on the second line — the slot a search hit puts its ancestry
    // in, and wanted here for the same reason a write row wants it: the
    // palette is opened from anywhere, and a bare "Pin this page" in a list of
    // strangers does not say which page it means.
    place: called,
    action: { kind: "pin" },
    // The shelf this tab already holds — no answer behind it
    // (`../settled.ts`).
    taking: atOnce,
    search: "pin unpin shelf sidebar bookmark save this page keep name saved search",
  }
}


export const layoutItem = (already: boolean, called: string): PaletteItem => ({
  id: "pin-layout",
  label: already ? "Unpin this layout" : "Pin this layout…",
  place: called,
  action: { kind: "pin" },
  taking: atOnce,
  search: "pin unpin layout shelf sidebar bookmark save workspace",
})
