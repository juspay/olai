/**
 * PRESSING A NODE AGENT — what the roster row does, what the door does, and the
 * one difference between them.
 *
 * ## Switching is `loadSession`, and nothing new
 *
 * The panel already knows how to move to a stored conversation: it is the same
 * verb every list of conversations sends, with the same pair, and it is a change of AGENT
 * as often as it is a change of conversation (`@olai/surface`'s
 * `chat.loadSession`). A node agent's session is one of those conversations —
 * that is the whole of what the property says — so focusing one is that verb
 * with the pair read off the roster row, and there is no second way to open a
 * conversation anywhere in this app.
 *
 * IT DOES NOT GO THROUGH `../chat/state.ts`. That module is the panel's own
 * subscription — the transcript, the growing row, the drafts — and a second one
 * of it, mounted in the sidebar so that a row could call one verb, would be a
 * second copy of the conversation being folded per frame for a button. What is
 * needed here is a procedure and the client's one Effect edge (`../run.ts`).
 *
 * ## What a press MEANS, which is one thing said in two places
 *
 * *Take me to this agent.* An agent is a node and a conversation, so a press
 * from the SIDEBAR does both: it opens the node's own outline at that row, and
 * it switches the panel to the conversation. Every other row of that column
 * navigates, and one that did not would be the odd one; and a person who has
 * just pressed an agent wants to see what it has been writing, which is its
 * subtree.
 *
 * A press on the DOOR switches the panel and navigates nowhere, because the
 * reader is already standing on the node — navigating would be a page reload
 * onto the page they are on, taking their scroll position with it.
 *
 * ## An UNBOUND agent presses too
 *
 * A row with no session cannot switch anything, and it is still pressable from
 * the sidebar: it goes to the node. A control that did nothing at all would be
 * a dead row on a list whose whole job is to be pressed, and where the row can
 * only do half of what it means, it does that half. The door on an unbound
 * node's row is the case where there IS no half — the reader is already there
 * — so it draws no press at all (`./Door.tsx`).
 */

import { useRouter } from "olai-plugin-navigation/routing"
import { atElement, type Route } from "olai-plugin-navigation/routes"
import { createSaying } from "@olai/web/client/saying.ts"
import type { Row } from "./roster.ts"
import { unfold } from "./folding.ts"
import { agentReadings } from "./reading.ts"
export const rowOf = (agent: Pick<Row, "id" | "file">): Route => atElement(agent.file, agent.id)
export const createFocus = () => {
  const router = useRouter()
  const saying = createSaying()
  return { said: saying.said, press: (row: Row) => {
    router.go(rowOf(row))
    agentReadings()?.visit(row.id)
    if (row.session !== null) unfold(row.id)
  } }
}
