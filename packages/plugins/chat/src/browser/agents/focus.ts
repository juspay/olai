import { useRouter } from "olai-plugin-navigation/routing"
import { itemOf } from "@olai/format"
import type { Route } from "olai-plugin-navigation/routes"
import { talking, type Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
import { routeOfItem } from "./here.ts"
/** Opening a conversation marks it visited and unfolds it — under its row, so
 *  the outline it came from still holds the conversation when the reader goes
 *  back, and in the seat at the foot of a note (`./Seat.tsx`), which is keyed
 *  by the same chat id. A chat with no conversation yet has nothing to
 *  unfold. */
export const visitAgent = (row: Row): void => {
  agentReadings()?.visit(row.id)
  if (talking(row)) unfold(row.id)
}
/** WHERE A CHAT OPENS: a note's chat opens its note, a node's opens the node's
 *  own page — `/zoom/#id`, not the `/#id` reveal (`./here.ts`). Sidebar rows,
 *  the palette and a crumb's mark share this, so none can drift from the
 *  others. */
export const chatRoute = (row: Row): Route => routeOfItem(itemOf(row.id))
export const focusAgent = (nav: { readonly go: (route: Route) => void }, row: Row): void => {
  nav.go(chatRoute(row))
  visitAgent(row)
}
export const createFocus = () => {
  const router = useRouter()
  return {
    href: (row: Row) => router.routes.href(chatRoute(row)),
    visit: visitAgent,
  }
}
