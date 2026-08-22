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
 */
export const faceOf = (state: ChatState): Face => {
  if (state.status === "off") return { kind: "no-agent" }
  const unopened = state.unopened
  return unopened === null || state.status === "gone"
    ? { kind: "conversation" }
    : { kind: "unopened", unopened }
}
