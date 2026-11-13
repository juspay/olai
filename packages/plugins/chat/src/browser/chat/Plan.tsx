/** The agent's replaceable execution plan belongs to this conversation. */
import { For, Show } from "solid-js"
import { Tip } from "@olai/web/client/Tip.tsx"
import type { Chat } from "./state.ts"

const MARK = { pending: "○", in_progress: "◉", completed: "✓" } as const
export function Plan(props: { readonly chat: Chat }) {
  const steps = () => props.chat.state().plan
  return <Show when={steps().length > 0}>
    <details open class="shrink-0 border-b border-rule/60 px-3 py-2" aria-label="Execution plan">
      <summary class="cursor-pointer text-label font-semibold">
        Plan · {steps().filter((step) => step.status === "completed").length}/{steps().length}
      </summary>
      <ol class="mt-2 max-h-40 space-y-1 overflow-auto text-label">
        <For each={steps()}>{(step) =>
          <li data-status={step.status} class="flex gap-2"
            classList={{ "text-doing": step.status === "in_progress", "text-muted": step.status === "completed" }}>
            <span aria-label={step.status.replaceAll("_", " ")}>{MARK[step.status]}</span>
            {/* HOW URGENT THE STEP IS — a fact with no drawn mark at all, so
                it rides an sr-only companion after the step's words as well
                as under the pointer. */}
            <Tip text={step.priority + " priority"}>
              <span>{step.content}</span>
              <span class="sr-only">{step.priority} priority</span>
            </Tip>
          </li>
        }</For>
      </ol>
    </details>
  </Show>
}
