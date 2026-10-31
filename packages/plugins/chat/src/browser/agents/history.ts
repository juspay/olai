/**
 * WHICH NODE'S HISTORY LIST IS OPEN — held for this browser plugin activation,
 * never persisted, exactly as `./folding.ts` holds a fold.
 *
 * The two are the same fact about the same owner: a person's gesture on a
 * conversation's pane. The pane is what ends it (the reader shuts it, folds it,
 * or leaves), and the frame that happens to be drawing the list is NOT — which
 * is the difference this file exists for. A restart is the case that showed it:
 * the server comes back and refuses the conversation a node was in, so the
 * panel's address moves from that session to the node and the panel — with the
 * list inside it — is rebuilt. A list somebody had just opened shut under the
 * pointer, and the row they were about to press moved out from under it: a
 * roster frame deciding what the reader had open.
 *
 * So the picker is handed a seat here rather than keeping one of its own
 * (`@olai/web/client/inlinePicker.ts`). Per NODE, like the fold, because that
 * is what the reader pressed; and the union travels whole, so what the list is
 * up over is the one this frame asked for and not the departed one's.
 */
import { createStore, produce } from "solid-js/store"
import { heldService } from "@olai/ui-primitives/held.ts"
import type { PickerSeat, PickerState } from "@olai/web/client/inlinePicker.ts"

/** Nothing at all, for a node nobody has opened. One frozen value because it
 *  is read on every frame and compared by identity, like any signal's value. */
const SHUT: PickerState<never> = { _tag: "shut" }

/** The activation's own reading of every node's history list. */
export interface History {
  /** The seat a picker writing for this node keeps its one fact in. */
  readonly seat: (node: string) => PickerSeat<true>
}

export const createHistory = (): History => {
  const [state, setState] = createStore<Record<string, PickerState<true> | undefined>>({})
  return {
    seat: (node: string) => ({
      read: () => state[node] ?? SHUT,
      // A REPLACEMENT, not a merge: a store writes an object at a path by
      // merging its keys, and the two arms of the union share none — writing
      // `shut` over `open` that way leaves the old `over` behind, which is
      // exactly the stale payload the union exists against.
      write: (up) => setState(produce((state) => { state[node] = up })),
    }),
  }
}
const held = heldService<History>()
export const holdHistory = held.hold
/** ...and the seat itself, which the door answers with a picker that works and
 *  forgets: a null owner draws for nobody, the way `./folding.ts`'s does. */
export const historySeat = (node: string): PickerSeat<true> =>
  held.read()?.seat(node) ?? { read: () => SHUT, write: () => {} }
