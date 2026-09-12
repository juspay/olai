import { servedDirectory } from "../../vault.ts"
import type { Router } from "olai-plugin-navigation/routing"
import { agentReadings } from "../../agents/reading.ts"
import { needing } from "../../agents/attention-order.ts"
import { rowOf } from "../../agents/focus.ts"
import { unfold } from "../../agents/folding.ts"

/** The notification intentionally identifies no conversation. */
export const createReveal = (router: Router) => {
  return () => {
    const held = agentReadings()
    const first = needing(held?.agents.rows() ?? []).find(row => row.standing === "needs-you")
    if (first === undefined) {
      document.querySelector<HTMLElement>('[data-agent-needs-you]')?.focus()
      return
    }
    held?.visit(first.id)
    const claims = servedDirectory()?.claims()
    if (claims === undefined) return
    router.go(rowOf(claims, first))
    unfold(first.id)
    held?.reveal(first.id)
  }
}
