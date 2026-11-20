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
