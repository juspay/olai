import { useRouter } from "olai-plugin-navigation/routing"
import { zoomNode, type Route, type Routing } from "olai-plugin-navigation/routes"
import type { Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
import { useAgents, type Roster } from "./answered.tsx"
import { routeOfPlace } from "./place.ts"
/** Opening a conversation marks it visited and unfolds it — under its row, so
 *  the outline it came from still holds the conversation when the reader goes
 *  back, and in the seat of the page a chat row standing for one is about
 *  (`./Seat.tsx`), which is keyed by the same chat row id. A chat with no
 *  conversation yet has nothing to unfold. */
export const visitAgent = (row: Row): void => {
  agentReadings()?.visit(row.id)
  if (row.session !== null || row.unopened === true) unfold(row.id)
}
/** WHERE A CHAT OPENS: the place a stand-in is about, and an ordinary chat
 *  row's own page — `/zoom/#id`, not the `/#id` reveal. Sidebar rows, the
 *  palette and a crumb's mark share this, so none can drift from the others. */
export const chatRoute = (routes: Routing, roster: Pick<Roster, "placeOf" | "standsIn">, row: Row): Route =>
  roster.standsIn(row) ? routeOfPlace(routes, roster.placeOf(row)) : zoomNode(row.id)
export const focusAgent = (
  nav: { readonly go: (route: Route) => void; readonly routes: Routing },
  roster: Pick<Roster, "placeOf" | "standsIn">,
  row: Row,
): void => {
  nav.go(chatRoute(nav.routes, roster, row))
  visitAgent(row)
}
export const createFocus = () => {
  const router = useRouter()
  const roster = useAgents()
  return {
    href: (row: Row) => router.routes.href(chatRoute(router.routes, roster, row)),
    visit: visitAgent,
  }
}
