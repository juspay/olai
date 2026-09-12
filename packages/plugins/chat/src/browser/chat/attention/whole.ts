/**
 * Whether the conversation has arrived far enough for "no form is waiting" to
 * mean THERE IS NONE rather than NOT YET.
 *
 * The distinction is the whole of it. A press that finds no waiting form has
 * two entirely different reasons to find none — the question was answered in
 * another tab between the banner and the press, which is ordinary and should
 * let the request go; or the rows have not landed yet, which is a press about
 * to be spent as a jump to the foot of a conversation whose question is
 * further up. The transcript's row list is KEYS (`./../state.ts`), and a key
 * is in it before its value is, so the list being non-empty says nothing about
 * whether the form could be drawn.
 *
 * `valueOf` is the row's own accessor, READ — which is what makes this the
 * right shape for the caller: reading each key subscribes the press's effect
 * to exactly the rows it is still waiting on, so a value landing wakes it, and
 * the short-circuit means it subscribes to the first unlanded key and no more.
 * A caller that has already found the form never calls this at all.
 */
export const wholeYet = <T>(
  keys: ReadonlyArray<string>,
  valueOf: (key: string) => T | undefined,
): boolean => keys.length > 0 && keys.every((key) => valueOf(key) !== undefined)
