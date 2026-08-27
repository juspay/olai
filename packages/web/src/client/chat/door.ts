/**
 * WHAT A SPAWN'S DOOR SAYS, or that there is no door — the rule under the
 * control that opens a subagent's own calls.
 *
 * A subagent's work is not in the transcript any more ({@link ./lanes.ts}'s
 * `filedUnder`), which buys back the column and costs one thing: the record has
 * to be reachable. It is reachable in two places and this is the one that
 * LASTS. The strip above the scroll is the live face — it says who is out and
 * for how long, and it goes quiet the moment they report back — and a record
 * you could read only while the agent was still running would be a fan-out you
 * could look at exactly when you were too busy to.
 *
 * So the door is on the ROW. That row is the main agent's own call, it is at
 * its birth position, and it is where a reader scrolling back through the
 * conversation arrives when they ask *what did that agent actually do?* —
 * which is the question this feature has to keep answerable, and the one the
 * transcript used to answer by shouting.
 *
 * WHAT IT SAYS IS THE COUNT, and the count is the honest thing it can say. Not
 * *see the agent's work*, which is a label rather than a fact; not the agent's
 * kind, which the row already carries on its own line
 * ({@link ./ToolFrame.tsx}); not what it FOUND, which is the report and is in
 * the fold. How many calls it made is the size of what is behind the door, and
 * a reader deciding whether to open something is deciding about its size.
 *
 * ... AND WHAT THE AGENT WAS SENT TO DO, when that is not already the row's own
 * title. A tool row's title is the name the call was announced with, pinned at
 * the first frame that carried one — and for the adapter olai ships with, that
 * name is the tool's: **four agents dispatched in one message are four rows
 * reading `Task`.** Measured on a real fan-out, not imagined. While a
 * subagent's calls were drawn under the row that sent it a reader could work
 * downwards and find out; with the work behind a door, four identical doors is
 * the panel refusing to say which one to open. So the door carries the
 * description ({@link ./spawn.ts}'s `sentOf`) — and carries it ONLY when it
 * adds something, because a door reading *explore the outline · 3 calls* under
 * a row reading *explore the outline* is furniture.
 *
 * NO DOOR WHEN THERE IS NOTHING BEHIND IT. An agent that has been sent out and
 * has not called anything yet is the whole of the stretch a fan-out is watched
 * through, and what says so is already there and already right — the live rail
 * under the row ({@link ./spawn.ts}). A door beside it reading *no calls yet*
 * would be a control that does nothing, drawn at the one moment a person is
 * looking hardest. And an agent that finished having called nothing has its
 * whole answer in the row's own fold.
 *
 * A PURE FUNCTION over a row and a number, the way {@link ./lanes.ts} and
 * {@link ./spawn.ts} are, and for their reason: what a control is allowed to
 * claim is exactly the kind of thing that gets re-decided by looking at it, so
 * it is worth being able to re-decide in one place and to assert without
 * starting an agent.
 */

import type { ChatEntry } from "@olai/surface"

import { sentOf, whoOf } from "./spawn.ts"

/**
 * The door under this row, in words — or `null` for a row with no door, which
 * is every row that spawned nobody and every spawn nobody has heard from yet.
 *
 * @param entry the row being drawn
 * @param calls how many calls the agent it sent has made, which is a fact about
 *        the LIST ({@link ./order.ts}) and so is handed in rather than reached
 *        for — the same shape `laneOf` takes its name lookup in.
 */
export const doorOf = (entry: ChatEntry | undefined, calls: number): string | null => {
  if (whoOf(entry) === null) return null
  if (calls <= 0) return null
  const many = calls === 1 ? "1 call" : `${calls} calls`
  const sent = sentOf(entry)
  // A row of a kind other than `tool` never gets this far (`whoOf` says so),
  // so the only way `sent` matches the title is that the spawn described itself
  // in the words the row is already wearing.
  return sent === null || sent === (entry?.kind === "tool" ? entry.text : null)
    ? many
    : `${sent} · ${many}`
}
