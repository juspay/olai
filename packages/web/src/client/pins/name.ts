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
 * ## Not `../pane/label.ts`, and the placement was argued rather than assumed
 *
 * That module names a PANE and this one names a DOOR, and they are two total
 * switches over one `Route` — which is the shape to justify, because "name a
 * route" is one kind of operation and a second table for it is how concepts
 * multiply. Three things decide it:
 *
 *   - **they answer differently, not just more.** A pane label is asked of the
 *     route ALONE, deliberately, so a tab strip has a label before the set has
 *     been read and keeps it when a file will not parse — which is why a zoomed
 *     node there is its id. A door with an id written on it is a door nobody
 *     can read, so this one is asked of the set. And a pane draws a file's
 *     whole PATH (two panes on `a/x.olai` and `b/x.olai` have to be tellable
 *     apart) where a shelf row draws its NAME, in a column too narrow for
 *     either path.
 *   - **so unifying them needs a mode flag**, and a mode flag is the braid
 *     rather than the fix: one function answering "short or long, with the set
 *     or without" is two callers' layouts pushed into one signature.
 *   - **and the axis they share is held by the COMPILER already.** What is
 *     volatile about a route is the union itself, and both switches are total
 *     over it, so a seventh kind of page is two compile errors rather than one
 *     table quietly falling behind the other.
 *
 * Where the set has nothing to say — a pin to a node that was archived or
 * deleted — this answers the ADDRESS, which is at least the truth about where
 * the pin goes.
 */

import { basenameOf, type Derived, nodeNamed } from "@olai/format"

import { hrefOf, type Route } from "../routes.ts"
import type { Pin } from "./pins.ts"

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
      // it. Every other outline is its own name, through the format's own
      // spelling of "the last segment of a path" (`basenameOf`) rather than a
      // second slice here.
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

/**
 * What one SHELF ROW says — the name somebody gave the pin, or the one the set
 * answers with.
 *
 * One line, and it is here rather than at the row that draws it because it is
 * the rule rather than the drawing: *a name written on a pin is somebody's and
 * wins; a bare address is called whatever the set calls it right now*
 * (`./pins.ts` argues why only one of those two can be stored). Spelled in a
 * component, that rule would be a fact about pins living in a `<li>`, and the
 * second surface that ever draws a pin would spell it again.
 */
export const shelfName = (pin: Pin, derived: Derived | undefined): string =>
  pin.named ?? nameOf(pin.route, derived)
