import { createStore } from "solid-js/store"
import { itemOf } from "@olai/format"
import { heldService } from "@olai/ui-primitives/held.ts"

export const CLOSE_CHAT = "Close the chat"

export const closeCost = (key: string): string =>
  `The tie comes off this ${itemOf(key).kind === "note" ? "note" : "row"}, `
  + "and the conversation is listed nowhere in olai afterwards."

export const closeTip = (key: string): string => `${CLOSE_CHAT}. ${closeCost(key)}`

export const createCloses = () => {
  const [closes, setCloses] = createStore<Record<string, number | undefined>>({})
  return {
    at: (key: string): number => closes[key] ?? 0,
    closed: (key: string) => setCloses(key, (count) => (count ?? 0) + 1),
  }
}
const held = heldService<ReturnType<typeof createCloses>>()
export const holdCloses = held.hold
export const closedHere = (key: string): number => held.read()?.at(key) ?? 0
export const closeMade = (key: string): void => { held.read()?.closed(key) }
