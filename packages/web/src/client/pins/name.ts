/**
 * WHAT A PINNED ADDRESS IS CALLED — the name the shelf draws when nobody wrote
 * one on the pin.
 *
 * It is a reading of the SET rather than a property of the address, and that
 * is the point: a pin stores where it goes and nothing else (`./pins.ts`), so
 * `/n/herbs` is called whatever that node is called RIGHT NOW. Rename the node
 * anywhere — in the tree, from an agent, in vim — and the shelf says the new
 * name on the frame the store publishes, because there was never a second copy
 * of it to go stale.
 *
 * NOT `../pane/label.ts`, and the difference is worth stating because the two
 * answer questions that sound alike. That one names a PANE: it is asked of the
 * route alone, deliberately, so a tab strip has a label before the set has been
 * read and keeps it when a file will not parse — which is why a zoomed node
 * there is its id. This one is asked of the set, because a door with an id
 * written on it is a door nobody can read; and where the set has nothing to say
 * (a pin to a node that was archived or deleted) it answers the ADDRESS, which
 * is at least the truth about where the pin goes.
 */

import { type Derived, nodeNamed } from "@olai/format"

import { filterOf, hrefOf, type Route } from "../routes.ts"

/** The last segment of a path — what a file is CALLED, as the sidebar's tree
 *  calls it (`../fileTree.ts`), rather than the whole path a route spells. A
 *  shelf is narrow and a document three directories down is still its own
 *  name. */
const basenameOf = (file: string): string => file.slice(file.lastIndexOf("/") + 1)

/**
 * The name of the page an address opens.
 *
 * TOTAL over the route union, so a seventh kind of page is a compile error
 * here rather than a pin that silently draws its own URL.
 */
export const nameOf = (route: Route, derived: Derived | undefined): string => {
  switch (route.kind) {
    case "node": {
      // The node at the end of whatever chain the id addresses — the set's one
      // answer to "what does this id mean" (`@olai/format`'s `nodeNamed`), the
      // same one a `see` link's text comes from. A pin at an id nothing
      // declares says the address rather than a blank: the row is still a
      // door, it just no longer opens on anything, and that is a fact the
      // reader should be able to see rather than a row that quietly says
      // nothing.
      const shows = derived === undefined ? undefined : nodeNamed(derived, route.id)
      return shows?.node.title ?? hrefOf({ kind: "node", id: route.id })
    }
    case "outline":
      // `null` is the front page — "whichever outline was found first" — and it
      // has no filename to draw, so it takes the word a reader would use for
      // it. Every other outline is its own name.
      return route.file === null ? "Home" : basenameOf(route.file)
    case "document":
      return basenameOf(route.file)
    case "day":
      return route.date
    case "today":
      return "Today"
    case "agenda":
      return "Agenda"
    case "trash":
      return "Trash"
  }
}

/** What the page is NARROWED by, drawn as its own chip beside the name — empty
 *  for a pin to a whole page. Read off the route through the one function that
 *  answers it (`../routes.ts`), so the shelf cannot disagree with the filter bar
 *  about what a page is filtered by. */
export const narrowingOf = (route: Route): string => filterOf(route)
