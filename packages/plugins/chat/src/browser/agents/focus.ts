import { useRouter } from "olai-plugin-navigation/routing"
import { atNode, type Route } from "olai-plugin-navigation/routes"
import type { Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
/** Opening a conversation marks it visited and unfolds it. */
const visit = (row: Row): void => {
  agentReadings()?.visit(row.id)
  if (row.session !== null) unfold(row.id)
}
/** The palette goes to the agent's row; sidebar anchors carry the same href. */
export const focusAgent = (go: (route: Route) => void, row: Row): void => {
  go(atNode(row.id))
  visit(row)
}
export const createFocus = () => {
  const router = useRouter()
  return { href: (row: Row) => router.routes.href(atNode(row.id)), visit }
}
