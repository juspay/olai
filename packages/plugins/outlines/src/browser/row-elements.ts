/** Elements belong to their mounted rows; the outlines activation owns only
 * the index used by landings and references. Pane ids keep copies separate. */
import { createEffect, onCleanup } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"
import { usePane } from "olai-plugin-navigation/pane"

export const createRowElements = () => {
  const panes = new Map<string, Set<{ element: HTMLElement; record: string; shown: string }>>()
  onCleanup(() => panes.clear())
  return {
    register: (pane: string, element: HTMLElement, record: string, shown: string) => {
      let rows = panes.get(pane)
      if (rows === undefined) panes.set(pane, rows = new Set())
      const row = { element, record, shown }
      rows.add(row)
      return () => { rows.delete(row); if (rows.size === 0) panes.delete(pane) }
    },
    find: (pane: string | undefined, id: string, by: "record" | "shown") => pane === undefined ? undefined :
      [...(panes.get(pane) ?? [])].find(row => row[by] === id && row.element.isConnected && row.element.getClientRects().length > 0)?.element,
  }
}
export const rowElements = heldService<ReturnType<typeof createRowElements>>()
export const useRowElement = (record: () => string, shown: () => string) => {
  const pane = usePane()
  let element: HTMLElement | undefined
  createEffect(() => {
    if (pane === undefined || element === undefined) return
    const release = rowElements.read()?.register(pane.id, element, record(), shown())
    if (release) onCleanup(release)
  })
  return (value: HTMLElement) => { element = value }
}
