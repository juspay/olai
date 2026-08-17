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
 *   - **that it is running** — {@link doingOf}, which is the agent's own
 *     status put into a word, and `null` the moment either the call or the
 *     conversation stops.
 *
 * PURE FUNCTIONS over a row, the way `./lanes.ts` and `./when.ts` are, and for
 * their reason: what a face is allowed to claim is exactly the kind of thing
 * that gets re-decided by looking at it, and a rule you expect to re-decide is
 * one worth being able to re-decide in one place and to assert without
 * starting an agent. Two callers read them — the row draws WHO, the list draws
 * the live rail underneath — and being two readings of one field in one module
 * is what stops them disagreeing about whether a row is a spawn at all.
 */

import type { ChatEntry } from "@olai/surface"

/**
 * WHO the call sent out, or `null` for a row that sent nobody — which is every
 * row in a conversation where nothing was ever spawned.
 *
 * Always a word for a spawn, which is the difference between this and the
 * `Spawned.kind` it is read from: a spawn that named no kind still started
 * somebody, and a row saying nothing where every other spawn says something
 * reads as a row that failed rather than as an agent nobody labelled.
 *
 * `undefined` for the row is answered `null` too, for `laneOf`'s reason: the
 * list holds keys and reads their values a frame behind, so "which row" is a
 * question that can be asked about nothing.
 */
export const whoOf = (entry: ChatEntry | undefined): string | null => {
  const spawned = entry?.spawned
  return spawned === undefined ? null : spawned.kind ?? SOMEBODY
}

/**
 * What that agent is DOING, in a word — or `null` for a row with no live half
 * left, which is the cue to draw no rail at all.
 *
 * THE WORD, not a flag saying a word is owed: `./lanes.ts`'s `label` learned
 * that one edit ago. There are two of them and the difference between them is
 * the agent's own status rather than a shade of meaning invented here — a call
 * the agent calls `pending` has been announced and not yet reported on, and
 * saying it is working would be this panel claiming something the agent did
 * not.
 *
 * TWO THINGS HAVE TO BE TRUE, and the second is the one a row cannot see. A
 * spawn's status is STICKY, and the transcript is not cleared when an agent
 * dies — deliberately, so the rows a dead conversation left are still there to
 * read. So a subprocess that died between announcing an `Agent` call and
 * reporting on it leaves that row `pending` for as long as the panel is open,
 * and a rail that asked the row alone would go on pulsing "starting…" under a
 * process that no longer exists. That is the exact failure this file was
 * written against, arriving from the other end: a face that outlived its
 * agent. Whether anything is running at all is the CONVERSATION's answer, so
 * the conversation is asked.
 *
 * A BOOLEAN, handed in, rather than the state read here: the rule stays a
 * function of its arguments, which is what lets a dead agent be a unit test
 * rather than a subprocess somebody has to kill at the right moment. It is the
 * same arrangement `laneOf` has with the transcript's lookup.
 *
 * @param entry the row being drawn
 * @param live whether a turn is in flight in this conversation at all
 */
export const doingOf = (
  entry: ChatEntry | undefined,
  live: boolean,
): string | null => {
  if (!live || entry?.spawned === undefined) return null
  // `pending` is the status a spawn is ANNOUNCED with and the one it keeps
  // until the agent's first beat, so it is the status most spawns wear for the
  // longest — the default, and not an edge case to fall through to.
  return DOING[entry.status ?? "pending"] ?? null
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
