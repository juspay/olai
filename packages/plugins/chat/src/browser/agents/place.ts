/**
 * WHAT A CHAT ROW STANDS FOR, as the browser reads it — the rule this plugin's
 * every face asks before it draws a conversation somewhere.
 *
 * A chat row with an ordinary title stands for itself. A chat row whose title
 * is an address, bare or as one named link, stands for the place that address
 * opens: `[plan](/notes/plan.md)` is the chat about `notes/plan.md`. The title
 * is read with navigation's own reader (`addressIn`), so a chat row and a pin
 * cannot come to two answers about one title.
 *
 * An address naming something olai does not hold — a file of a kind nobody
 * serves, a file that was deleted, a row that does not exist — stands for
 * nothing, and the chat row is then its own row's chat again. That is the
 * caller's `held`, because which files and rows exist is a reading the caller
 * holds and this module does not.
 *
 * PURE over the router's grammar and that one question, so the rules are a
 * table test (`./place.test.ts`) rather than something a component decides. The
 * server answers the same question with the format's grammar (`@olai/format`'s
 * `placeWritten`), and for files and rows the two agree.
 */
import type { Place } from "@olai/format"
import { addressIn } from "olai-plugin-navigation/address/address.ts"
import { atFile, type Route, type Routing, zoomNode } from "olai-plugin-navigation/routes"

/**
 * THE PLACE A ROUTE OPENS. A row is its id however it was spelled, a file is
 * its path whatever heading it was opened at, and every other page is its
 * address with any filter dropped. The front page names no file of its own, so
 * it is the page `/`; an outline frame that knows which file it is drawing says
 * so itself.
 */
export const placeOfRoute = (routes: Routing, route: Route): Place => {
  if (route.kind === "at") {
    const address = route.address
    if (address === null) return { kind: "page", href: "/" }
    if (address.kind === "node" || address.kind === "row") return { kind: "row", id: address.id }
    return { kind: "file", path: address.path }
  }
  return { kind: "page", href: routes.href(routes.narrowedTo(route, "")) }
}

/** The place a chat row's title stands for, or `null` for a row that stands
 *  for itself. `held` answers whether the place is one olai still has. */
export const standsFor = (
  routes: Routing,
  title: string,
  held: (place: Place) => boolean,
): Place | null => {
  const route = addressIn(routes, title)
  if (route === undefined) return null
  const place = placeOfRoute(routes, route)
  return held(place) ? place : null
}

/** The route that opens a place — what a stand-in's row in the sidebar or the
 *  palette navigates to. A row opens as its own page, the way a chat row's own
 *  page is opened from the same list. */
export const routeOfPlace = (routes: Routing, place: Place): Route =>
  place.kind === "row" ? zoomNode(place.id) : place.kind === "file" ? atFile(place.path) : routes.routeOf(place.href)
