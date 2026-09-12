/** Per-conversation armed state, created by the conversation UI owner.
 * It survives folding within this tab activation and leaves with that owner. */

import { type Accessor, createSignal } from "solid-js"

export const createArmed = () => {
const [armed, setArmed] = createSignal<ReadonlyArray<string>>([])

/** What the composer is holding, in the order it was armed. */
const armedNodes: Accessor<ReadonlyArray<string>> = armed

/** Arm one more — or nothing at all, when it is already there. Arming the same
 *  row twice is a thing a person does when they cannot see the strip (the panel
 *  is minimized, or the chip is off the end of it), and two chips for one node
 *  would be two lines of one prompt naming the same node. */
const armNode = (id: string): void => {
  setArmed((already) => (already.includes(id) ? already : [...already, id]))
}

/** Take one back off, before it is sent. */
const disarmNode = (id: string): void => {
  setArmed((already) => already.filter((armed) => armed !== id))
}

/** Hand over everything armed and empty the strip: what a send does. The pair
 *  with {@link restoreArmed} below is {@link ./holding.ts}'s, and for its
 *  reason — a send clears the composer the moment it is pressed, and a send the
 *  server refused has to be able to put back what it threw away. */
const releaseArmed = (): ReadonlyArray<string> => {
  const held = armed()
  setArmed([])
  return held
}

/** Put back what a refused send threw away — and only into a strip that is
 *  still empty, so a row armed while the answer was in flight wins over the one
 *  being restored. */
const restoreArmed = (ids: ReadonlyArray<string>): void => {
  setArmed((now) => (now.length === 0 ? ids : now))
}

return { armedNodes, armNode, disarmNode, releaseArmed, restoreArmed }
}
