import type { Router } from "olai-plugin-navigation/routing"
import { agentReadings } from "../../agents/reading.ts"
import { needing } from "../../agents/attention-order.ts"
import { zoomNode } from "olai-plugin-navigation/routes"
import { unfold } from "../../agents/folding.ts"

/** The notification intentionally identifies no conversation.
 *
 *  IT LANDS ON THE CONVERSATION'S OWN PAGE (`/zoom/#id`), which is where a
 *  conversation is read without its outline — the same page the Chats row and
 *  the palette open, so a press here and a press there cannot lead to two
 *  different places for one agent. The conversation there is the PAGE's
 *  reading, owned by the pane's page owner and released with it; it is not the
 *  outline row's fold, whose file the reader no longer goes to.
 *
 *  The row's fold is still unfolded: that is tab-local memory of "this
 *  conversation is open", so going back to the outline shows it as the reader
 *  left it. And `reveal` is not the fold either — it is chat's request that the
 *  surface on screen show the line that needs the person, which
 *  `agents/reading.ts` holds until the page's view arrives and applies then. */
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
