/** Fold state is local to this browser plugin activation, never persisted. */
import { createStore } from "solid-js/store"
import { heldService } from "@olai/ui-primitives/held.ts"

export const createFolding = () => {
  const [opened, setOpened] = createStore<Record<string, boolean | undefined>>({})
  return {
    unfolded: (node: string) => opened[node] === true,
    unfold: (node: string) => setOpened(node, true),
    fold: (node: string) => setOpened(node, undefined),
  }
}
const held = heldService<ReturnType<typeof createFolding>>()
export const holdFolding = held.hold
export const unfolded = (node: string) => held.read()?.unfolded(node) ?? false
export const unfold = (node: string) => { held.read()?.unfold(node) }
export const fold = (node: string) => { held.read()?.fold(node) }
