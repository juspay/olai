import { createStore, produce } from "solid-js/store"
import { heldService } from "@olai/ui-primitives/held.ts"
import type { PickerSeat, PickerState } from "@olai/web/client/inlinePicker.ts"

const SHUT: PickerState<never> = { _tag: "shut" }

export interface History {
  readonly seat: (node: string) => PickerSeat<true>
}

export const createHistory = (): History => {
  const [state, setState] = createStore<Record<string, PickerState<true> | undefined>>({})
  return {
    seat: (node: string) => ({
      read: () => state[node] ?? SHUT,
      write: (up) => setState(produce((state) => { state[node] = up })),
    }),
  }
}
const held = heldService<History>()
export const holdHistory = held.hold
export const historySeat = (node: string): PickerSeat<true> =>
  held.read()?.seat(node) ?? { read: () => SHUT, write: () => {} }
