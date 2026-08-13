/**
 * A POINTER's write, at the same gate the keyboard's go through.
 *
 * Two surfaces send one now — the `•••` menu's verbs (`menu/actions.ts`) and
 * the date picker (`date/DatePicker.tsx`) — which is why this sits beside
 * `run.ts` and `wire.ts` rather than inside either of them. They are the same
 * write with the same two answers, and a second copy of the four lines below
 * would be a second opinion about what happens to a refusal.
 *
 * The whole of what it adds to `runAsync` is TURNING BOTH ANSWERS INTO A
 * SENTENCE — because each of these surfaces has exactly one place to put one
 * (the line beside the `•••`, the line under the picker) and both moods belong
 * in it:
 *
 *   - a REFUSAL is quoted VERBATIM. Not "couldn't mark todo": the ops layer's
 *     own words are the only ones that say WHY — that this node is done and
 *     nothing should decide on somebody's behalf that finished work is not
 *     finished, that a placement is still named by three other rows and by
 *     which — and a caller that summarised them would be one that threw the
 *     answer away and kept the failure. HACKING.md's rule, at the surface it
 *     applies to.
 *   - a NUDGE rides back on a write that LANDED, and it reaches the person who
 *     caused the write for the same reason it reaches an agent that did
 *     (`@olai/ops`' `Applied.nudge`, #109): completing the last task under a
 *     parent is the moment somebody might want to tick the parent too. The
 *     keyboard already draws its nudges under the row; a pointer that dropped
 *     them would be the one writer whose remarks nobody sees.
 *
 * The two are told apart by TONE rather than by which line they are on, which
 * is the same shape the row editor uses one level down.
 */

import type { Edit } from "@olai/surface"
import { Result } from "effect"

import { runAsync } from "./run.ts"
import { olai } from "./wire.ts"
import type { Undo } from "./edit/undoing.ts"

/** What a verb has to say afterwards, in the two moods a write has: `alarm`
 *  for a refusal, which is why nothing happened, and `aside` for a remark
 *  about something that did.
 *
 *  ONE declaration, and it is the undo line's ({@link ./edit/undoing.ts}):
 *  several surfaces in this client say a thing about a write in these two
 *  moods, and a second spelling of the same pair would be a second answer to
 *  which moods there are. Imported here rather than re-exported, so the type
 *  has one import path as well as one declaration. */
import type { Said } from "./edit/undoing.ts"

/**
 * Send it, and answer with whatever there is to say — `undefined` when a write
 * landed with nothing to add, which is the ordinary case and the one a quiet
 * gutter is right for.
 *
 * `record` is the undo stack's, and a pointer's write files onto it exactly as
 * a keystroke does ({@link ./edit/editing.tsx}): the server says what would take
 * a write back, `undefined` and all, and which of these verbs HAS an inverse is
 * its answer rather than this file's opinion. So ⌘Z takes back a mark chosen
 * from the menu, a date picked on a badge and a date cleared from either, a
 * move to the Trash — the inverse is `unarchive`, carrying the place the row
 * sat — and a `Put back` pressed in the Trash, whose inverse is the archive
 * again.
 */
export const applying = async (
  edit: Edit,
  record: Undo["record"],
): Promise<Said | undefined> => {
  const outcome = await runAsync(olai.procedures.edit.apply(edit))
  if (Result.isFailure(outcome)) {
    return { tone: "alarm", text: outcome.failure.message }
  }
  record(outcome.success.undo)
  const nudge = outcome.success.nudge
  return nudge === undefined ? undefined : { tone: "aside", text: nudge }
}
