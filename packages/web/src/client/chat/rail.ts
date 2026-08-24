/**
 * WHICH LIVE RAIL a row gets, and what it says — the one place two rules are
 * arbitrated instead of two.
 *
 * The panel draws the same line under a row for two different reasons. An
 * `Agent` call that sent somebody out hangs one saying the agent is working
 * ({@link ./spawn.ts}); a call that armed a background task hangs one saying
 * the task is still out ({@link ./background.ts}). To a reader they are one
 * kind of fact — *something is happening down there* — which is why they are
 * one line, drawn at one inset, in one colour.
 *
 * BOTH HALVES IN ONE ANSWER: the words, and which face they are. The list used
 * to take the word from one rule and then ask a second rule again for the test
 * id, which is two computations that have to agree about what kind of rail this
 * is — the shape of bug {@link ./lanes.ts} fixed one field over, where a
 * `labelled` boolean sat beside the label it was about and nothing held them
 * together.
 *
 * A CALL CAN BE BOTH. An `Agent` launched asynchronously is a spawn AND a
 * background task, so the precedence is stated here, once, rather than falling
 * out of the order two reads happen to be written in: **the spawn wins**,
 * because who was sent is the more specific thing to say about a call than that
 * something is still running.
 *
 * A rule module rather than an expression in the list, for {@link ./lanes.ts}'s
 * reason: what a live face is allowed to claim is exactly the kind of thing
 * that gets re-decided by looking at it, and a third live face should be an
 * edit here rather than an edit to the component.
 */

import type { ChatEntry } from "@olai/surface"

import { TESTID } from "../testids.ts"
import { stillOf } from "./background.ts"
import { doingOf } from "./spawn.ts"

/** The rail under a row: what it says, and which face it is. */
export interface Rail {
  /** The words, already decided by whichever rule answered. */
  readonly said: string
  /** ... and the test id that says which of the two this is — carried WITH the
   *  words, never fetched by asking the rules a second time. */
  readonly name: string
}

/**
 * The rail this row hangs, or `null` for a row with nothing live under it —
 * which is every row in a conversation where nothing was spawned and nothing
 * was armed.
 *
 * `undefined` for the row is answered `null` too, for `laneOf`'s reason: the
 * list holds keys and reads their values a frame behind, so "which row" is a
 * question that can be asked about nothing.
 */
export const railOf = (entry: ChatEntry | undefined): Rail | null => {
  const spawned = doingOf(entry)
  if (spawned !== null) return { said: spawned, name: TESTID.chatSpawnWorking }
  const still = stillOf(entry)
  return still === null ? null : { said: still, name: TESTID.chatArmedStill }
}

/** Whether two answers say the same thing — the memo's own equality, so a row
 *  that recomputes an identical rail does not notify the attributes and the
 *  words downstream. A fresh object every frame is what a memo over a STRING
 *  never had to think about, and it is the hazard `lanes.ts` names one memo
 *  up. */
export const sameRail = (before: Rail | null, after: Rail | null): boolean =>
  before?.said === after?.said && before?.name === after?.name
