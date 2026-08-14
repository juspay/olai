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
  /** A short word about the row, drawn INLINE at the right: a chord, a
   *  reminder. Only a command has one — it is a few characters by
   *  construction, which is why it may sit beside the label without ever
   *  starving it. */
  readonly hint?: string
  /**
   * WHERE this row's node lives, drawn on a SECOND line under the title.
   *
   * A place is somebody's prose — an ancestor title can be a whole sentence —
   * so it cannot share a line with the title: side by side, the two fight for
   * one row's width, the title loses (it is the flexible one) and wraps to a
   * word per line, while the mono place refuses to shrink and pushes the
   * palette into a sideways scroll. A popover never scrolls sideways, so the
   * place gets a line of its own and both are ellipsized.
   */
  readonly place?: string
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
    id: "nav-trash",
    label: "Go to the Trash",
    hint: "what was put away",
    action: { kind: "route", route: { kind: "trash" } },
    search: "go to trash archive archived put away restore put back",
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
 * The place line is where the node SITS — a bare title in a list of strangers
 * means nothing — and it is written NEAREST ANCESTOR FIRST, which is not the
 * order the path is stored in. Two reasons, and they are the same reason
 * twice: the nearest ancestor is what actually situates a node ("which
 * `install them`?"), and a line that must be ellipsized loses its END, so the
 * crumb that matters has to be at the front to survive a narrow palette. The
 * outer crumbs follow while there is room, and a top-level node names its
 * file instead.
 *
 */
export const nodeItem = (hit: SearchHit): PaletteItem => ({
  id: `node-${hit.id}`,
  label: hit.title,
  place: placeOf(hit),
  action: { kind: "route", route: { kind: "node", id: hit.id } },
  // Never filtered locally: the server already decided these match.
  search: "",
})

/** The ancestry, innermost first, or the file for a node at top level. */
const placeOf = (hit: SearchHit): string =>
  hit.path.length === 0 ? hit.file : [...hit.path].reverse().join(" · ")

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
