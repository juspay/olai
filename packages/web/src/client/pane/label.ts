/**
 * A short name for a pane — the rail, the tab, the header.
 *
 * Asked of the route rather than of the page, so a label is available
 * before the set has been read and does not change meaning when a file
 * fails to parse. A zoomed node is named by its id; the title would be
 * nicer and is a follow-up (it needs the set, and a title can be a
 * sentence).
 *
 * THAT FOLLOW-UP EXISTS NOW, next door and deliberately not here:
 * `../pins/name.ts` names a DOOR on the sidebar's shelf, and it is asked of
 * the set precisely because a door with an id written on it is one nobody can
 * read. It stayed a second function rather than a flag on this one, and the
 * argument is written at that end — the short answer is that a pane wants a
 * file's whole PATH (two panes on `a/x.olai` and `b/x.olai` have to be
 * tellable apart) where a narrow column wants its name, so unifying them takes
 * a mode flag. What the two share is the ROUTE union, and both switches are
 * total over it, so a seventh kind of page is two compile errors rather than
 * one table quietly falling behind the other.
 */

import type { Route } from "../routes.ts"

export const labelOf = (route: Route): string => {
  if (route.kind === "at") {
    const address = route.address
    if (address === null) return "outline"
    return address.kind === "node" ? address.id : address.path
  }
  if (route.kind === "day") return route.date
  if (route.kind === "today") return "today"
  if (route.kind === "agenda") return "agenda"
  return "trash"
}
