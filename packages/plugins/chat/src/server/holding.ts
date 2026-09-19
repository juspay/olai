/** The stream's scope is the hold. Its single acknowledgement carries no chat
 * state or transcript, and acquiring it must never open a conversation. */
import { Effect, Queue, Stream } from "effect"
import type { Chat } from "../scoped.ts"
import type { Conversing } from "../sessions.ts"

export const holding = (ready: Effect.Effect<Pick<Chat, "holding">>) => ({
  source: (to: Conversing) => Stream.callback<null>(queue => Effect.gen(function*() {
    const chat = yield* ready
    yield* chat.holding(to)
    yield* Queue.offer(queue, null)
  })),
})
