import { scrollManner } from "@olai/appearance/motion.ts"
import { heldService } from "@olai/ui-primitives/held.ts"
import { rowElements } from "./row-elements.ts"
import { type Accessor, createSignal, createSelector, createContext, createComponent, useContext, type JSX } from "solid-js"

import { useShown } from "olai-plugin-navigation/routing"


export const createFocusState = () => {
  const [focused, setFocused] = createSignal<string | null>(null)
  return { focused, setFocused }
}
const focusState = heldService<ReturnType<typeof createFocusState>>()
export const holdFocusState = focusState.hold
const focused = () => focusState.read()?.focused() ?? null
const setFocused = (id: string | null) => focusState.read()?.setFocused(id)

export const focusedNode: Accessor<string | null> = focused
const FocusContext = createContext<(id: string) => boolean>()
export function FocusProvider(props: { readonly children: JSX.Element }) {
  const shown = useShown()
  const matches = createSelector(() => shown() ? focused() : null)
  return createComponent(FocusContext.Provider, { value: matches, get children() { return props.children } })
}
export const useFocused = (): ((id: string) => boolean) => useContext(FocusContext) ?? createSelector(focused)

export const selectNode = (id: string): void => {
  setFocused(id)
}

export const clearNode = (): void => {
  setFocused(null)
}

export const bringOntoScreen = (row: Element): void => {
  row.scrollIntoView({ block: "center", behavior: scrollManner() })
}

export const revealNode = (pane: string, id: string): boolean => {
  const row = rowElements.read()?.find(pane, id, "shown")
  if (!row) return false
  selectNode(id)
  bringOntoScreen(row)
  return true
}
