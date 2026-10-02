import type { LocationNode } from "./new-chat.ts"

export interface LocationRow { readonly section: string; readonly node?: LocationNode }
export const locationTrail = (node: LocationNode) => [node.file, ...node.path, node.title].join(" › ")

/** One deduplicated, bounded shortlist, regardless of provider result sizes. */
export const locationRows = (input: {
  readonly nodes: readonly LocationNode[]
  readonly here: string | null
  readonly suggested: readonly string[]
  readonly recent: readonly string[]
  readonly defaultParent: string | null
  readonly filter: string
}): LocationRow[] => {
  const byId = new Map(input.nodes.map(node => [node.id, node]))
  const seen = new Set<string>()
  const values: LocationRow[] = []
  const filter = input.filter.trim().toLowerCase()
  const add = (section: string, id: string | null) => {
    const node = id === null ? undefined : byId.get(id)
    if (node === undefined || seen.has(node.id) || !locationTrail(node).toLowerCase().includes(filter)) return
    if (section === "Recent" && node.id === input.defaultParent) return
    if (values.filter(value => value.section === section).length >= (section === "All nodes" ? 20 : 5)) return
    seen.add(node.id); values.push({ section, node })
  }
  if ("inbox chats".includes(filter)) values.push({ section: "Default" })
  add("Here", input.here)
  for (const id of input.suggested) add("Suggested", id)
  for (const id of input.recent) add("Recent", byId.get(id)?.parent ?? null)
  if (filter !== "") for (const node of input.nodes) add("All nodes", node.id)
  return values
}
