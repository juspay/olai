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
import { type Place, samePlace } from "@olai/format"
import { addressIn } from "olai-plugin-navigation/address/address.ts"
import { atFile, fileNamed, type Route, type Routing, zoomNode } from "olai-plugin-navigation/routes"

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

/** The place a chat row's title is written as, or `null` for a title that is
 *  no address (a row that stands for itself). Whether olai still has that
 *  place is the roster's question (`./answered.tsx`), asked of the readings
 *  it holds. */
export const placeIn = (routes: Routing, title: string): Place | null => {
  const route = addressIn(routes, title)
  return route === undefined ? null : placeOfRoute(routes, route)
}

/** The route that opens a place — what a stand-in's row in the sidebar or the
 *  palette navigates to. A row opens as its own page, the way a chat row's own
 *  page is opened from the same list. */
export const routeOfPlace = (routes: Routing, place: Place): Route =>
  place.kind === "row" ? zoomNode(place.id) : place.kind === "file" ? atFile(place.path) : routes.routeOf(place.href)

/**
 * THE PAGE IN FRONT, as a place — what a lit row and a tab's dot compare a
 * chat's place against.
 *
 * Not quite {@link placeOfRoute}, and the difference is which page is DRAWN.
 * `house.olai#install` names the row `install` when it is a title, and it is a
 * row's own place; as the address of a pane it is the outline `house.olai`,
 * landed at that row, so the page in front is the file. The front page names
 * no file, so the file the pane reported drawing stands in for it where one
 * was reported.
 */
export const pageInFront = (routes: Routing, route: Route, reported?: string): Place => {
  if (route.kind === "at" && route.address?.kind === "row") return { kind: "file", path: route.address.path }
  if (route.kind === "at" && route.address === null && reported !== undefined) return { kind: "file", path: reported }
  return placeOfRoute(routes, route)
}

/**
 * IS `route` THE PAGE A CHAT ROW IS ABOUT? Its PLACE is in front (a stand-in's
 * file or page; a row chat's own page), or — the rule a row chat always had —
 * its outline is in front with the conversation unfolded on its row. What the
 * sidebar lights a **Chats** row by, and what a tab's dot follows (offered to
 * the tabs row as `chat.state`'s `isCurrent`).
 */
export const isCurrent = (
  routes: Routing,
  route: Route,
  row: { readonly id: string; readonly file: string },
  place: Place,
  unfolded: boolean,
  reported?: string,
): boolean =>
  samePlace(pageInFront(routes, route, reported), place)
    || (route.kind === "at" && route.address?.kind === "node" && route.address.id === row.id)
    || (place.kind === "row" && place.id === row.id && unfolded && fileNamed(route) === row.file)
