import { Effect } from "effect"

import type { AgentItem, OpFailure } from "@olai/format"
import type { Conversations, Provision } from "@olai/plugin-api/services"

import type { Conversing } from "../sessions.ts"
import type { NewChatInput } from "./new-chat.ts"
import { lines } from "../teaching.ts"

export interface Minted {
  readonly node: string
  readonly to: Conversing | null
  readonly refusal: string | null
}

export interface ConversationsOwner {
  readonly mint: (input: NewChatInput) => Effect.Effect<Minted, OpFailure>
  readonly send: (
    to: Conversing,
    text: string,
    preamble: ReadonlyArray<string>,
  ) => Effect.Effect<void, OpFailure>
  readonly seatAt: (about: AgentItem) => Effect.Effect<Conversing | null>
  readonly chatsAt: (abouts: ReadonlyArray<AgentItem>) => Effect.Effect<ReadonlySet<string>>
  readonly deliver: (
    who: string,
    to: Conversing,
    text: string,
    current: () => boolean,
  ) => Effect.Effect<boolean>
  readonly engines: () => ReadonlyArray<{ readonly id: string; readonly name: string }>
}

export const conversationsProvision = (
  owner: ConversationsOwner,
): Provision<Conversations> => (who, lifetime) => {
  const current = lifetime?.current ?? (() => true)
  return {
    open: (input) =>
      Effect.gen(function*() {
        const made = yield* owner.mint({ agent: input.engine, item: input.about })
        if (made.to === null) return { refusal: made.refusal }
        const said = yield* Effect.result(owner.send(made.to, input.say, lines(input.teach)))
        return { refusal: said._tag === "Failure" ? said.failure.message : null }
      }),
    say: (input) =>
      Effect.gen(function*() {
        if (!current()) return false
        const to = yield* owner.seatAt(input.about)
        if (to === null) return false
        return yield* owner.deliver(who, to, input.text, current)
      }),
    here: (input) => owner.chatsAt(input.about),
    engines: owner.engines,
  }
}
