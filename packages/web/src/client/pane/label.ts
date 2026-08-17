/**
 * A short name for a pane — the rail, the tab, the header.
 *
 * Asked of the route rather than of the page, so a label is available
 * before the set has been read and does not change meaning when a file
 * fails to parse. A zoomed node is named by its id; the title would be
 * nicer and is a follow-up (it needs the set, and a title can be a
 * sentence).
 */

import type { Route } from "../routes.ts"

export const labelOf = (route: Route): string => {
  if (route.kind === "outline") return route.file ?? "outline"
  if (route.kind === "document") return route.file
  if (route.kind === "node") return route.id
  if (route.kind === "day") return route.date
  if (route.kind === "today") return "today"
  if (route.kind === "agenda") return "agenda"
  return "trash"
}
