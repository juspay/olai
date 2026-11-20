import type { Shelf } from "@olai/format"

import type { PaletteItem } from "olai-plugin-navigation/palette-model"
import { atOnce } from "@olai/web/client/settled.ts"
import type { Route } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting as Routing } from "olai-plugin-navigation/workspace"
import { namingFor } from "./naming.ts"
import { pinnedAt } from "./pins.ts"

export const pinItem = (
  routes: Routing,
  route: Route,
  shelf: Shelf,
  called: string,
): PaletteItem => {
  const already = pinnedAt(routes, shelf, route)
  return {
    id: "pin-page",
    label: already !== undefined
      ? "Unpin this page"
      : namingFor(routes, route, already, called) === null
      ? "Pin this page"
      : "Pin this page…",
    place: called,
    action: { kind: "pin" },
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
