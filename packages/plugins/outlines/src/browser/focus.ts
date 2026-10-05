import { heldService } from "@olai/ui-primitives/held.ts"
import { rowElements } from "./row-elements.ts"
/** Outlines owns the row registry and selection/scroll act. Navigation owns
 * whether a reference reveals here or needs a file landing elsewhere. */
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

/** The node being pointed at, or `null`. Each page shares one selector over
 * this reading, so changing focus notifies only the old and new rows. */
export const focusedNode: Accessor<string | null> = focused
const FocusContext = createContext<(id: string) => boolean>()
export function FocusProvider(props: { readonly children: JSX.Element }) {
  const shown = useShown()
  const matches = createSelector(() => shown() ? focused() : null)
  return createComponent(FocusContext.Provider, { value: matches, get children() { return props.children } })
}
export const useFocused = (): ((id: string) => boolean) => useContext(FocusContext) ?? createSelector(focused)

/**
 * SELECT the row an address asked for — one accent for "this is the row",
 * whether a reveal or the outline's landing act (`./OutlinePage.tsx`) asked.
 */
export const selectNode = (id: string): void => {
  setFocused(id)
}

/** A caret on a new, unsaved row clears the previous selection. */
export const clearNode = (): void => {
  setFocused(null)
}

/** The content owner scrolls the row navigation asks to reveal. */
export const bringOntoScreen = (row: Element): void => {
  row.scrollIntoView({ block: "center", behavior: "smooth" })
}

/** Select only a visible row in the requested pane. Navigation chooses the
 * pane; this content owner owns its row registry and the scrolling act. */
export const revealNode = (pane: string, id: string): boolean => {
  const row = rowElements.read()?.find(pane, id, "shown")
  if (!row) return false
  selectNode(id)
  bringOntoScreen(row)
  return true
}
