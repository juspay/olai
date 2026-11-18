/**
 * THE CHAT OF AN ITEM — the one thing *New chat*, the door on a page and
 * another row's `open` all mean, and the refusals it owes.
 *
 * A node or a note that EXISTS already. Nothing is minted anywhere: the
 * engine is started on the item, and the tie is written where that item keeps
 * one (`./binding.ts` — a property on a row, front matter in a note).
 *
 * NOTHING IS MINTED, and that is the rule rather than a simplification. A
 * chat belonged to a row olai wrote for it until this change, which meant a
 * conversation was filed somewhere a person had to be asked about and could
 * never find twice. A chat is ABOUT something now: the thing it is about is
 * the thing a person already has, and the list of places a new chat can go is
 * the list of things in the vault ({@link itemLocations}).
 */

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
  /** Start `agent` on an ITEM KEY, against the reading this was asked over. */
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
 * THE CHAT OF A NODE OR A NOTE, started on `agent`.
 *
 * `say` rides along and is delivered by the caller once the conversation
 * exists: it is the first message of a chat somebody opened from a page or
 * from the palette, and this module's business ends at the start.
 */
export interface NewChatInput {
  readonly agent: string
  readonly item: AgentItem
  readonly say?: string
}

/**
 * ONE CHAT PER ITEM, which is the whole of the refusal below.
 *
 * A STARTED CHAT IS KEPT: an item already talking through a conversation is
 * not given a second one, and the sentence names what a person is looking at
 * so the answer reads as being about their row rather than about a key.
 *
 * A TIE WITH NO SESSION IS A RETRY, not a second chat: a start the engine
 * refused (no signature yet, nothing installed) leaves the engine written and
 * no session, and pressing again starts THAT item again.
 *
 * The caller holds `creationPermit` across the call.
 */
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

/** An item as a person reads it in a sentence: a node's own page, or the
 *  note's path. */
const printed = (item: AgentItem): string => item.kind === "node" ? `/#${item.id}` : `/${item.path}`

export interface LocationQuery {
  /** What is typed in the box, or `""` for the level as it opens. */
  readonly filter: string
  /** How many matches of EACH kind to answer with, capped at {@link MOST}. */
  readonly limit: number
  /** Item keys to answer about whatever is typed — what the level is standing
   *  on, and the chats it was most recently in. */
  readonly keys: readonly string[]
}

/** The most of each kind one question can carry back. Exact lookups are
 *  bounded the same way, so no answer here ships a vault. */
const MOST = 20

/**
 * WHERE A NEW CHAT CAN GO — every node and every note a chat could be about,
 * bounded, as the palette's item level asks for them.
 *
 * TWO KINDS IN ONE ANSWER, because they are one list to the person choosing:
 * *which node or note is this chat for*. The kinds are kept apart only by
 * their `kind` field, which is what the level draws its two headings off.
 *
 * WHAT IS LEFT OUT is olai's own machinery (`_olai/…`: the settings, the
 * pins, the inbox) and whatever has been put away. A chat about the file that
 * holds somebody's preferences is not a conversation anybody meant to start,
 * and a chat about a trashed row is one nobody would find again.
 *
 * WHICH OF THEM ALREADY HAVE A CHAT IS NOT ASKED HERE: every browser holds
 * the roster already (`../../browser/agents/answered.tsx`), so a second answer
 * to it on this wire would be the same fact arriving twice and disagreeing
 * once.
 */
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
      // ...AND ITS ANCESTORS BY THE SAME RULE: the outline draws a row
      // written as one markdown link by its LABEL, so a trail reading
      // `[house](/house.olai) › plan` names one of them twice over.
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
  // THE SET'S OWN DOCUMENTS, in path order, asked one by one whether a chat
  // could sit on them (`seatableNote`, inside `note` above) — so which files
  // are notes stays the directory's answer rather than a list narrowed here.
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
