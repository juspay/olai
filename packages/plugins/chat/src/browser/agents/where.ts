import { type ItemLocation, matchesTyped } from "olai-plugin-chat/wire"

export type ItemSection = "Here" | "Recent" | "Nodes" | "Notes"
export interface ItemRow { readonly section: ItemSection; readonly item: ItemLocation }

export const RECENT_LIMIT = 5
export const ITEMS_LIMIT = 20

export const itemRows = (input: {
  readonly here: string | null
  readonly recent: readonly string[]
  readonly items: readonly ItemLocation[]
  readonly typed: string
}): ItemRow[] => {
  const typed = input.typed.trim()
  const byKey = new Map(input.items.map(item => [item.key, item]))
  const seen = new Set<string>()
  const rows: ItemRow[] = []
  const count = (section: ItemSection) => rows.filter(row => row.section === section).length
  const add = (section: ItemSection, key: string | null | undefined, limit: number) => {
    const item = key == null ? undefined : byKey.get(key)
    if (item === undefined || seen.has(item.key) || count(section) >= limit) return
    if (!matchesTyped(item, typed)) return
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
