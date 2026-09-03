/**
 * WHAT A CALL LEFT RUNNING — the face of a background task, and the one thing
 * on this panel that is still true after the turn is over.
 *
 * The motivating incident is on the roadmap and it is not a rendering
 * complaint: an orchestrator armed `kolu watch … --nag 10m` as a persistent
 * `Monitor` and supervised a whole dispatch off its events, and the panel
 * showed none of it. No arming, no liveness, no death. The human had to ask
 * "how do you know you are babysitting right now?" — and the answer, a pid and
 * an event cadence, existed only in the agent's prose.
 *
 * Three sentences are worth saying about such a call, and each is drawn from a
 * fact the WIRE carries rather than from a guess about somebody else's process
 * ({@link ../../../../surface/src/chat.ts}'s `Armed`, put there by the pinned
 * adapter's patch — `packages/plugins/claude/acp/patches/README.md`):
 *
 *   - **what is being watched** — {@link watchOf}, the description the task was
 *     armed with, which is the sentence a person recognises it by and which the
 *     call's own title (`Monitor`) is not;
 *   - **that it is still out there** — {@link stillOf}, the rail under the row,
 *     `null` the moment the task ends or the conversation does. The sibling of
 *     {@link ./spawn.ts}'s `doingOf`, and drawn as the same rail for the same
 *     reason: an agent in flight and a task in flight are one kind of fact;
 *   - **how it ENDED** — {@link endedOf}, in the harness's own word, because
 *     that is the fact this feature exists for. A monitor's death is precisely
 *     the thing a person supervising off one must not miss, and `killed`,
 *     `stopped` and `failed` are three different endings that ACP's own status
 *     spells with one word.
 *
 * PURE FUNCTIONS over a row, the way {@link ./spawn.ts} and {@link ./lanes.ts}
 * are, and for their reason: what a live face is allowed to claim is exactly
 * the kind of rule that gets re-decided by looking at it, so it is worth being
 * able to re-decide in one place and to assert without arming anything.
 *
 * WHAT IS NOT HERE, and cannot be honestly drawn from anywhere: **the task's
 * own events, one by one.** A monitor's every line reaches the model and the
 * task's output file, and nothing at all in the SDK stream carries it — measured
 * against the pinned CLI, and written down in `packages/plugins/claude/acp/patches/README.md`, because
 * the next person to look will assume the adapter is dropping it. What the
 * panel gets instead is the agent's own prose about each event, in the
 * autonomous turns the harness wakes it for, which lands in the transcript as
 * ordinary rows in the agent's own voice — where it belongs, since those are
 * the agent's words rather than the task's.
 */

import { type Armed, type ChatEntry, isTaskOut } from "@olai/surface"

import { isRunning } from "./running.ts"

/** The task this row armed, or `null` for every row that armed nothing — which
 *  is nearly all of them, and every row in a conversation where nothing was
 *  ever left running.
 *
 *  `undefined` for the row is answered `null` too, for `laneOf`'s reason: the
 *  list holds keys and reads their values a frame behind, so "which row" is a
 *  question that can be asked about nothing. */
export const armedOf = (entry: ChatEntry | undefined): Armed | null =>
  entry?.kind === "tool" ? entry.armed ?? null : null

/**
 * WHAT IT IS WATCHING, in the words the task was armed with — or `null` for a
 * row that armed nothing, and for a task nobody described.
 *
 * `null` rather than a category for the second case, which is the difference
 * from {@link ./spawn.ts}'s `whoOf` and is deliberate: a spawn that named no
 * kind still started somebody, so *agent* says something true. A task nobody
 * described has nothing to say about itself that the row's own title does not
 * already say, and a chip reading *background task* beside a title reading
 * `Monitor` would be furniture.
 */
export const watchOf = (entry: ChatEntry | undefined): string | null =>
  armedOf(entry)?.description ?? null

/**
 * That the task is STILL OUT THERE, in a word — or `null` for a row with no
 * live half left, which is the cue to draw no rail at all.
 *
 * THE RULE IS `isTaskOut`'s, in the surface beside the status vocabulary,
 * because the SERVER asks it about the same row — it is what decides which
 * calls a turn may not strand and how many tasks the conversation still has out
 * ({@link ../../../../chat/src/transcript.ts}). A rail that went out while the
 * count stayed up would be a clock ticking in every open tab under a row that
 * says nothing is happening. What is added here is the KIND check
 * ({@link ./running.ts}) and the WORD.
 *
 * The case that rule catches which the transcript's exemption deliberately does
 * not: a dead agent's conversation reports the death of nothing, so its armed
 * rows are stranded like every other abandoned call and the rail goes out with
 * them.
 *
 * ONE WORD, and it says the least it can. Not *watching*, because a background
 * shell is not watching anything; not the description, because the row already
 * carries it; not a countdown to a monitor's timeout, because a deadline the
 * harness may reset is not a fact this end holds.
 */
export const stillOf = (entry: ChatEntry | undefined): string | null =>
  isRunning(entry) && isTaskOut(entry) ? STILL : null

/**
 * ... and HOW IT ENDED, in the harness's own word — `null` while it is still
 * running, and for every row that armed nothing.
 *
 * The harness's word rather than the row's status, and that is the whole reason
 * the field is on the wire: ACP has four statuses, so `failed`, `killed` and
 * `stopped` all reach the row as `failed`. A monitor somebody STOPPED did not
 * fail, and telling a person it did — at the one moment they are reading the
 * row to find out what happened to their watch — is the failure this draws
 * against.
 *
 * Drawn for `completed` too. A watch that ended when its stream ended is news
 * on a row that has been saying *still running* for an hour, and a row that
 * only spoke up about the bad endings would leave the good one indistinguishable
 * from a task nobody has heard from.
 */
export const endedOf = (entry: ChatEntry | undefined): string | null =>
  armedOf(entry)?.ended ?? null

/** What the rail says while a task is out. */
const STILL = "still running…"
