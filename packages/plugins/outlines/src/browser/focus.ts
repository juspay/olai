import { heldService } from "@olai/ui-primitives/held.ts"
import { rowElements } from "./row-elements.ts"
/** Outlines owns the row registry and selection/scroll act. Navigation owns
 * whether a reference reveals here or needs a file landing elsewhere. */
import { Result } from "effect"
import { type Accessor, createSignal, createSelector, createContext, createComponent, useContext, type JSX } from "solid-js"

import { runAsync } from "@olai/web/client/run.ts"
import { useShown } from "olai-plugin-navigation/routing"

import { client } from "../client.ts"

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

/** The attribute a focused row carries — a FACT in the markup rather than a
 *  colour, so a scenario asking "which row is being pointed at" is not asking
 *  about a class name (`./Tree.tsx` writes it). It is also what the scroll
 *  below aims at: the row that wears it is the row to bring on screen,
 *  wherever in the tree it turned out to be, and a mirror of the node wears it
 *  too. */

/**
 * SELECT the row an address asked for — the same "this is the row" a
 * reference's press draws, because this module's standing rule is that there
 * is one accent for it and a second vocabulary for an arrival would be a
 * second thing for a reader to learn.
 *
 * Exported for the outline's landing act (`./OutlinePage.tsx`), which is the
 * only other writer: where a press is a person pointing from the panel, an
 * arrival is a URL asking once — same signal, same attribute, same accent.
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
export const nodeHome = async (id: string): Promise<string | null | undefined> => {
  const outcome = await runAsync(client().procedures.nodes.homes({ ids: [id], files: [] }))
  if (Result.isSuccess(outcome)) return outcome.success.homes.find(one => one.id === id)?.file ?? null
  if (outcome.failure._tag === "BusyFailure") return undefined
  throw new Error(outcome.failure.reason)
}
export const clearFocus = (): void => { setFocused(null) }
