/**
 * A menu verb, at the write gate.
 *
 * One function, and the whole of what it adds to `runAsync` is TURNING BOTH
 * ANSWERS INTO A SENTENCE — because the menu has exactly one place to put one
 * (the line beside the `•••`) and both moods belong in it:
 *
 *   - a REFUSAL is quoted VERBATIM. Not "couldn't mark todo": the ops layer's
 *     own words are the only ones that say WHY — that this node is done and
 *     nothing should decide on somebody's behalf that finished work is not
 *     finished, that a placement is still named by three other rows and by
 *     which — and a menu that summarised them would be a menu that threw the
 *     answer away and kept the failure. HACKING.md's rule, at the surface it
 *     applies to.
 *   - a NUDGE rides back on a write that LANDED, and it reaches the person who
 *     caused the write for the same reason it reaches an agent that did
 *     (`@olai/ops`' `Applied.nudge`, #109): completing the last task under a
 *     parent is the moment somebody might want to tick the parent too. The
 *     keyboard already draws its nudges under the row; a menu that dropped
 *     them would be the one writer whose remarks nobody sees.
 *
 * The two are told apart by TONE rather than by which line they are on, which
 * is the same shape the row editor uses one level down.
 */

import type { Edit } from "@olai/surface"
import { Result } from "effect"

import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"

/** What a verb has to say afterwards, in the two moods a write has: `alarm`
 *  for a refusal, which is why nothing happened, and `aside` for a remark
 *  about something that did. */
export interface Said {
  readonly tone: "alarm" | "aside"
  readonly text: string
}

/** Send it, and answer with whatever there is to say — `undefined` when a
 *  write landed with nothing to add, which is the ordinary case and the one a
 *  quiet gutter is right for. */
export const applying = async (edit: Edit): Promise<Said | undefined> => {
  const outcome = await runAsync(olai.procedures.edit.apply(edit))
  if (Result.isFailure(outcome)) {
    return { tone: "alarm", text: outcome.failure.message }
  }
  const nudge = outcome.success.nudge
  return nudge === undefined ? undefined : { tone: "aside", text: nudge }
}
