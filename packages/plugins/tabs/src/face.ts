/**
 * What a tab WEARS besides its title: a glyph for the kind of page it holds.
 * Read off the address, so a tab in the background — which has no page mounted
 * — wears the same glyph it wore in front.
 */
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, workspaceOf } from "olai-plugin-navigation/workspace"

export const glyphOf = (routes: Routing, href: string): string => {
  const panes = panesOf(workspaceOf(routes, href))
  if (panes.length > 1) return "◫"
  const route = panes[0]!.route
  if (route.kind === "plugin") return "◷"
  if (route.kind === "trash") return "⌫"
  const address = route.address
  if (address === null) return "⌂"
  return address.kind === "node" ? "•" : "¶"
}
