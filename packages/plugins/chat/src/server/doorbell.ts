/** Browser-only picks are accepted only for a registered wake owner. */
import { Effect } from "effect"
import type { Wake } from "@olai/plugin-api/services"
import type { Json } from "../json.ts"
import type { Chat } from "../scoped.ts"

export const scopeThrough = (
  chat: Chat,
  declared: ReadonlyMap<string, Wake>,
  input: {
    readonly agent: string
    readonly session: string
    readonly plugin: string
    readonly pick: Json
  },
): Effect.Effect<void, { readonly reason: string }> =>
  declared.has(input.plugin)
    ? Effect.asVoid(chat.scope({ agent: input.agent, session: input.session }, input.plugin, input.pick))
    : Effect.fail({
      reason: `no plugin called \`${input.plugin}\` rings a conversation here`,
    })
