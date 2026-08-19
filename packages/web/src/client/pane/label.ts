/**
 * A short name for a pane — the rail, the tab, the header.
 *
 * Asked of the route rather than of the page, so a label is available
 * before the set has been read and does not change meaning when a file
 * fails to parse. A zoomed node is named by its id; the title would be
 * nicer and is a follow-up (it needs the set, and a title can be a
 * sentence).
 *
 * A TOTAL SWITCH, and that is the whole of what it gained when the graph
 * arrived: this was a chain of `if`s ending in a bare `return "trash"`, so the
 * new route inherited the trash's name in every pane tab, every collapsed rail
 * and every `close …` label — silently, because a fall-through has nothing to
 * fail. The shape is `filter/narrowing.ts`'s, for its stated reason: a page kind
 * that arrives should have to come back here and say what it is called.
 */

import type { Route } from "../routes.ts"

export const labelOf = (route: Route): string => {
  switch (route.kind) {
    case "outline":
      return route.file ?? "outline"
    case "document":
      return route.file
    case "node":
      return route.id
    case "day":
      return route.date
    case "today":
      return "today"
    case "agenda":
      return "agenda"
    case "trash":
      return "trash"
    // The node it is centred on, for `node`'s reason — and the bare word for
    // the reading that is centred on none.
    case "graph":
      return route.focus ?? "graph"
  }
}
