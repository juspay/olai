/**
 * The palette SHELL's catalogue: navigation, panel toggles, ask-the-agent.
 *
 * Jump-to-node type-ahead and op actions belong to the separate `palette`
 * roadmap item — not here. A `>` prefix on the query sends the rest to the
 * agent rather than filtering this list.
 */

import type { Route } from "../routes.ts"

export type PaletteAction =
  | { readonly kind: "route"; readonly route: Route }
  | { readonly kind: "toggle-sidebar" }
  | { readonly kind: "toggle-chat" }
  | { readonly kind: "ask"; readonly text: string }

export interface PaletteItem {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly action: PaletteAction
  /** Lowercase haystack for simple substring filter. */
  readonly search: string
}

export const SHELL_ITEMS: ReadonlyArray<PaletteItem> = [
  {
    id: "nav-home",
    label: "Go home",
    hint: "open the first outline",
    action: { kind: "route", route: { kind: "outline", file: null } },
    search: "go home outline first",
  },
  {
    id: "nav-today",
    label: "Go to today",
    hint: "journal for this day",
    action: { kind: "route", route: { kind: "today" } },
    search: "go to today journal day calendar",
  },
  {
    id: "panel-sidebar",
    label: "Toggle sidebar",
    hint: "⌘\\",
    action: { kind: "toggle-sidebar" },
    search: "toggle sidebar panel rail directory",
  },
  {
    id: "panel-chat",
    label: "Toggle agent panel",
    hint: "⌘J",
    action: { kind: "toggle-chat" },
    search: "toggle agent panel chat",
  },
]

/** Filter shell items by a free-text query (no `>` prefix). */
export const filterItems = (
  query: string,
  items: ReadonlyArray<PaletteItem> = SHELL_ITEMS,
): ReadonlyArray<PaletteItem> => {
  const q = query.trim().toLowerCase()
  if (q === "") return items
  return items.filter(
    (item) =>
      item.search.includes(q) || item.label.toLowerCase().includes(q),
  )
}

/** A query that begins with `>` (after optional space) is an ask-the-agent. */
export const askQuery = (raw: string): string | null => {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith(">")) return null
  return trimmed.slice(1).trimStart()
}
