import { Effect } from "effect"
import { UsageFailure, type OpFailure, type Reading, type WriteRequest } from "@olai/format"
import { ensureChats } from "./filer.ts"

export interface NewChat {
  readonly current: () => string | null
  readonly read: Effect.Effect<Reading, OpFailure>
  readonly write: (request: WriteRequest) => Effect.Effect<{ readonly id: string }, OpFailure>
  readonly start: (node: string, agent: string) => Effect.Effect<unknown, OpFailure>
}
/** Three ordinary acts: ensure Chats, mint a child, then start its session.
 * A refused start leaves the minted plain node available for another gesture. */
export const newChat = (owner: NewChat, agent: string): Effect.Effect<string, OpFailure> => Effect.gen(function*() {
  const file = owner.current()
  if (file === null) return yield* new UsageFailure({ reason: "the Inbox is unavailable; no conversation was created" })
  const parent = yield* ensureChats(owner, file)
  if (owner.current() !== file) return yield* new UsageFailure({ reason: "the Inbox changed; no conversation was created" })
  const node = yield* owner.write({ op: "add", parent, title: "new conversation" })
  yield* owner.start(node.id, agent)
  return node.id
})
