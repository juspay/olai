import { useRouter } from "olai-plugin-navigation/routing"
import { zoomNode, type Route } from "olai-plugin-navigation/routes"
import type { Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
/** Opening a conversation marks it visited and unfolds its row, so the outline
 *  it came from still holds the conversation when the reader goes back. */
const visit = (row: Row): void => {
  agentReadings()?.visit(row.id)
  if (row.session !== null) unfold(row.id)
}
/** THE CONVERSATION'S OWN PAGE, not the file that holds it: `/zoom/#id`, whose
 *  page IS the conversation. A `/#id` here would reveal the row inside its
 *  outline instead — the report this fixes, where a chat filed under the
 *  Inbox's Chats opened the Inbox with the chat merely selected. Sidebar rows
 *  and the palette share this, so neither can drift from the other. */
export const focusAgent = (go: (route: Route) => void, row: Row): void => {
  go(zoomNode(row.id))
  visit(row)
}
export const createFocus = () => {
  const router = useRouter()
  return { href: (row: Row) => router.routes.href(zoomNode(row.id)), visit }
}
