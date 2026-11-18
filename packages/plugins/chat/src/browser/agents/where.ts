/**
 * WHICH NODE OR NOTE A NEW CHAT IS FOR — the shortlist the palette's item
 * level draws, as a pure function of what the server answered and what is
 * typed. The level (`./new-chat-level.ts`) owns the query and the rows'
 * lifetime; nothing here knows about either, so the rules can change without
 * touching them.
 *
 * A CHAT IS ABOUT SOMETHING, and these are the things: the item in front of
 * the reader, the items they have been talking to, and — once something is
 * typed — any node and any note in the vault. Nothing is minted for a chat to
 * live in, so there is no list of places, only a list of things.
 */

/** One item a chat can be about, as `conversation.locations` answers. */
export interface LocationItem {
  /** The item's key — a node's id, or `/` and a note's path. */
  readonly key: string
  readonly kind: "node" | "note"
  readonly title: string
  /** The outline a node is written in, or the note's own path. */
  readonly file: string
  /** The titles above a node, outermost first; empty for a note. */
  readonly path: readonly string[]
}

export type ItemSection = "Here" | "Recent" | "Nodes" | "Notes"
/** One offered item, under the heading that found it. */
export interface ItemRow { readonly section: ItemSection; readonly item: LocationItem }

export const RECENT_LIMIT = 5
export const ITEMS_LIMIT = 20

const trail = (item: LocationItem) => [item.file, ...item.path, item.title].join(" › ")

/** Here first (so plain Enter takes the thing a person is looking at), then
 *  Recent and — once something is typed — Nodes and Notes; an item is listed
 *  once, typing filters every section, and an empty section is simply
 *  absent. */
export const itemRows = (input: {
  /** The item key of the focused pane's page, if it can have a chat. */
  readonly here: string | null
  /** The items of the chats heard from most recently, in that order. */
  readonly recent: readonly string[]
  /** Everything the server answered: here, the recent items and the typed
   *  matches. */
  readonly items: readonly LocationItem[]
  readonly typed: string
}): ItemRow[] => {
  const typed = input.typed.trim().toLowerCase()
  const byKey = new Map(input.items.map(item => [item.key, item]))
  const seen = new Set<string>()
  const rows: ItemRow[] = []
  const count = (section: ItemSection) => rows.filter(row => row.section === section).length
  const add = (section: ItemSection, key: string | null | undefined, limit: number) => {
    const item = key == null ? undefined : byKey.get(key)
    if (item === undefined || seen.has(item.key) || count(section) >= limit) return
    if (!trail(item).toLowerCase().includes(typed)) return
    seen.add(item.key)
    rows.push({ section, item })
  }
  add("Here", input.here, 1)
  for (const key of input.recent) add("Recent", key, RECENT_LIMIT)
  if (typed !== "") {
    for (const item of input.items) if (item.kind === "node") add("Nodes", item.key, ITEMS_LIMIT)
    for (const item of input.items) if (item.kind === "note") add("Notes", item.key, ITEMS_LIMIT)
  }
  return rows
}
