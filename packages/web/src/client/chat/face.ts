/**
 * WHICH BODY the panel draws — the conversation, or one of the two explanations
 * that stand in for it.
 *
 * The panel has always had two, and the second is the argument for all of them:
 * with no agent configured it DRAWS ANYWAY and says so ({@link ./NoAgent.tsx}),
 * because a capability that is silently absent cannot be told apart from one
 * that is broken. A conversation the agent REFUSED TO OPEN is the same shape of
 * fact arriving a layer later — the agent is there, it answered, and what it
 * answered was no — and it used to reach the reader as the header saying *not
 * running* about a live process, with an empty transcript underneath.
 *
 * A MODULE rather than a ternary in the component that draws them, for the
 * reason {@link ./lanes.ts} and {@link ./when.ts} are: this is a PRECEDENCE, it
 * has already been re-decided once, and what it decides is which of three
 * things a person is looking at. Reaching it through a browser is not how
 * anybody should have to check that a face does not outlive its cause.
 *
 * It answers with the REASON attached rather than with a word the caller then
 * looks the reason up for. That is `laneOf`'s own lesson one file over: two
 * questions asked separately are two answers free to disagree, and the arm that
 * needs a payload is exactly the arm where a `null` would have to be asserted
 * away at the point it is drawn.
 */

import type { ChatState, Unopened } from "@olai/surface"

/**
 * WHAT THIS TAB HAS DECIDED — the two bodies the SERVER knows nothing about.
 *
 * Both are a person part-way through a gesture rather than a state of the
 * panel: a second tab goes on showing whatever conversation it was in. They
 * arrive here as an argument rather than being read from a signal, so this
 * stays a function of its inputs and the precedence stays assertable without a
 * browser — and so the ORDER between them and the cell's own faces is written
 * down in one place instead of half here and half in the JSX that draws them.
 */
export interface Showing {
  /** The chats no node agent claims, opened from the roster's last row
   *  (`../agents/showing.ts`). */
  readonly unassigned: boolean
  /** ... and `+ new` having asked which agent, in this tab. */
  readonly asking: boolean
}

/** The five things the panel's body can be. */
export type Face =
  /** This machine has no agent at all — none installed, or chat switched off.
   *  Nothing was attempted, so nothing was refused; what is owed is the
   *  explanation and how to get one. */
  | { readonly kind: "no-agent" }
  /** The conversations no node claims, and the gesture that gives one a node
   *  (`../agents/Unassigned.tsx`). Not a conversation at all, which is why it
   *  outranks every face below it: somebody asked for this and nothing else. */
  | { readonly kind: "unassigned" }
  /** The agent is running and would not open a conversation. */
  | { readonly kind: "unopened"; readonly unopened: Unopened }
  /**
   * There are several agents and nobody has said which this conversation is
   * with. The panel asks, and holds no conversation until it is answered.
   *
   * WHO ASKED is on the arm, because it is what the question's way out depends
   * on: the SERVER's has none — there is no conversation behind it to go back
   * to — and this TAB's does, since the conversation underneath is still open
   * and a misclick must not be a one-way door. Carried here rather than
   * re-derived where the body is drawn, which was two reads of one fact.
   */
  | { readonly kind: "choose"; readonly asked: "server" | "tab" }
  /** The ordinary panel: the transcript and the box. */
  | { readonly kind: "conversation" }

/**
 * Which of the three this state is.
 *
 * TWO STATUSES OUTRANK A REFUSAL, and both for one reason: `unopened` says *the
 * agent is running and would not open a conversation*, and neither of them is a
 * panel where the first half of that sentence is true.
 *
 *   - **`off`** — no agent is configured, so nothing was attempted and nothing
 *     was refused.
 *   - **`gone`** — the agent is not there any more. Its body is the
 *     CONVERSATION, deliberately: the rows a dead agent left are kept on screen
 *     to read, with `trouble` under them saying what happened. A refusal that
 *     outlived the process it was about would put "the agent itself is running
 *     — it answered" over a panel whose header says otherwise.
 *
 * The cell drops `unopened` at both of those too (`../../../../chat/src/chat.ts`),
 * so this is the second of two answers rather than the only one — and it is
 * worth being the second, because the cell is a VALUE THAT ARRIVES OVER A WIRE
 * and a precedence stated only in the writer is one a reader can meet in the
 * other order. The path that needs it: an agent that dies without ever exiting
 * cleanly — a spawn that fails on a retry — sets `gone` from the verb that
 * failed rather than from the process going, and no event fires to clear a
 * refusal recorded before it.
 *
 * BOOTING DOES NOT, and that is the one arm where the two orders differ. A
 * panel still starting has `unopened: null` and is the conversation, which is
 * the first paint; a panel RETRYING a refused open is `booting` with the
 * refusal still on it, and what a person is owed there is the thing they just
 * pressed still saying what it was about. Nothing has changed yet.
 *
 * AND THE QUESTION OUTRANKS THE CONVERSATION, but nothing else. `choosing` says
 * *there are several agents and nobody has said which this conversation is
 * with*, which is only ever true when there is no conversation — so it sits
 * under both statuses above and under a refusal, and above the empty transcript
 * it would otherwise be drawn as. The empty transcript is the face this
 * replaces, and it is exactly the wrong one: a box you can type into, over a
 * conversation nobody has opened, for an agent nobody has named.
 *
 * ## WHERE THIS TAB'S OWN TWO SIT ({@link Showing})
 *
 * THE UNASSIGNED LIST sits second, under `off` and over everything else, and
 * both halves are the same fact: a serve with no agent has no conversations to
 * list, and every face below is a state of a CONVERSATION — which this
 * deliberately is not. Somebody who pressed *Unassigned* asked for that and
 * nothing else, and a panel that answered with the question of which agent to
 * open a new chat with would be answering a question nobody asked.
 *
 * THE TAB'S OWN `+ new` QUESTION sits LAST, under the server's own: the
 * server's is a state the panel is in and outranks anything a click here
 * started. Read the other way round, a `+ new` pressed over a panel that was
 * ALREADY asking would answer the boot's question with the wrong verb — minting
 * a fresh conversation where the panel was about to come back to the one this
 * directory was in.
 */
export const faceOf = (state: ChatState, showing: Showing): Face => {
  if (state.status === "off") return { kind: "no-agent" }
  if (showing.unassigned) return { kind: "unassigned" }
  const unopened = state.unopened
  if (unopened !== null && state.status !== "gone") return { kind: "unopened", unopened }
  if (state.talking?.kind === "asking") return { kind: "choose", asked: "server" }
  return showing.asking ? { kind: "choose", asked: "tab" } : { kind: "conversation" }
}

/** What a panel showing neither of this tab's own bodies is looking at — the
 *  ordinary case, and the value every reading that is only about the cell
 *  passes. */
export const NOTHING_SHOWN: Showing = { unassigned: false, asking: false }
