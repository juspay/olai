/**
 * WHERE THIS NOTE'S CHAT OPENS — *Opens alone* / *Opens with <name> beside*,
 * a line on the chat's own page and the only face of the `chat-opens` key.
 *
 * A NOTE ONLY. The answer lives in the note's front matter, beside the tie,
 * where a person can read it and a `git pull` carries it (`../../kinds.ts`).
 * A node's chat has nowhere to keep one, so a node's page draws no switch at
 * all rather than a disabled one.
 *
 * IT IS THE ROSTER'S ANSWER AND NOT THIS COMPONENT'S: `beside` is read off
 * the row the server publishes, so the switch says what the file says — a
 * person editing the key by hand moves it, and a press that the gate refuses
 * leaves it exactly where it was, with the sentence beside it.
 *
 * Drawn as an item of the same shape the sleep line has (`../chat/Sleeping.tsx`):
 * a label, a `role="switch"`, and a refusal in a `role="alert"`, so the two
 * lines under an agent line read as one kind of thing.
 */

import { Result } from "effect"
import { createSignal, Show } from "solid-js"
import { runAsync } from "@olai/web/client/run.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

import { TESTID } from "../../testids.ts"
import { chatWire } from "../wire.ts"

export function Opens(props: { readonly path: string; readonly name: string; readonly beside: boolean }) {
  const [problem, setProblem] = createSignal<string>()
  const [pressing, setPressing] = createSignal(false)
  const press = async () => {
    if (pressing()) return
    setPressing(true)
    setProblem(undefined)
    try {
      const outcome = await runAsync(chatWire().procedures.conversation.setOpens({ path: props.path, beside: !props.beside }))
      if (Result.isFailure(outcome)) setProblem(outcome.failure.message)
    } finally { setPressing(false) }
  }
  return (
    <section
      class="relative shrink-0 border-b border-rule bg-desk/40 px-3 py-1.5 text-caption leading-snug"
      data-testid={TESTID.chatOpens}
      data-beside={String(props.beside)}
      aria-label="Where this chat opens"
    >
      <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="text-muted">Opens</span>
        <span aria-hidden="true" class="text-muted">·</span>
        <Tip text={`Opening this chat from Chats can bring ${props.name} with it`} say>
          <button
            type="button"
            role="switch"
            aria-label={`Open with ${props.name} beside`}
            aria-checked={props.beside}
            data-testid={TESTID.chatOpensSwitch}
            disabled={pressing()}
            onClick={() => void press()}
          >{props.beside ? `with ${props.name} beside` : "alone"}</button>
        </Tip>
        <Show when={problem()}><span role="alert" class="text-alarm">{problem()}</span></Show>
      </p>
    </section>
  )
}
