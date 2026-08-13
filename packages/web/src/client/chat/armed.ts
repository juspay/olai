/**
 * The nodes the composer is ARMED with: what "Ask agent" on a row put there.
 *
 * A MODULE rather than a prop or a context, because the two ends of this
 * gesture are nowhere near each other in the tree — the door is a row's `•••`
 * in the main pane (`../menu/actions.ts`) and the strip is at the bottom of the
 * chat panel (`./Composer.tsx`), with the whole app between them. It is the
 * same shape the folds (`../fold/memory.ts`) and the panel widths
 * (`../layout/prefs.ts`) already have, and the alternative — threading a
 * setter down through App, the page, the tree and every row — would make every
 * component's signature a function of what one descendant needs.
 *
 * IDS ONLY, and that is the whole value. What the chip DRAWS is read out of the
 * live set beside it, and what the send carries is the id — so nothing here is
 * a copy of a title that can go stale, and a row armed and then retitled by
 * anybody arrives at the agent under the name it has now.
 *
 * It is this TAB's, like the draft in the box beside it: two tabs typing at
 * once should not fight over one composer, and arming is part of typing. It is
 * deliberately not remembered across a reload either — an armed node is the
 * message you are in the middle of writing, not a preference.
 *
 * The strip beside it ({@link ./holding.ts}) has the same four verbs and one
 * more rule, and the difference is what each of them REFERS to: an attachment
 * names a file in the conversation's own tmp directory, so leaving the
 * conversation throws it away and the chip has to go with it. A node names a
 * row in the directory, which no conversation owns — so an armed node survives
 * a new conversation, and the two are not one abstraction with a flag.
 */

import { type Accessor, createSignal } from "solid-js"

const [armed, setArmed] = createSignal<ReadonlyArray<string>>([])

/** What the composer is holding, in the order it was armed. */
export const armedNodes: Accessor<ReadonlyArray<string>> = armed

/** Arm one more — or nothing at all, when it is already there. Arming the same
 *  row twice is a thing a person does when they cannot see the strip (the panel
 *  is minimized, or the chip is off the end of it), and two chips for one node
 *  would be two lines of one prompt naming the same node. */
export const armNode = (id: string): void => {
  setArmed((already) => (already.includes(id) ? already : [...already, id]))
}

/** Take one back off, before it is sent. */
export const disarmNode = (id: string): void => {
  setArmed((already) => already.filter((armed) => armed !== id))
}

/** Hand over everything armed and empty the strip: what a send does. The pair
 *  with {@link restoreArmed} below is {@link ./holding.ts}'s, and for its
 *  reason — a send clears the composer the moment it is pressed, and a send the
 *  server refused has to be able to put back what it threw away. */
export const releaseArmed = (): ReadonlyArray<string> => {
  const held = armed()
  setArmed([])
  return held
}

/** Put back what a refused send threw away — and only into a strip that is
 *  still empty, so a row armed while the answer was in flight wins over the one
 *  being restored. */
export const restoreArmed = (ids: ReadonlyArray<string>): void => {
  setArmed((now) => (now.length === 0 ? ids : now))
}
