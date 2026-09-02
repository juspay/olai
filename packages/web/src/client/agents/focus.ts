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

import { setChatOpen } from "../layout/prefs.ts"
import { atElement, type Route } from "../routes.ts"
import { useRouter } from "../router.tsx"
import { run } from "../run.ts"
import { createSaying, type Saying } from "../saying.ts"
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
 * THE GESTURE, AND THE LINE IT MAY LEAVE — held together, because they are one
 * thing: a press either takes you to the agent or it says why it could not.
 *
 * ONE MODULE FOR BOTH FACES. The two of them were spelling the same three lines
 * apiece — clear the line, do the verb, word the refusal — and the wording was
 * the part that mattered and the part most likely to drift: a stale binding
 * names a conversation the agent no longer has, and *that* is the sentence a
 * person needs, because only editing the record can fix it. A gesture whose
 * refusal is worded at each caller is a gesture that says two different things
 * about one failure.
 *
 * THE SAYING IS THE CALLER'S LIFETIME. Called in the owner the LINE belongs to
 * ({@link ../saying.ts}) — the section for the sidebar, the door's own wrapper
 * for a row — so a line outlives the row it was about and not the surface.
 */
export interface Focus {
  /** What the last press said, or `null` — drawn by whichever face owns it. */
  readonly said: Saying["said"]
  /**
   * SWITCH THE PANEL to this agent's conversation, and open the panel, because
   * a switch nobody can see is a switch that looks like nothing happened.
   *
   * Does nothing for an agent with no session bound: there is no conversation
   * to open, and the row that pressed it already says so in its own words
   * rather than refusing on a click.
   */
  readonly open: (agent: Row) => void
  /** ...and the sidebar's whole gesture: the node's page AND its conversation
   *  (see this file's header on why one press means both). */
  readonly press: (agent: Row) => void
}

export const createFocus = (): Focus => {
  const saying = createSaying()
  const router = useRouter()

  const open = (agent: Row) => {
    saying.say(undefined)
    const session = agent.session
    if (session === null) return
    setChatOpen(true)
    // BOTH HALVES, because a session id means nothing to the wrong agent: the
    // row carries the engine the property named beside the session it named,
    // and the pair is what opens one.
    //
    // `run` HAS NO OVERLOAD WITHOUT A FAILURE HANDLER, deliberately
    // (`../run.ts`), and a press that swallowed one would be a press that
    // silently did nothing.
    run(
      olai.procedures.chat.loadSession({ agent: agent.engine, id: session }),
      (failure) => saying.say({ tone: "alarm", text: failure.message, kind: failure._tag }),
    )
  }

  return {
    said: saying.said,
    open,
    press: (agent) => {
      router.go(rowOf(agent))
      open(agent)
    },
  }
}
