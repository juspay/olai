/**
 * PRESSING A NODE AGENT — what the roster row does, what the door does, and the
 * one difference between them.
 *
 * ## Switching is `loadSession`, and nothing new
 *
 * The panel already knows how to move to a stored conversation: it is the same
 * verb the chats picker sends, with the same pair, and it is a change of AGENT
 * as often as it is a change of conversation (`@olai/surface`'s
 * `chat.loadSession`). A node agent's session is one of those conversations —
 * that is the whole of what the binding says — so focusing one is that verb
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

import type { OpFailure } from "@olai/surface"

import { setChatOpen } from "../layout/prefs.ts"
import type { Route } from "../routes.ts"
import { atElement } from "../routes.ts"
import { run } from "../run.ts"
import { olai } from "../wire.ts"
import type { Row } from "./roster.ts"

/** WHERE A NODE AGENT LIVES — the outline it is written in, at its own row.
 *
 *  `atElement` and not `atNode`: the design's own rule is that the outline
 *  never narrows for this feature, and a node's own page is exactly a narrowing
 *  — it would replace the board a person is reading with one row of it. What
 *  they asked for is *show me this agent*, which is the row in its context. */
export const rowOf = (agent: Pick<Row, "id" | "file">): Route =>
  atElement(agent.file, agent.id)

/**
 * SWITCH THE PANEL to this agent's conversation — and open the panel, because a
 * switch nobody can see is a switch that looks like nothing happened.
 *
 * Does nothing for an agent with no session bound: there is no conversation to
 * open, and the row that pressed it says so in its own words rather than
 * refusing on a click.
 *
 * THE REFUSAL IS THE CALLER'S TO SAY. `run` has no overload without a failure
 * handler, deliberately (`../run.ts`), and a verb that swallowed one would be a
 * press that silently did nothing — which is exactly what a stale binding looks
 * like: the session id in the record names a conversation that agent no longer
 * has, and the answer is a `not-found` a person has to be able to read.
 */
export const focus = (
  agent: Pick<Row, "session">,
  refused: (failure: OpFailure) => void,
): void => {
  const session = agent.session
  if (session === null) return
  setChatOpen(true)
  run(
    olai.procedures.chat.loadSession({ agent: session.agent, id: session.id }),
    refused,
  )
}
