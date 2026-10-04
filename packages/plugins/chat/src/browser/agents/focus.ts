import type { Claims } from "@olai/format"
import { servedDirectory } from "../vault.ts"
import { useRouter } from "olai-plugin-navigation/routing"
import { atNode, type Route } from "olai-plugin-navigation/routes"
import type { Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
export const rowOf = (claims: Claims, agent: Pick<Row, "id" | "file">): Route => atNode(agent.id)
/** The navigation action owns returning to current history and unfolding.
 * Sidebar and palette retain their own selection/closing presentation.
 */
export const focusAgent = (go: (route: Route) => void, row: Row): boolean => {
  const claims = servedDirectory()?.claims()
  if (claims === undefined) return false
  go(rowOf(claims, row))
  agentReadings()?.visit(row.id)
  if (row.session !== null) unfold(row.id)
  return true
}
export const createFocus = () => {
  const router = useRouter()
  return { href: (row: Row) => router.routes.href(atNode(row.id)), visit: (row: Row) => { agentReadings()?.visit(row.id); if (row.session !== null) unfold(row.id) } }
}
