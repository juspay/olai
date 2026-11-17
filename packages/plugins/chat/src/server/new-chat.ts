/**
 * A CONVERSATION, STARTED — the two things *New chat* and another row's `open`
 * can mean, and the refusals each of them owes.
 *
 * ## The two arms, and why they are one verb
 *
 * MINT A ROW: a person typed a first message and chose where it goes, so a
 * plain node is written under that parent and the engine is started on it.
 * There is no default parent — a chat has to belong somewhere a person picked,
 * and a conversation filed wherever olai felt like putting it is one nobody
 * finds twice.
 *
 * AN ITEM'S OWN CHAT: a node or a note that exists already. Nothing is minted;
 * the engine is started on the item, and the tie is written where that item
 * keeps one (`./binding.ts` — a property on a row, front matter in a note).
 *
 * They are one verb because they end in one act — `start` on an item key — and
 * because the caller is the same press: the second arm is what the door on a
 * page and the plugin builder spend, and splitting it would be two spellings
 * of "a start that was refused leaves the item ready to try again".
 */

import { Effect } from "effect"
import {
  type AgentItem,
  inOlaiDir,
  inboxIn,
  isRegular,
  itemKey,
  type NodeAgent,
  type OpFailure,
  outlinePaths,
  type Reading,
  seatableIn,
  seatableNote,
  UsageFailure,
  type WriteRequest,
} from "@olai/format"
import type { Conversing } from "../sessions.ts"
import { newChatTitle } from "../new-chat-title.ts"

export interface NewChat {
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly write: (request: WriteRequest) => Effect.Effect<{ readonly id: string }, OpFailure>
  /** Start `agent` on an ITEM KEY, against the reading the mint committed. */
  readonly start: (
    item: string,
    agent: string,
    committed: Reading,
  ) => Effect.Effect<Conversing | null, OpFailure>
  /** The chat roster of a reading, nodes then notes — what a second chat on
   *  one item is refused against, and what a tie whose start was refused is
   *  found by (`../seating.ts`'s `rosterIn`). */
  readonly chats: (reading: Reading) => ReadonlyArray<Pick<NodeAgent, "id" | "title" | "session">>
}

/**
 * MINT A ROW UNDER A PARENT the person chose, and start the engine on it — or
 * start one on an item that is already there.
 *
 * `say` rides the second arm and is delivered by the caller once the
 * conversation exists: it is the first message of a chat somebody opened from
 * a page, and this module's business ends at the start.
 */
export type NewChatInput =
  | {
    readonly agent: string
    readonly title: string
    readonly parent: string
  }
  | {
    readonly agent: string
    readonly item: AgentItem
    readonly say?: string
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

/** The caller holds creationPermit across both acts. Once minted, the node
 *  survives a refused start and is returned for a page retry. */
export const newChat = (owner: NewChat, input: NewChatInput) =>
  Effect.gen(function*() {
    if ("item" in input) return yield* onItem(owner, input.item, input.agent)
    const title = newChatTitle(input.title)
    if (title === "") return yield* new UsageFailure({ reason: "A new chat needs a non-empty title" })
    if (!canParent(yield* owner.read, input.parent)) {
      return yield* new UsageFailure({
        reason:
          "The chosen parent vanished, was trashed, or can no longer hold a chat; no conversation was created",
      })
    }
    const node = yield* owner.write({ op: "add", parent: input.parent, title })
    return yield* started(owner, node.id, input.agent)
  })

/**
 * THE CHAT OF AN ITEM THAT EXISTS — one each, which is the whole of the
 * refusal below.
 *
 * A STARTED CHAT IS KEPT: an item already talking through a conversation is
 * not given a second one, and the sentence names what a person is looking at
 * so the answer reads as being about their row rather than about a key.
 *
 * A TIE WITH NO SESSION IS A RETRY, not a second chat: a start the engine
 * refused (no signature yet, nothing installed) leaves the engine written and
 * no session, and pressing again starts THAT item again rather than minting
 * anything.
 */
const onItem = (owner: NewChat, item: AgentItem, agent: string) =>
  Effect.gen(function*() {
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
    return yield* started(owner, key, agent)
  })

/** An item as a person reads it in a sentence: a node's own page, or the
 *  note's path. */
const printed = (item: AgentItem): string => item.kind === "node" ? `/#${item.id}` : `/${item.path}`

/** Start `agent` on an item, answering the item whatever the start said. */
const started = (owner: NewChat, item: string, agent: string) =>
  Effect.gen(function*() {
    const result = yield* Effect.result(owner.start(item, agent, yield* owner.read))
    return {
      node: item,
      to: result._tag === "Success" ? result.success : null,
      refusal: result._tag === "Failure" ? result.failure.message : null,
    }
  })

export interface LocationQuery {
  readonly filter: string
  readonly limit: number
  readonly ids: readonly string[]
  readonly parents: readonly string[]
}

/** Bounded projection; exact lookups never require shipping the vault. */
export const chatLocations = (reading: Reading, query: LocationQuery) => {
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
  return { nodes }
}
