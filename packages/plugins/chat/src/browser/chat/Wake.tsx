/**
 * WHAT MAY RING THIS CONVERSATION, as items on the standing line — one per running
 * plugin that declares a doorbell, in that plugin’s own words.
 *
 * THE LINE OWNS THE ROWS AND THE QUEUE COUNTS; each hung face owns its control
 * ({@link ./Standing.tsx} draws the bar). What this component owns is that the
 * faces are ITEMS of one line rather than a strip each: `data-testid` names the
 * group so a scenario can still say “the wake part of the line”, a `·` separates
 * one face from the next, and the face’s own markup — a label, a rule, a switch —
 * is drawn as it was.
 */
import { Effect, Schema } from "effect"
import { createMemo, For, Show } from "solid-js"
import { addressOf, sameAddress } from "./address.ts"
import { faces } from "../faces.ts"
import { olai } from "@olai/web/client/wire.ts"
import { TESTID } from "../../testids.ts"
import type { Chat } from "./state.ts"

export function Wake(props: { readonly chat: Chat }) {
  const roster = olai.cells.plugins.use()
  const to = createMemo(() => addressOf(props.chat.state()), undefined, { equals: sameAddress })
  const rows = () => faces().hung("conversation.wake")
  return <Show when={to()} keyed>{conversation =>
    <Show when={rows().length > 0}>
      <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" data-testid={TESTID.chatWake}>
        <For each={rows()}>{(row, index) => {
          const mine = () => props.chat.state().wake.find(one => one.name === row.plugin)
          const waiting = () => mine()?.waiting ?? 0
          const words = () => roster.value()?.built.find(one => one.name === row.plugin)?.wake
          return <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Show when={index() > 0}><span aria-hidden="true" class="text-muted">·</span></Show>
            {row.face({ conversation, pick: () => mine()?.pick ?? null, waiting,
              setPick: next => Schema.is(Schema.Json)(next)
                ? props.chat.scope(conversation.agent, conversation.session, row.plugin, next)
                : Effect.fail({ reason: "a wake pick must be JSON" }),
            })}
            <Show when={waiting() > 0 && words()}><span class="shrink-0 text-doing" data-testid={TESTID.chatWakeWaiting} data-waiting={waiting()}>{waiting()} {waiting() === 1 ? words()?.waiting.one : words()?.waiting.many}</span></Show>
          </span>
        }}</For>
      </span>
    </Show>
  }</Show>
}
