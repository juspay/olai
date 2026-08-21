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

import { isRunning } from "./running.ts"

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
 * that one edit ago.
 *
 * ONE WORD, and it used to be two. `pending` became *starting…* and
 * `in_progress` became *working…*, on the reading that a call the agent has
 * not reported on is one that has not got going — and that reading is wrong
 * twice over. The adapter emits `status: "pending"` on the announcement of
 * EVERY tool call, so it means "announced" rather than "not started"; the
 * subagent is dispatched immediately, and what the panel is actually reporting
 * with *starting…* is its own ignorance, dressed as a fact about somebody
 * else's agent. And the beat that would correct it is a heartbeat: a subagent
 * that had been grepping for twenty seconds, with its calls drawn in the lane
 * DIRECTLY BELOW this rail, went on being described as starting until one
 * arrived. A word that contradicts the rows under it is worse than no word.
 *
 * So the two only ever differed in the case the lane itself already answers —
 * there are rows under the rail or there are not — and being redundant there
 * was the good half of it. What is left is the fact this rail exists to carry:
 * an agent was sent out and has not come back.
 *
 * TWO THINGS HAVE TO BE TRUE, and the second is the one a row cannot see. A
 * spawn's status is STICKY, and the transcript is not cleared when an agent
 * dies — deliberately, so the rows a dead conversation left are still there to
 * read. So a subprocess that died between announcing an `Agent` call and
 * reporting on it leaves that row `pending` for as long as the panel is open,
 * and a rail that asked the row alone would go on pulsing "working…" under a
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
  // `pending` is what a spawn is ANNOUNCED with and what most of them wear for
  // most of their lives, so it is a RUNNING state rather than a case to fall
  // through, and a row nothing has said about yet is taken to be wearing it.
  // Both of those are {@link ./running.ts}'s to say now — the elapsed readout
  // on this same row asks the same question, and the frame draws the same
  // field.
  return isRunning(entry) ? WORKING : null
}

/** What a spawn is called when it named no kind of agent. The `Agent` tool's
 *  own `subagent_type` is optional, so this is an ordinary spawn rather than a
 *  broken one, and the honest thing to say about it is the category. */
const SOMEBODY = "agent"

/** What the rail says while an agent is out. */
const WORKING = "working…"
