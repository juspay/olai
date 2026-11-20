import { Effect } from "effect"
import {
  type AgentItem,
  inOlaiDir,
  isPutAway,
  isRegular,
  itemKey,
  itemOf,
  type NodeAgent,
  nodeChatTitle,
  type OpFailure,
  type Reading,
  noteTitle,
  seatableIn,
  seatableNote,
  UsageFailure,
} from "@olai/format"
import { type ItemLocation, matchesTyped } from "../wire/agents.ts"
import type { Conversing } from "../sessions.ts"

export interface NewChat {
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly start: (
    item: string,
    agent: string,
    committed: Reading,
  ) => Effect.Effect<Conversing | null, OpFailure>
  readonly chats: (reading: Reading) => ReadonlyArray<Pick<NodeAgent, "id" | "title" | "session">>
}

export interface NewChatInput {
  readonly agent: string
  readonly item: AgentItem
  readonly say?: string
}

export const newChat = (owner: NewChat, input: NewChatInput) =>
  Effect.gen(function*() {
    const item = input.item
    const reading = yield* owner.read
    const seatable = item.kind === "node"
      ? seatableIn(reading.derived, item.id)
      : seatableNote(reading.set, reading.derived.claims, item.path)
    if (!seatable) {
      return yield* new UsageFailure({
        reason: `olai holds nothing at ${printed(item)} to talk about; no conversation was created`,
      })
    }
    const key = itemKey(item)
    const there = owner.chats(reading).find(row => row.id === key)
    if (there !== undefined && there.session !== null) {
      return yield* new UsageFailure({
        reason: `“${there.title}” already has a chat; no conversation was created`,
      })
    }
    const result = yield* Effect.result(owner.start(key, input.agent, reading))
    return {
      node: key,
      to: result._tag === "Success" ? result.success : null,
      refusal: result._tag === "Failure" ? result.failure.message : null,
    }
  })

/**
 * BEFORE: the seat is written against the reading the refusal was asked over,
 * not the earlier roster a sidebar was painted from.
 *
 * AFTER: the roster is levelled again, with the gate's own reading, BEFORE the
 * caller says anything into the conversation.
 */
export const seated = <A, E>(input: {
  readonly committed: Reading
  readonly level: (reading: Reading) => void
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly start: Effect.Effect<A, E>
}): Effect.Effect<A, E | OpFailure> =>
  Effect.gen(function*() {
    input.level(input.committed)
    const to = yield* input.start
    input.level(yield* input.read)
    return to
  })

const printed = (item: AgentItem): string => item.kind === "node" ? `/#${item.id}` : `/${item.path}`

export interface LocationQuery {
  readonly filter: string
  readonly limit: number
  readonly keys: readonly string[]
}

const MOST = 20

export const itemLocations = (reading: Reading, query: LocationQuery): { readonly items: ReadonlyArray<ItemLocation> } => {
  const limit = Math.max(0, Math.min(MOST, Math.floor(query.limit)))
  const claims = reading.derived.claims
  const node = (id: string): ItemLocation | null => {
    const row = reading.derived.byId.get(id)
    if (row === undefined || !isRegular(row) || inOlaiDir(row.file) || !seatableIn(reading.derived, id)) return null
    const path: string[] = []
    const seen = new Set([id])
    let parent = row.node.parent
    while (parent !== undefined && !seen.has(parent)) {
      seen.add(parent)
      const above = reading.derived.byId.get(parent)
      if (above === undefined || !isRegular(above)) break
      path.unshift(nodeChatTitle(above.node.title))
      parent = above.node.parent
    }
    return { key: id, kind: "node", title: nodeChatTitle(row.node.title), file: row.file, path }
  }
  const note = (path: string): ItemLocation | null => {
    if (inOlaiDir(path) || isPutAway(claims, path) || !seatableNote(reading.set, claims, path)) return null
    return { key: itemKey({ kind: "note", path }), kind: "note", title: noteTitle(claims, path), file: path, path: [] }
  }
  const found = (key: string): ItemLocation | null => {
    const item = itemOf(key)
    return item.kind === "node" ? node(item.id) : note(item.path)
  }
  const keys = new Set(query.keys.slice(0, 64))
  const items: ItemLocation[] = []
  for (const key of keys) {
    const one = found(key)
    if (one !== null) items.push(one)
  }
  const filter = query.filter.trim()
  if (filter === "") return { items }
  let nodes = 0
  for (const row of reading.derived.nodes) {
    if (nodes >= limit) break
    if (!isRegular(row) || keys.has(row.node.id)) continue
    const one = node(row.node.id)
    if (one === null || !matchesTyped(one, filter)) continue
    items.push(one)
    nodes++
  }
  let notes = 0
  for (const document of reading.set.documents) {
    if (notes >= limit) break
    if (keys.has(itemKey({ kind: "note", path: document.path }))) continue
    const one = note(document.path)
    if (one === null || !matchesTyped(one, filter)) continue
    items.push(one)
    notes++
  }
  return { items }
}
