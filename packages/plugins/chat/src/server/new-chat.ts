import { Effect } from "effect"
import { UsageFailure, isRegular, seatableIn, outlinePaths, inOlaiDir, inboxIn, type OpFailure, type Reading, type WriteRequest } from "@olai/format"
import type { Conversing } from "../sessions.ts"
import { newChatTitle } from "../new-chat-title.ts"
import { chatsId, ensureChats } from "./filer.ts"

export interface NewChat {
  readonly current: () => string | null
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly write: (request: WriteRequest) => Effect.Effect<{ readonly id: string }, OpFailure>
  readonly start: (node: string, agent: string, committed: Reading) => Effect.Effect<Conversing | null, OpFailure>
}
export interface NewChatInput {
  readonly agent: string
  readonly title: string
  /** null names the current Inbox registry's Chats container. */
  readonly parent: string | null
}
const parentFiles = (reading: Reading) => {
  const paths = outlinePaths(reading.set)
  const inbox = inboxIn(reading.derived.claims, paths)
  return new Set(paths.filter(file => !inOlaiDir(file) || file === inbox))
}
export const canParent = (reading: Reading, id: string, files = parentFiles(reading)): boolean => {
  const row = reading.derived.byId.get(id)
  return row !== undefined && isRegular(row) && seatableIn(reading.derived, id) && files.has(row.file)
}
/** The caller holds creationPermit across all three independent acts. Once
 * minted, the node survives a refused start and is returned for a page retry. */
export const newChat = (owner: NewChat, input: NewChatInput) => Effect.gen(function*() {
  const title = newChatTitle(input.title)
  if (title === "") return yield* new UsageFailure({ reason: "A new chat needs a non-empty title" })
  let parent = input.parent
  if (parent === null) {
    const file = owner.current()
    if (file === null) return yield* new UsageFailure({ reason: "the Inbox is unavailable; no conversation was created" })
    parent = yield* ensureChats(owner, file)
    if (owner.current() !== file) return yield* new UsageFailure({ reason: "the Inbox changed; no conversation was created" })
  }
  if (!canParent(yield* owner.read, parent)) return yield* new UsageFailure({ reason: "The chosen parent vanished, was trashed, or can no longer hold a chat; no conversation was created" })
  const node = yield* owner.write({ op: "add", parent, title })
  const started = yield* Effect.result(owner.start(node.id, input.agent, yield* owner.read))
  return { node: node.id, to: started._tag === "Success" ? started.success : null,
    refusal: started._tag === "Failure" ? started.failure.message : null }
})

export interface LocationQuery {
  readonly filter: string
  readonly limit: number
  readonly ids: readonly string[]
  readonly parents: readonly string[]
}
/** Bounded projection; exact lookups never require shipping the vault. */
export const chatLocations = (reading: Reading, query: LocationQuery, inbox: string | null = null) => {
  const files = parentFiles(reading)
  const limit = Math.max(0, Math.min(20, Math.floor(query.limit)))
  const ids = new Set(query.ids.slice(0, 64))
  for (const id of query.parents.slice(0, 64)) {
    const row = reading.derived.byId.get(id)
    if (row !== undefined && isRegular(row) && row.node.parent !== undefined) ids.add(row.node.parent)
  }
  const project = (id: string) => {
    const row = reading.derived.byId.get(id)
    if (row === undefined || !isRegular(row) || !canParent(reading, id, files)) return null
    const path: string[] = []
    const seen = new Set([id])
    let parent = row.node.parent
    while (parent !== undefined && !seen.has(parent)) {
      seen.add(parent)
      const above = reading.derived.byId.get(parent)
      if (above === undefined || !isRegular(above)) break
      path.unshift(above.node.title)
      parent = above.node.parent
    }
    return { id, title: row.node.title, file: row.file, path, parent: row.node.parent ?? null }
  }
  const nodes = [...ids].flatMap(id => { const node = project(id); return node === null ? [] : [node] })
  const filter = query.filter.trim().toLowerCase()
  let matches = 0
  if (filter !== "") for (const row of reading.derived.nodes) {
    if (matches >= limit) break
    if (!isRegular(row) || ids.has(row.node.id)) continue
    const node = project(row.node.id)
    if (node === null || ![node.file, ...node.path, node.title].join(" › ").toLowerCase().includes(filter)) continue
    nodes.push(node); matches++
  }
  return { nodes, defaultParent: inbox === null ? null : chatsId(reading) }
}
