import { useRouter } from "olai-plugin-navigation/routing"
import { itemOf } from "@olai/format"
import type { Route } from "olai-plugin-navigation/routes"
import { talking, type Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
import { chatRouteOf } from "./route.ts"
/** Opening a conversation marks it visited and unfolds it — under its row, so
 *  the outline it came from still holds the conversation when the reader goes
 *  back, and in the seat at the foot of a note (`./Seat.tsx`), which is keyed
 *  by the same chat id. A chat with no conversation yet has nothing to
 *  unfold. */
export const visitAgent = (row: Row): void => {
  agentReadings()?.visit(row.id)
  if (talking(row)) unfold(row.id)
}
/** WHERE A CHAT OPENS: its own page, `/chat/<item>` (`./route.ts`). The
 *  sidebar's rows, the palette, the pill above a node and a crumb's mark
 *  share this, so none can drift from the others — and a conversation is
 *  opened in one place rather than wherever the thing it is about happens to
 *  draw it. */
export const chatRoute = (row: Row): Route => chatRouteOf(itemOf(row.id))
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
