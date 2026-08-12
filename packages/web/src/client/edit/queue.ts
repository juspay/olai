/**
 * One write at a time, in the order the keys were pressed.
 *
 * Two things in this client have to serialise their writes and they do it for
 * different reasons — the editor because its writes are derived from each
 * other over one draft (`./editing.tsx`), undo because a person leaning on ⌘Z
 * would otherwise have two inverses judged against the same snapshot
 * (`./undoing.ts`). What they share is not the queue, which is deliberately
 * one each; it is this line.
 *
 * And the line has a subtlety worth having in one place: `then(step, step)`,
 * so a step that THROWS still lets the next one run. A chain written
 * `then(step)` wedges on the first rejection, and everything a person typed
 * afterwards goes nowhere — silently, because the failure is a promise nobody
 * is holding.
 */

/** A queue of one: each step waits for the last to settle, either way. A step
 *  that answers with nothing is as welcome as one that answers with a promise
 *  — undo puts its own synchronous stack writes through here so they cannot
 *  land in the middle of a replay (`./undoing.ts`). */
export const serial = (): ((step: () => unknown) => void) => {
  let gate: Promise<unknown> = Promise.resolve()
  return (step) => {
    gate = gate.then(step, step)
  }
}
