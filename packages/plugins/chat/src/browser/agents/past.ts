/** IS THIS PAIR SOMETHING OTHER THAN WHAT THE NODE IS BOUND TO NOW?
 *
 * One predicate, because three gestures ask it and a second spelling of it is
 * a second answer waiting to disagree. Each has its own pair in hand and the
 * same question about it: the fold line asks it of the chat the READER IS
 * VISITING, to draw *Earlier chat* and a way back out of it (`./History.tsx`);
 * the refused-chat body asks it of the same visit before offering a fresh
 * start at all (`../chat/Unopened.tsx`), a gesture that re-points
 * `agent-session`, so offering it on a chat the node is not bound to would
 * move a binding the reader is not looking at; and the agent line asks it of
 * the pair it CAPTURED AT THE PRESS (`./FreshStart.tsx`), because a refusal
 * may only send the reader back to a node that has not moved on meanwhile.
 *
 * THE WHOLE PAIR, never the session alone. A session id belongs to one engine's
 * own space, so two engines can mint the same string — the scheduler says as
 * much where it records replacements (`../../scoped.ts`: an adapter may reuse
 * an identity after changing engines) — and a node that moved engines on a
 * fresh start can hold an earlier chat whose id equals its current one.
 *
 * `undefined` for the pair is "no other chat is in hand", which is never past.
 */

import type { Conversing } from "../../sessions.ts"

/** The half of a roster row this question is about. */
export interface BoundTo {
  readonly engine: string
  readonly session: string | null
}

export const isPast = (
  pair: Conversing | undefined,
  row: BoundTo | undefined,
): boolean =>
  pair !== undefined
  && (pair.agent !== row?.engine || pair.session !== row?.session)
