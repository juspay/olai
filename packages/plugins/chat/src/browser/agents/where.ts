/**
 * WHERE A NEW CHAT CAN GO — the shortlist the palette's where level draws,
 * as a pure function of what the server answered and what is typed. The level
 * (`./new-chat-level.ts`) owns the query and the rows' lifetime; nothing here
 * knows about either, so the rules can change without touching them.
 */

/** One node a chat may be minted under, as `conversation.locations` answers. */
export interface LocationNode {
  readonly id: string
  readonly title: string
  readonly file: string
  readonly path: readonly string[]
  readonly parent: string | null
}

export type WhereSection = "Default" | "Here" | "Recent" | "Nodes"
/** A row with no node is the default: the Inbox's Chats container. */
export interface WhereRow { readonly section: WhereSection; readonly node?: LocationNode }

export const DEFAULT_LABEL = "Inbox › Chats"
export const RECENT_LIMIT = 5
export const NODES_LIMIT = 20

const trail = (node: LocationNode) => [node.file, ...node.path, node.title].join(" › ")

/** Default first (so plain Enter takes it), then Here, Recent and — once
 *  something is typed — Nodes; a node is listed once, typing filters every
 *  section, and an empty section is simply absent. */
export const whereRows = (input: {
  /** The vault's Inbox registry has an entry, so the default can be minted. */
  readonly defaultOffered: boolean
  /** The default container's id, once the server has said; never Recent. */
  readonly defaultParent: string | null
  readonly here: string | null
  /** Agent nodes, most recently active first; their PARENTS are Recent. */
  readonly recent: readonly string[]
  /** Everything the server answered: here, the recent agents, their parents
   *  and the typed matches. */
  readonly nodes: readonly LocationNode[]
  readonly typed: string
}): WhereRow[] => {
  const typed = input.typed.trim().toLowerCase()
  const byId = new Map(input.nodes.map(node => [node.id, node]))
  const seen = new Set<string>()
  const rows: WhereRow[] = []
  const count = (section: WhereSection) => rows.filter(row => row.section === section).length
  const add = (section: WhereSection, id: string | null | undefined, limit: number) => {
    const node = id == null ? undefined : byId.get(id)
    if (node === undefined || seen.has(node.id) || count(section) >= limit) return
    if (!trail(node).toLowerCase().includes(typed)) return
    seen.add(node.id)
    rows.push({ section, node })
  }
  if (input.defaultOffered && `${DEFAULT_LABEL} default`.toLowerCase().includes(typed)) {
    rows.push({ section: "Default" })
    if (input.defaultParent !== null) seen.add(input.defaultParent)
  }
  add("Here", input.here, 1)
  for (const id of input.recent) {
    const parent = byId.get(id)?.parent
    if (parent !== input.defaultParent) add("Recent", parent, RECENT_LIMIT)
  }
  if (typed !== "") for (const node of input.nodes) add("Nodes", node.id, NODES_LIMIT)
  return rows
}
