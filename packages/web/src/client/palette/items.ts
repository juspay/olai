/**
 * The palette SHELL's catalogue: navigation, panel toggles, ask-the-agent —
 * and the shape a NODE takes when search answers with one.
 *
 * Op actions belong to the separate `palette` roadmap item — not here. A `>`
 * prefix on the query sends the rest to the agent rather than filtering this
 * list. Node hits arrive from the server's search procedure (Palette.tsx asks
 * it as you type) rather than from a matcher of this file's own: the browser
 * holds every node and could grep them, and deliberately does not, because the
 * palette and an agent's `search_nodes` must be one reading
 * (`@olai/surface`'s search.ts has the argument).
 */

import type { SearchHit } from "@olai/surface"

import type { Route } from "../routes.ts"

export type PaletteAction =
  | { readonly kind: "route"; readonly route: Route }
  | { readonly kind: "shortcuts" }
  | { readonly kind: "toggle-sidebar" }
  | { readonly kind: "toggle-chat" }
  | { readonly kind: "reset-widths" }
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
    id: "nav-agenda",
    label: "Go to the agenda",
    hint: "what is due",
    action: { kind: "route", route: { kind: "agenda" } },
    search: "go to agenda due overdue upcoming owed",
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
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    hint: "every key",
    action: { kind: "shortcuts" },
    search: "keyboard shortcuts keys help reference bindings",
  },
  {
    id: "reset-widths",
    label: "Reset panel widths",
    hint: "defaults",
    action: { kind: "reset-widths" },
    search: "reset panel widths sidebar chat default size",
  },
]

/**
 * One search hit as a palette row: choosing it jumps to the node's page.
 *
 * The hint is where the node SITS (its nearest ancestor, or its file at top
 * level) — a bare title in a list of strangers means nothing. A semantic hit
 * wears `≈` in front: the query's words are NOT in this node, the index reads
 * it as saying the same thing, and a reader is owed the difference between
 * evidence and resemblance. When no embedder is present such hits simply
 * never arrive, and nothing here says so — the absence of a feature is not an
 * error.
 */
export const nodeItem = (hit: SearchHit): PaletteItem => ({
  id: `node-${hit.id}`,
  label: hit.title,
  hint: `${hit.matched === "meaning" ? "≈ " : ""}${
    hit.path[hit.path.length - 1] ?? hit.file
  }`,
  action: { kind: "route", route: { kind: "node", id: hit.id } },
  // Never filtered locally: the server already decided these match.
  search: "",
})

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
