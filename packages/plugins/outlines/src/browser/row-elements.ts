/** Elements belong to their mounted rows; the outlines activation owns only
 * the index used by landings and references. Pane ids keep copies separate. */
import { createEffect, onCleanup } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"
import { usePane } from "olai-plugin-navigation/pane"

export const createRowElements = () => {
  type Index = { record: Map<string, Set<HTMLElement>>; shown: Map<string, Set<HTMLElement>> }
  const panes = new Map<string, Index>()
  onCleanup(() => panes.clear())
  return {
    register: (pane: string, element: HTMLElement, record: string, shown: string) => {
      let index = panes.get(pane)
      if (index === undefined) panes.set(pane, index = { record: new Map(), shown: new Map() })
      const entries = [[index.record, record], [index.shown, shown]] as const
      for (const [map, key] of entries) {
        let rows = map.get(key)
        if (!rows) map.set(key, rows = new Set())
        rows.add(element)
      }
      return () => {
        for (const [map, key] of entries) {
          const rows = map.get(key)
          rows?.delete(element)
          if (rows?.size === 0) map.delete(key)
        }
        if (index.record.size === 0) panes.delete(pane)
      }
    },
    find: (pane: string | undefined, id: string, by: "record" | "shown") => {
      if (pane === undefined) return undefined
      // Only copies of this record can force a geometry read, never every row
      // before it in a large outline.
      for (const element of panes.get(pane)?.[by].get(id) ?? []) {
        if (element.isConnected && element.getClientRects().length > 0) return element
      }
      return undefined
    },
  }
}
export const rowElements = heldService<ReturnType<typeof createRowElements>>()
export const useRowElement = (record: () => string, shown: () => string) => {
  const pane = usePane()
  return (element: HTMLElement) => {
    if (pane === undefined) return
    createEffect(() => {
    const release = rowElements.read()?.register(pane.id, element, record(), shown())
    if (release) onCleanup(release)
    })
  }
}
