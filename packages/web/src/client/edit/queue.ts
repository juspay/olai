/**
 * One write at a time, in the order the keys were pressed.
 *
 * Three things in this client have to serialise their writes and they do it
 * for different reasons — the editor because its writes are derived from each
 * other over one draft (`./editing.tsx`), a bulk run because each of its edits
 * is judged against what the one before it did (`../select/selection.ts`), and
 * undo because a person leaning on ⌘Z would otherwise have two inverses judged
 * against the same snapshot (`./undoing.ts`). What they share is not the
 * queue, which is deliberately one each; it is this line.
 *
 * And the line has a subtlety worth having in one place: `then(step, step)`,
 * so a step that THROWS still lets the next one run. A chain written
 * `then(step)` wedges on the first rejection, and everything a person typed
 * afterwards goes nowhere — silently, because the failure is a promise nobody
 * is holding.
 *
 * IT IS ALSO WHERE A KEY'S WRITE IS COUNTED, and for the same reason it is one
 * line: a key that enqueues here is a key this tab has not finished with until
 * the step it queued has settled — including the wait behind everything
 * already on the queue, which is exactly the part no proxy outside this client
 * could see. The step settles after the write has answered AND after
 * `undo.record` has filed the inverse, because that record is inside what the
 * step awaits (`./editing.tsx`'s `send`) — so "this tab has the way back", the
 * precondition of every ⌘Z, is a fact the counter carries.
 * `../quiescence.ts` holds the rest of the argument.
 */

import { type Quiescence, quiescence } from "../quiescence.ts"

/** A queue of one: each step waits for the last to settle, either way. A step
 *  that answers with nothing is as welcome as one that answers with a promise
 *  — undo puts its own synchronous stack writes through here so they cannot
 *  land in the middle of a replay (`./undoing.ts`).
 *
 *  `counter` is the tab's, and it is a parameter for one reason: the counter's
 *  real deferrals are a frame and a task in a browser, and the rule this file
 *  has to hold — a step is counted from ENQUEUE to SETTLE, and a step that
 *  threw still lets go — is a rule about promises that a test should not need
 *  a browser to ask about (`./queue.test.ts`). No caller passes one. */
export const serial = (
  counter: Pick<Quiescence, "held"> = quiescence,
): ((step: () => unknown) => void) => {
  let gate: Promise<unknown> = Promise.resolve()
  return (step) => {
    // Taken at ENQUEUE and not inside the step, which is the load-bearing
    // half: by the time the step runs the key's dispatch is long over, and a
    // hold decided then would be no hold at all. `undefined` for a pointer's
    // write, which goes on the same queue and is not this counter's business.
    const drop = counter.held()
    gate = gate.then(step, step)
    // A BRANCH off the gate rather than a link in it, so what the NEXT step
    // waits on is exactly the step before it and nothing this line added. Both
    // outcomes are handled on the branch, which is also what keeps a step that
    // threw from leaving an unhandled rejection nobody is holding.
    if (drop !== undefined) void gate.then(drop, drop)
  }
}
