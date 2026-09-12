import type { Claims } from "@olai/format"
import { servedDirectory } from "../vault.ts"
import { useRouter } from "olai-plugin-navigation/routing"
import { atElement, type Route } from "olai-plugin-navigation/routes"
import type { Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
export const rowOf = (claims: Claims, agent: Pick<Row, "id" | "file">): Route => atElement(claims, agent.file, agent.id)
export const createFocus = () => {
  const router = useRouter()
  return { press: (row: Row) => {
    const claims = servedDirectory()?.claims()
    if (claims === undefined) return
    router.go(rowOf(claims, row))
    agentReadings()?.visit(row.id)
    if (row.session !== null) unfold(row.id)
  } }
}
