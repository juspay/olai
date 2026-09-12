import { useRouter } from "olai-plugin-navigation/routing"
import { atElement, type Route } from "olai-plugin-navigation/routes"
import type { Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
export const rowOf = (agent: Pick<Row, "id" | "file">): Route => atElement(agent.file, agent.id)
export const createFocus = () => {
  const router = useRouter()
  return { press: (row: Row) => {
    router.go(rowOf(row))
    agentReadings()?.visit(row.id)
    if (row.session !== null) unfold(row.id)
  } }
}
