/**
 * WHAT THE PANEL IS BUSY DOING — the decision, in one place, for the two faces
 * that say it.
 *
 * It is one fact and it was being worked out twice. The header has said *is
 * something happening* in its own chrome for a while (`working…` beside the
 * model, `waiting on you` when the turn has stopped on a form), and the strip
 * under the transcript now says it where a person who has just pressed enter is
 * actually looking ({@link ./Busy.tsx}). Two sites deriving one precedence from
 * one cell is two answers free to disagree — and the one that disagrees is the
 * one nobody is looking at, which is the worst way round.
 *
 * So the RULE is here and the WORDING is each face's. The header's slot is two
 * words wide beside a model name and a context readout; the strip has a line to
 * itself under somebody's own message and can name who. Converging those would
 * move pixels rather than unify a spelling — the distinction {@link ./live.ts}
 * already draws for the dot they share.
 *
 * A module for {@link ./face.ts}'s reason, which is the reason half this
 * directory is split this way: this is a small precedence over a state that
 * arrives on a wire, and what it decides is which of three things somebody is
 * told is happening. Reaching it through a browser is not how anybody should
 * have to check that the panel does not say *working* over a form it is waiting
 * on them to fill in.
 */

import { agentIn, type ChatState } from "@olai/surface"

/**
 * The three things the panel can be busy with — and `null`, which is most
 * panels most of the time.
 *
 * WHO is carried where the panel knows and is `null` where it does not, which
 * is the beat before the first agent is bound and the whole of a boot that
 * stopped to ask. A face that has room names them; the header, which already
 * names the agent one slot to the left, does not.
 */
export type Busy =
  /** An agent is starting: a subprocess, a handshake, and a conversation
   *  replayed before there is anything to type into. */
  | { readonly kind: "starting"; readonly agent: string | null }
  /** A turn is in flight and it is the agent's move. */
  | { readonly kind: "working"; readonly agent: string | null }
  /** ... and it is not: the turn has stopped on a question only a person can
   *  answer, and nothing times out. */
  | { readonly kind: "waiting" }

/**
 * Which of the three, or none.
 *
 * A QUESTION OUTRANKS THE TURN it is asked inside, and that is the only
 * ordering here worth stating: `asking` is only ever true while a turn is in
 * flight, so a naive "thinking → working" would swallow it and tell a person to
 * wait for themselves. `booting` and `thinking` are exclusive values of one
 * field and need no rule.
 *
 * `gone` and `off` are deliberately not busy: the header says *not running* or
 * *not configured*, and a live cue over either would be the panel claiming work
 * is happening in a process it can see is not there.
 */
export const busyIn = (state: ChatState): Busy | null => {
  const who = () => agentIn(state)?.name ?? null
  if (state.status === "booting") return { kind: "starting", agent: who() }
  if (state.status !== "thinking") return null
  return state.asking > 0 ? { kind: "waiting" } : { kind: "working", agent: who() }
}
