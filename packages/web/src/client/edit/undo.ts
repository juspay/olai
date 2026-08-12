/**
 * The undo stack: what this tab did, as the edits that would take it back.
 *
 * The whole of the file is a value and four functions over it, for the reason
 * {@link ./draft.ts} is: what a stack DOES is decided by a handful of rules
 * that are easy to state and easy to get wrong, and every one of them is
 * answerable without a browser.
 *
 * WHAT IS IN IT is not a snapshot of anything. Each entry is the list of edits
 * the SERVER said would reverse one write, derived from the snapshot that write
 * was judged against ({@link ../../../../server/src/edit.ts}'s `inverseOf`) and
 * replayed through the same `edit.apply` gate as any other key. So an undo is a
 * new op judged against the CURRENT set, never a restore of an older one — the
 * difference matters exactly when somebody else is writing, which is the case
 * this design exists for: a restore would overwrite their work with a picture
 * of the file from before it, and a replayed inverse is either applied cleanly
 * or refused with the reason.
 *
 * The four rules, which are the only things this file knows:
 *
 *   - **a new op clears the redo side.** The standard rule, and it is a
 *     statement about branching rather than a convention: once a different
 *     edit has landed on top, what "put it back" used to mean is a place the
 *     outline never went.
 *   - **an undo becomes a redo, and a redo becomes an undo.** Replaying an
 *     inverse answers with ITS inverse, so the two sides feed each other and
 *     there is no second derivation to keep in step.
 *   - **a refused entry is DROPPED**, never retried. It is already off the
 *     stack when the write is sent, so the reason a person sees is about the
 *     top of a stack that has already moved on — and pressing ⌘Z again takes
 *     back the edit before it rather than the one that will not go.
 *   - **it is bounded.** {@link DEPTH} entries, oldest forgotten first.
 *
 * SESSION-LOCAL AND PAGE-LOCAL, which is the other half of "undo MY last op":
 * nothing here is persisted, nothing is shared between tabs, and the ops an
 * agent or another window made are not in it — this is a list of what THIS
 * tab did, which is the only list a person can be surprised by.
 */

import type { Edit } from "@olai/surface"

/**
 * One thing a person did, as what would take it back.
 *
 * A LIST rather than one edit, and it is one edit for everything but a mark
 * that displaced another: the ops layer refuses to put `todo` back on a node
 * that is currently `done` in a single call, so the way back is the two calls
 * an agent would make (the surface says the rest). Replayed in order, and a
 * refusal partway stops there — what landed is on the other side of the stack
 * by then, so ⌘⇧Z puts back exactly the half that went.
 */
export type Step = ReadonlyArray<Edit>

/** Which half of the stack: what ⌘Z would take back, and what ⌘⇧Z would put
 *  back. Named rather than passed as a boolean because every function here
 *  moves an entry from one to the OTHER, and "the other true" is not a
 *  sentence. */
export type Side = "done" | "undone"

/** Both halves, newest LAST — so the top of either is `at(-1)`, and pushing is
 *  an append. */
export interface Stack {
  readonly done: ReadonlyArray<Step>
  readonly undone: ReadonlyArray<Step>
}

export const EMPTY: Stack = { done: [], undone: [] }

/**
 * How many edits back ⌘Z reaches.
 *
 * A hundred, which is a number rather than a discovery: the stack is one
 * session's edits on one outline, an entry is a couple of small
 * records, and the honest reason for a cap at all is that an unbounded list
 * fed by a keyboard is unbounded. Deep enough that nobody who is undoing
 * because they made a mistake will reach the end of it.
 */
export const DEPTH = 100

const capped = (steps: ReadonlyArray<Step>): ReadonlyArray<Step> =>
  steps.length <= DEPTH ? steps : steps.slice(steps.length - DEPTH)

/** A write this tab just made, and the redo side cleared — a new op is a
 *  branch, and what redo meant is now a place the outline never went. */
export const recorded = (stack: Stack, step: Step): Stack => ({
  done: capped([...stack.done, step]),
  undone: [],
})

/** The top of one side, and the stack without it. `null` when that side is
 *  empty, which is the one case a key has to say something about rather than
 *  do nothing visible. Taken BEFORE the write is sent: a refusal drops the
 *  entry, and an entry that stayed on the stack while its write was in flight
 *  could be taken twice. */
export const taken = (
  stack: Stack,
  side: Side,
): { readonly step: Step; readonly rest: Stack } | null => {
  const steps = stack[side]
  const step = steps[steps.length - 1]
  if (step === undefined) return null
  return { step, rest: { ...stack, [side]: steps.slice(0, -1) } }
}

/** What replaying an entry answered with, filed on the OTHER side: an undo
 *  becomes a redo and a redo becomes an undo. Neither clears anything — only a
 *  new op does that. */
export const kept = (stack: Stack, side: Side, step: Step): Stack => {
  const to = side === "done" ? "undone" : "done"
  return { ...stack, [to]: capped([...stack[to], step]) }
}
