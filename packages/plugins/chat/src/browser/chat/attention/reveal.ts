import type { Router } from "olai-plugin-navigation/routing"
import { agentReadings } from "../../agents/reading.ts"
import { needing } from "../../agents/attention-order.ts"
import { zoomNode } from "olai-plugin-navigation/routes"
import { unfold } from "../../agents/folding.ts"

/** The notification intentionally identifies no conversation. It lands on the
 *  conversation's own page (`/zoom/#id`), the same page the rows open; `unfold`
 *  is the outline's tab-local memory, and `reveal` is held by
 *  `agents/reading.ts` until a view is shown. */
export const createReveal = (router: Router) => {
  return () => {
    const held = agentReadings()
    const first = needing(held?.agents.rows() ?? []).find(row => row.standing === "needs-you")
    if (first === undefined) {
      held?.focusNeeds()
      return
    }
    held?.visit(first.id)
    router.go(zoomNode(first.id))
    unfold(first.id)
    held?.reveal(first.id)
  }
}
