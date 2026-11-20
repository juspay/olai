import { For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { createNow, outFor } from "./elapsed.ts"
import { LIVE_DOT } from "./live.ts"
import { useConversationUI } from "./ui.tsx"
import type { Chat } from "./state.ts"

export function Watching(props: { readonly chat: Chat }) {
  const out = () => props.chat.state().watching
  return (
    <Show when={out().length > 0}>
      <Strip chat={props.chat} />
    </Show>
  )
}

function Strip(props: { readonly chat: Chat }) {
  const { isPreviewing, togglePreview } = useConversationUI().previewing
  const out = () => props.chat.state().watching
  const now = createNow(() => true)
  return (
    <section
      class="shrink-0 border-b border-rule/60 bg-panel px-3 py-1.5 text-caption leading-snug"
      data-testid={TESTID.chatWatching}
      aria-label="Still running"
    >
      <p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <For each={out()}>
          {(task) => {
            const Said = () => (
              <>
                <span class={LIVE_DOT} aria-hidden="true" />
                <span class="min-w-0 truncate">{task.name}</span>
                <Show when={outFor(task.since, now())}>
                  {(said) => (
                    <span class="shrink-0 text-doing">
                      <span class="sr-only">running for&#32;</span>
                      <span data-testid={TESTID.chatWatchingFor}>{said()}</span>
                    </span>
                  )}
                </Show>
              </>
            )
            return (
              <Show
                when={task.kind === "agent"}
                fallback={
                  <span
                    class="flex min-w-0 items-baseline gap-1 text-ink"
                    data-testid={TESTID.chatWatchingTask}
                    data-kind={task.kind}
                    data-row={task.row}
                  >
                    <Said />
                  </span>
                }
              >
                <button
                  type="button"
                  class="flex min-w-0 items-baseline gap-1 rounded-control text-ink hover:text-accent aria-pressed:text-accent focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  data-testid={TESTID.chatWatchingTask}
                  data-kind={task.kind}
                  data-row={task.row}
                  aria-pressed={isPreviewing(task.row)}
                  onClick={() => togglePreview(task.row)}
                >
                  <Said />
                </button>
              </Show>
            )
          }}
        </For>
      </p>
    </section>
  )
}
