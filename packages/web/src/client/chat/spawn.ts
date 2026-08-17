/**
 * What a call that SENT AN AGENT OUT says for itself, before the agent says
 * anything.
 *
 * {@link ./lanes.ts} is the other half of drawing a fan-out and it can only
 * answer about work that has already happened: a lane is a row a subagent
 * MADE, so an agent that is still reading its instructions has no lane, no
 * rail and no name anywhere on screen. During a fan-out that is the whole of
 * the stretch a person is watching — the human's screenshot was three agents
 * out and a panel showing one pending dot with an ordinary title on it,
 * indistinguishable from a `Read` that had been slow.
 *
 * So the frame that spawns an agent gets a face of its own, and this file is
 * what that face says. Three things, and every one of them comes off the wire
 * rather than out of a guess:
 *
 *   - **who it is** — the kind of agent, in whatever words whoever configured
 *     it used ({@link ../../../../surface/src/chat.ts}'s `Spawned`), or the
 *     bare word when the spawn named none;
 *   - **what it was asked** — the frame's own title, which for this adapter is
 *     the description the call was made with, with the prompt itself one fold
 *     away. Neither is decided here: the row already draws them, and it draws
 *     them for a spawn exactly as it draws them for anything else;
 *   - **that it is running** — {@link Face.doing}, which is the agent's own
 *     status put into a word, and `null` the moment the call stops.
 *
 * A PURE FUNCTION over one row, the way `./lanes.ts` and `./when.ts` are, and
 * for their reason: what a face is allowed to claim is exactly the kind of
 * thing that gets re-decided by looking at it, and a rule you expect to
 * re-decide is one worth being able to re-decide in one place and to assert
 * without starting an agent. Two callers read it — the row draws WHO, the list
 * draws the live rail underneath — and they must not be able to disagree about
 * whether a row is a spawn at all.
 */

import type { ChatEntry } from "@olai/surface"

/** A spawn's face: who was sent, and what they are doing. */
export interface Face {
  /**
   * The kind of agent, as the agent names its own.
   *
   * Always a word, which is the difference between this and the
   * `Spawned.kind` it is read from: a spawn that named no kind still started
   * somebody, and a row saying nothing where every other spawn says something
   * reads as a row that failed rather than as an agent nobody labelled.
   */
  readonly who: string
  /**
   * What it is doing, in a word — or `null` once it has stopped, which is a
   * face with nothing left to say and the cue to stop drawing the live half.
   *
   * THE WORD, not a flag saying a word is owed: `./lanes.ts`'s `label` learned
   * that one edit ago. There are two of them and the difference between them
   * is the agent's own status rather than a shade of meaning invented here —
   * a call the agent calls `pending` has been announced and not yet reported
   * on, and saying it is working would be this panel claiming something the
   * agent did not.
   */
  readonly doing: string | null
}

/**
 * The face of the row, or `null` for a row that spawned nobody — which is
 * every row in a conversation where nothing was ever sent out.
 *
 * `undefined` for the row is answered `null` too, for `laneOf`'s reason: the
 * list holds keys and reads their values a frame behind, so "which row" is a
 * question that can be asked about nothing.
 */
export const faceOf = (entry: ChatEntry | undefined): Face | null => {
  const spawned = entry?.spawned
  if (spawned === undefined) return null
  return {
    who: spawned.kind ?? SOMEBODY,
    // `pending` is the status a spawn is ANNOUNCED with and the one it keeps
    // until the agent's first beat, so it is the status most spawns wear for
    // the longest — the default, and not an edge case to fall through to.
    doing: DOING[entry?.status ?? "pending"] ?? null,
  }
}

/** What a spawn is called when it named no kind of agent. The `Agent` tool's
 *  own `subagent_type` is optional, so this is an ordinary spawn rather than a
 *  broken one, and the honest thing to say about it is the category. */
const SOMEBODY = "agent"

/** The agent's own status, in the word a person reads. Only the two live ones
 *  are here: a call that has completed or failed has no live half, and is
 *  drawn by the mark and the report the frame already carries. */
const DOING: { readonly [status: string]: string } = {
  pending: "starting…",
  in_progress: "working…",
}
