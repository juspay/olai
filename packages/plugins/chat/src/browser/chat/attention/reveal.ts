import type { Router } from "olai-plugin-navigation/routing"
import { agentReadings } from "../../agents/reading.ts"
import { needing } from "../../agents/attention-order.ts"
import { atNode } from "olai-plugin-navigation/routes"
import { unfold } from "../../agents/folding.ts"

/** The notification intentionally identifies no conversation. */
export const createReveal = (router: Router) => {
  return () => {
    const held = agentReadings()
    const first = needing(held?.agents.rows() ?? []).find(row => row.standing === "needs-you")
    if (first === undefined) {
      held?.focusNeeds()
      return
    }
    held?.visit(first.id)
    router.go(atNode(first.id))
    unfold(first.id)
    held?.reveal(first.id)
  }
}
