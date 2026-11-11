/** IS THE READER ON A CHAT OTHER THAN THE NODE'S CURRENT ONE?
 *
 * One predicate, because two faces ask it and a second spelling of it is a
 * second answer waiting to disagree: the fold line draws *Earlier chat* and a
 * way back out of it (`./History.tsx`), and the refused-chat body decides
 * whether to offer a fresh start at all (`../chat/Unopened.tsx`) — a gesture
 * that re-points `agent-session`, so offering it on a chat the node is not
 * bound to would move a binding the reader is not looking at.
 *
 * THE WHOLE PAIR, never the session alone. A session id belongs to one engine's
 * own space, so two engines can mint the same string — the scheduler says as
 * much where it records replacements (`../../scoped.ts`: an adapter may reuse
 * an identity after changing engines) — and a node that moved engines on a
 * fresh start can hold an earlier chat whose id equals its current one.
 */

import type { Conversing } from "../../sessions.ts"

/** The half of a roster row this question is about. */
export interface BoundTo {
  readonly engine: string
  readonly session: string | null
}

export const isPast = (
  visiting: Conversing | undefined,
  row: BoundTo | undefined,
): boolean =>
  visiting !== undefined
  && (visiting.agent !== row?.engine || visiting.session !== row?.session)
