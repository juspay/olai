/**
 * WHEN a stored conversation was last touched, to the minute.
 *
 * The picker used to draw the day alone (`2026-08-01`), which is enough to sort
 * a list by and not enough to tell two rows apart — and two rows that need
 * telling apart is the ordinary case here rather than a corner: `/clear` leaves
 * the conversation it ended and the one it started sharing a title, on the same
 * day, and ACP carries no fact that says one supersedes the other. The
 * timestamp is what the protocol DOES give (`SessionInfo.updatedAt`, ISO 8601),
 * so it is drawn for what it is worth: the row a person means is the one they
 * were in ten minutes ago, and the minute says which that is.
 *
 * LOCAL, because the reader is. The stamp is an instant an agent recorded, not
 * one of the format's own dates — those are text this codebase deliberately
 * never parses (`docs/architecture.md`, Dates) and this is not one of them.
 *
 * Pure, and no clock: unlike the commit pill's `agoOf` this says nothing
 * relative to now, so it never goes stale and never needs a timer. A phrase
 * would also have stopped distinguishing two siblings the moment both of them
 * were "3d ago", which is the one thing this exists to do.
 */

import { instantOf, isoDayOf } from "@olai/web/client/clock.ts"

/** `at` as `YYYY-MM-DD HH:MM` where the reader is, or `null` when there is no
 *  stamp to draw — a session the agent gave no `updatedAt`, and one whose
 *  `updatedAt` is not a time at all. Both are ONE answer here rather than two
 *  the caller has to fold together: it is somebody else's string, and
 *  `Invalid Date` printed in a picker is worse than a row with no stamp.
 *
 *  READING it is `clock.ts`'s (`instantOf`) — the same refusal the commit
 *  pill and the panel's duration readout make about their own borrowed stamps,
 *  spelled once now rather than three times with a comment in each saying the
 *  three agreed. The DAY half is the client's one speller too (over the
 *  calendar's `isoDate`), because that is the rule those two exist to keep: one
 *  spelling of a day, and never a second chance to zero-pad it differently. The
 *  clock half is this file's own — no calendar mints an hour. */
export const whenOf = (at: string | null): string | null => {
  const stamped = instantOf(at)
  if (stamped === null) return null
  const then = new Date(stamped)
  return `${isoDayOf(then)} ${two(then.getHours())}:${two(then.getMinutes())}`
}

const two = (value: number): string => String(value).padStart(2, "0")
