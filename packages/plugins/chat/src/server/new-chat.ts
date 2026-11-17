import { Effect } from "effect"
import { UsageFailure, isRegular, seatableIn, outlinePaths, inOlaiDir, inboxIn, samePlace, type OpFailure, type Place, type Reading, type WriteRequest } from "@olai/format"
import type { Conversing } from "../sessions.ts"
import { aboutTitle, newChatTitle } from "../new-chat-title.ts"
import { chatsId, ensureChats } from "./filer.ts"
import { chatsIn, placeIn } from "./places.ts"

export interface NewChat {
  readonly current: () => string | null
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly write: (request: WriteRequest) => Effect.Effect<{ readonly id: string }, OpFailure>
  readonly start: (node: string, agent: string, committed: Reading) => Effect.Effect<Conversing | null, OpFailure>
  /** The chat rows of a reading, in roster order — what a second chat about
   *  one place is refused against, and a chat row that never started is
   *  found by. */
  readonly chats: (reading: Reading) => ReadonlyArray<{ readonly id: string; readonly title: string; readonly session: string | null }>
}
export interface NewChatInput {
  readonly agent: string
  readonly title: string
  /** null names the current Inbox registry's Chats container. */
  readonly parent: string | null
  /**
   * THE PLACE THIS CHAT IS ABOUT, as an address (`/notes/plan.md`,
   * `/plugins/swatch`) — and then `title` is the place's NAME. The row is
   * titled `[name](address)`, which is what makes it that place's chat. A
   * place has one: one that already has a conversation is refused, and one
   * whose chat row never started (its start was refused) is started on that
   * same row, so a retry never leaves a second row behind.
   */
  readonly about?: string
}
const parentFiles = (reading: Reading) => {
  const paths = outlinePaths(reading.set)
  const inbox = inboxIn(reading.derived.claims, paths)
  return new Set(paths.filter(file => !inOlaiDir(file) || file === inbox))
}
export const canParent = (reading: Reading, id: string, paths = parentFiles(reading)): boolean => {
  const row = reading.derived.byId.get(id)
  return row !== undefined && isRegular(row) && seatableIn(reading.derived, id) && paths.has(row.file)
}
/** The caller holds creationPermit across all three independent acts. Once
 * minted, the node survives a refused start and is returned for a page retry. */
export const newChat = (owner: NewChat, input: NewChatInput) => Effect.gen(function*() {
  const title = input.about === undefined ? newChatTitle(input.title) : aboutTitle(input.title, input.about)
  if (title === "") return yield* new UsageFailure({ reason: "A new chat needs a non-empty title" })
  if (input.about !== undefined) {
    const reading = yield* owner.read
    const place = placeIn(reading, input.about)
    if (place === null) return yield* new UsageFailure({ reason: `olai holds nothing at ${input.about} to talk about; no conversation was created` })
    const there = chatsIn(reading, owner.chats(reading)).at(place)
    if (there !== undefined && there.session !== null) {
      return yield* new UsageFailure({ reason: "this page already has a chat; no conversation was created" })
    }
    if (there !== undefined) return yield* started(owner, there.id, input.agent)
    // ...AND A ROW A REFUSED START LEFT BEHIND: minted under Chats, titled
    // with this place, and never made a chat because its agent would not
    // start. Starting on it again is the retry, so every attempt is one row.
    const left = strayAt(reading, place, new Set(owner.chats(reading).map(row => row.id)))
    if (left !== undefined) return yield* started(owner, left, input.agent)
  }
  let parent = input.parent
  if (parent === null) {
    const file = owner.current()
    if (file === null) return yield* new UsageFailure({ reason: "the Inbox is unavailable; no conversation was created" })
    parent = yield* ensureChats(owner, file)
    if (owner.current() !== file) return yield* new UsageFailure({ reason: "the Inbox changed; no conversation was created" })
  }
  if (!canParent(yield* owner.read, parent)) return yield* new UsageFailure({ reason: "The chosen parent vanished, was trashed, or can no longer hold a chat; no conversation was created" })
  const node = yield* owner.write({ op: "add", parent, title })
  return yield* started(owner, node.id, input.agent)
})

/** Start `agent` on a chat row, answering the row whatever the start said. */
const started = (owner: NewChat, node: string, agent: string) => Effect.gen(function*() {
  const result = yield* Effect.result(owner.start(node, agent, yield* owner.read))
  return { node, to: result._tag === "Success" ? result.success : null,
    refusal: result._tag === "Failure" ? result.failure.message : null }
})

/** A row under Inbox › Chats whose title stands for `place` and that is not a
 *  chat row — what a door's refused start leaves behind. */
const strayAt = (reading: Reading, place: Place, chats: ReadonlySet<string>): string | undefined =>
  (reading.derived.children.get(chatsId(reading)) ?? []).find(row => {
    if (!isRegular(row) || chats.has(row.node.id)) return false
    const at = placeIn(reading, row.node.title)
    return at !== null && samePlace(at, place)
  })?.node.id

export interface LocationQuery {
  readonly filter: string
  readonly limit: number
  readonly ids: readonly string[]
  readonly parents: readonly string[]
}
/** Bounded projection; exact lookups never require shipping the vault. */
export const chatLocations = (reading: Reading, query: LocationQuery, inbox: string | null = null) => {
  const paths = parentFiles(reading)
  const limit = Math.max(0, Math.min(20, Math.floor(query.limit)))
  const ids = new Set(query.ids.slice(0, 64))
  for (const id of query.parents.slice(0, 64)) {
    const row = reading.derived.byId.get(id)
    if (row !== undefined && isRegular(row) && row.node.parent !== undefined) ids.add(row.node.parent)
  }
  const project = (id: string) => {
    const row = reading.derived.byId.get(id)
    if (row === undefined || !isRegular(row) || !canParent(reading, id, paths)) return null
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
