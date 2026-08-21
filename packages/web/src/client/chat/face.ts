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

/** The three things the panel's body can be. */
export type Face =
  /** No ACP agent is configured at all. Nothing was attempted, so nothing was
   *  refused; what is owed is the explanation and the variable that fixes it. */
  | { readonly kind: "no-agent" }
  /** The agent is running and would not open a conversation. */
  | { readonly kind: "unopened"; readonly unopened: Unopened }
  /** The ordinary panel: the transcript and the box. */
  | { readonly kind: "conversation" }

/**
 * Which of the three this state is.
 *
 * NO AGENT WINS, and that ordering is not arbitrary: `unopened` is a fact about
 * an agent that answered, so a panel with no agent cannot have one — but the
 * cell is a value that arrives over a wire, and a precedence stated here is one
 * that cannot be got wrong by a reader of the two fields who meets them in the
 * other order.
 *
 * BOOTING IS THE CONVERSATION, deliberately. A panel that swapped its whole
 * body out while the agent was starting would flash an explanation at somebody
 * every time they opened the drawer — and `unopened` is a state that has
 * SETTLED, which is what separates it from one that is still in progress.
 */
export const faceOf = (state: ChatState): Face => {
  if (state.status === "off") return { kind: "no-agent" }
  const unopened = state.unopened
  return unopened === null ? { kind: "conversation" } : { kind: "unopened", unopened }
}
