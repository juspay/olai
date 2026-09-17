/** Fold state is local to this browser plugin activation, never persisted. */
import { createSignal } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"

export const createFolding = () => {
  const [opened, setOpened] = createSignal<ReadonlySet<string>>(new Set())
  return {
    unfolded: (node: string) => opened().has(node),
    unfold: (node: string) => setOpened(before => new Set([...before, node])),
    fold: (node: string) => setOpened(before => {
      const after = new Set(before)
      after.delete(node)
      return after
    }),
  }
}
const held = heldService<ReturnType<typeof createFolding>>()
export const holdFolding = held.hold
export const unfolded = (node: string) => held.read()?.unfolded(node) ?? false
export const unfold = (node: string) => { held.read()?.unfold(node) }
export const fold = (node: string) => { held.read()?.fold(node) }
