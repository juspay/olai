import { Effect } from "effect"
import { UsageFailure, isRegular, seatableIn, outlinePaths, type OpFailure, type Reading, type WriteRequest } from "@olai/format"
import type { Conversing } from "../sessions.ts"
import { ensureChats } from "./filer.ts"

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
export const canParent = (reading: Reading, id: string): boolean => {
  const row = reading.derived.byId.get(id)
  return row !== undefined && isRegular(row) && seatableIn(reading.derived, id) && outlinePaths(reading.set).includes(row.file)
}
/** The caller holds creationPermit across all three independent acts. Once
 * minted, the node survives a refused start and is returned for a page retry. */
export const newChat = (owner: NewChat, input: NewChatInput) => Effect.gen(function*() {
  let parent = input.parent
  if (parent === null) {
    const file = owner.current()
    if (file === null) return yield* new UsageFailure({ reason: "the Inbox is unavailable; no conversation was created" })
    parent = yield* ensureChats(owner, file)
    if (owner.current() !== file) return yield* new UsageFailure({ reason: "the Inbox changed; no conversation was created" })
  }
  if (!canParent(yield* owner.read, parent)) return yield* new UsageFailure({ reason: "The chosen parent vanished, was trashed, or can no longer hold a chat; no conversation was created" })
  const node = yield* owner.write({ op: "add", parent, title: input.title })
  const started = yield* Effect.result(owner.start(node.id, input.agent, yield* owner.read))
  return { node: node.id, to: started._tag === "Success" ? started.success : null,
    refusal: started._tag === "Failure" ? started.failure.message : null }
})

/** A read-only picker projection, also available without the search plugin. */
export const chatLocations = (reading: Reading) => reading.derived.nodes.flatMap(row => {
  if (!isRegular(row) || !canParent(reading, row.node.id)) return []
  const path: string[] = []
  const seen = new Set<string>([row.node.id])
  let parent = row.node.parent
  while (parent !== undefined && !seen.has(parent)) {
    seen.add(parent)
    const above = reading.derived.byId.get(parent)
    if (above === undefined || !isRegular(above)) break
    path.unshift(above.node.title)
    parent = above.node.parent
  }
  return [{ id: row.node.id, title: row.node.title, file: row.file, path, parent: row.node.parent ?? null }]
})
