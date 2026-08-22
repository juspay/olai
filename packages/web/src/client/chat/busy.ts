/**
 * WHAT THE PANEL IS BUSY DOING, as the one sentence a person reads for it — or
 * `null` when it is not busy at all.
 *
 * Its own module for {@link ./face.ts}'s reason, which is the reason half this
 * directory is split this way: this is a small PRECEDENCE over a state that
 * arrives on a wire, and what it decides is which of three things somebody is
 * told is happening. Reaching it through a browser is not how anybody should
 * have to check that the panel does not say *working* over a form it is waiting
 * on them to fill in.
 *
 * The strip that draws it is {@link ./Busy.tsx}, and why the panel needs one at
 * all is argued there.
 */

import { agentIn, type ChatState } from "@olai/surface"

/**
 * The three things it can be.
 *
 * A QUESTION OUTRANKS THE TURN it is asked inside, and that is the only
 * ordering here worth stating: `asking` is only ever true while a turn is in
 * flight, so a naive "thinking → working" would swallow it and tell a person to
 * wait for themselves. `booting` and `thinking` are exclusive values of one
 * field and need no rule.
 *
 * WHO is named where the panel knows — a machine with two agents installed is
 * one where *the agent* is a question — and left out where it does not, which
 * is the beat before the first agent is bound and the whole of a boot that
 * stopped to ask.
 */
export const busyWith = (state: ChatState): string | null => {
  if (state.status === "booting") {
    const who = agentIn(state)
    return who === null ? "starting…" : `starting ${who.name}…`
  }
  if (state.status !== "thinking") return null
  if (state.asking > 0) return "waiting on your answer"
  const who = agentIn(state)
  return who === null ? "working…" : `${who.name} is working…`
}
